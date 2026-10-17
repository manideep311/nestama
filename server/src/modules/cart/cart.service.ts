import crypto from "node:crypto";
import type { CookieOptions, Request, Response } from "express";
import { MAX_LINE_QUANTITY, type CartDTO, type CartLineDTO } from "@nestama/shared";
import { prisma } from "../../lib/prisma";
import { AppError } from "../../lib/errors";
import { env } from "../../config/env";
import { priceVariant, selectBestPromotion, summarizeCart, type PromotionRule } from "../../lib/pricing";
import { evaluateCoupon, type CouponResult } from "../../lib/coupons";
import type { Prisma } from "../../generated/prisma/client";
import { loadLivePromotions, toPromotionRule } from "../catalog/catalog.service";
import { variantStockStatus } from "../catalog/product-mapper";
import { getStoreSettingsRow } from "../settings/settings.service";
import { mergeCartLines } from "../../lib/cart-merge";

export const CART_COOKIE = "nst_cart";

const cookieOptions: CookieOptions = {
  httpOnly: true,
  sameSite: "lax",
  secure: env.NODE_ENV === "production",
  path: "/",
  maxAge: 60 * 24 * 3600 * 1000,
};

export const cartInclude = {
  items: {
    orderBy: { createdAt: "asc" },
    include: {
      variant: {
        include: {
          product: {
            include: {
              brand: { select: { name: true } },
              category: { select: { id: true, parentId: true } },
              images: { orderBy: { sortOrder: "asc" }, take: 1 },
            },
          },
        },
      },
    },
  },
} satisfies Prisma.CartInclude;

export type CartRow = Prisma.CartGetPayload<{ include: typeof cartInclude }>;

const GUEST_TOKEN = /^[A-Za-z0-9_-]{20,64}$/;

/** Signed-in carts are keyed by user; guests by an httpOnly cookie token. */
function owner(req: Request, res: Response): { userId?: string; guestToken?: string } {
  const userId = res.locals.user?.id;
  if (userId) return { userId };
  const token = req.cookies?.[CART_COOKIE] as string | undefined;
  return token && GUEST_TOKEN.test(token) ? { guestToken: token } : {};
}

async function findCart(req: Request, res: Response): Promise<CartRow | null> {
  const o = owner(req, res);
  if (o.userId) return prisma.cart.findUnique({ where: { userId: o.userId }, include: cartInclude });
  if (o.guestToken) return prisma.cart.findUnique({ where: { guestToken: o.guestToken }, include: cartInclude });
  return null;
}

async function getOrCreateCart(req: Request, res: Response): Promise<CartRow> {
  const existing = await findCart(req, res);
  if (existing) return existing;
  const o = owner(req, res);
  if (o.userId) return prisma.cart.create({ data: { userId: o.userId }, include: cartInclude });
  const guestToken = crypto.randomBytes(24).toString("base64url");
  const cart = await prisma.cart.create({ data: { guestToken }, include: cartInclude });
  res.cookie(CART_COOKIE, guestToken, cookieOptions);
  return cart;
}

function linePromotion(item: CartRow["items"][number], rules: PromotionRule[], now: Date): PromotionRule | null {
  const p = item.variant.product;
  return selectBestPromotion(
    rules,
    { productId: p.id, categoryId: p.category.id, categoryAncestorIds: p.category.parentId ? [p.category.parentId] : [] },
    now,
  );
}

const couponInclude = {
  categories: { select: { id: true } },
  products: { select: { id: true } },
} satisfies Prisma.CouponInclude;

type CouponRow = Prisma.CouponGetPayload<{ include: typeof couponInclude }>;

function eligibleSubtotal(cart: CartRow, lines: CartLineDTO[], coupon: CouponRow): number {
  if (coupon.scope === "ALL") return lines.reduce((sum, l) => sum + l.lineTotal, 0);
  const categoryIds = new Set(coupon.categories.map((c) => c.id));
  const productIds = new Set(coupon.products.map((p) => p.id));
  return lines.reduce((sum, line, i) => {
    const product = cart.items[i]!.variant.product;
    const inScope =
      coupon.scope === "PRODUCTS"
        ? productIds.has(product.id)
        : categoryIds.has(product.category.id) || (product.category.parentId !== null && categoryIds.has(product.category.parentId));
    return inScope ? sum + line.lineTotal : sum;
  }, 0);
}

/**
 * Re-prices every line from the live catalog and re-validates any stored coupon.
 * The only source of cart totals. `couponCode` overrides the stored code (used to test a new one).
 */
export async function priceCart(
  cart: CartRow | null,
  opts: { now?: Date; userId?: string; couponCode?: string | null } = {},
): Promise<{ dto: CartDTO; coupon: CouponResult | null }> {
  const now = opts.now ?? new Date();
  const [settings, promos] = await Promise.all([getStoreSettingsRow(), cart?.items.length ? loadLivePromotions(now) : []]);
  const rules = promos.map(toPromotionRule);

  const lines: CartLineDTO[] = (cart?.items ?? []).map((item) => {
    const { variant } = item;
    const product = variant.product;
    const priced = priceVariant(variant, linePromotion(item, rules, now));
    const image = product.images[0];
    const available = product.isActive ? variant.stock : 0;
    return {
      id: item.id,
      variantId: variant.id,
      productId: product.id,
      slug: product.slug,
      name: product.name,
      brand: product.brand.name,
      variantLabel: variant.label,
      image: image ? { url: image.url, alt: image.alt, width: image.width, height: image.height } : { url: "", alt: "" },
      quantity: item.quantity,
      maxQuantity: Math.min(available, MAX_LINE_QUANTITY),
      unitPrice: priced.salePrice,
      originalUnitPrice: priced.referencePrice ?? priced.salePrice,
      lineTotal: priced.salePrice * item.quantity,
      stock: variantStockStatus({ stock: available, lowStockThreshold: variant.lowStockThreshold }),
    };
  });

  const subtotal = lines.reduce((sum, l) => sum + l.lineTotal, 0);
  const code = opts.couponCode === undefined ? (cart?.couponCode ?? null) : opts.couponCode;
  let couponResult: CouponResult | null = null;
  if (code && cart) {
    const coupon = await prisma.coupon.findUnique({ where: { code }, include: couponInclude });
    const userRedemptions =
      coupon && opts.userId ? await prisma.couponRedemption.count({ where: { couponId: coupon.id, userId: opts.userId } }) : 0;
    couponResult = evaluateCoupon(coupon, {
      now,
      subtotal,
      eligibleSubtotal: coupon ? eligibleSubtotal(cart, lines, coupon) : 0,
      userRedemptions,
    });
  }

  const totals = summarizeCart(
    lines.map((l, i) => ({ salePrice: l.unitPrice, price: cart!.items[i]!.variant.price, quantity: l.quantity })),
    {
      couponDiscount: couponResult?.ok ? couponResult.discount : 0,
      freeShippingThreshold: settings.freeShippingThreshold,
      flatShippingFee: settings.flatShippingFee,
      gstRatePercent: settings.gstRatePercent,
    },
  );

  return {
    dto: {
      id: cart?.id ?? null,
      lines,
      summary: {
        ...totals,
        itemCount: lines.reduce((n, l) => n + l.quantity, 0),
        couponCode: code,
        couponNotice: couponResult && !couponResult.ok ? couponResult.message : null,
      },
    },
    coupon: couponResult,
  };
}

export async function toCartDTO(cart: CartRow | null, opts: { now?: Date; userId?: string } = {}): Promise<CartDTO> {
  return (await priceCart(cart, opts)).dto;
}

export async function applyCoupon(req: Request, res: Response, code: string): Promise<CartDTO> {
  const cart = await findCart(req, res);
  if (!cart || cart.items.length === 0) throw new AppError("CART_EMPTY", 422, "Add something to your cart before applying a code.");
  const userId = res.locals.user?.id;
  const { coupon } = await priceCart(cart, { userId, couponCode: code });
  if (!coupon?.ok) {
    throw new AppError("COUPON_INVALID", 422, coupon?.message ?? "That code isn't valid.", {
      reason: coupon && !coupon.ok ? coupon.reason : "NOT_FOUND",
    });
  }
  await prisma.cart.update({ where: { id: cart.id }, data: { couponCode: code } });
  return toCartDTO(await prisma.cart.findUnique({ where: { id: cart.id }, include: cartInclude }), { userId });
}

export async function removeCoupon(req: Request, res: Response): Promise<CartDTO> {
  const cart = await findCart(req, res);
  if (cart?.couponCode) await prisma.cart.update({ where: { id: cart.id }, data: { couponCode: null } });
  return toCartDTO(cart ? await prisma.cart.findUnique({ where: { id: cart.id }, include: cartInclude }) : null, {
    userId: res.locals.user?.id,
  });
}

export async function getCart(req: Request, res: Response): Promise<CartDTO> {
  return toCartDTO(await findCart(req, res), { userId: res.locals.user?.id });
}

export async function addItem(req: Request, res: Response, variantId: string, quantity: number): Promise<CartDTO> {
  const variant = await prisma.productVariant.findUnique({
    where: { id: variantId },
    include: { product: { select: { isActive: true } } },
  });
  if (!variant || !variant.product.isActive) throw new AppError("VARIANT_NOT_FOUND", 404, "That product option isn't available.");
  if (variant.stock <= 0) throw new AppError("OUT_OF_STOCK", 409, "Sorry, that item just sold out.");

  const cart = await getOrCreateCart(req, res);
  const existing = cart.items.find((i) => i.variantId === variantId);
  const limit = Math.min(variant.stock, MAX_LINE_QUANTITY);
  const next = (existing?.quantity ?? 0) + quantity;
  if (next > limit) {
    throw new AppError("STOCK_LIMIT", 409, `You can add up to ${limit} of this item.`, {
      available: limit,
      inCart: existing?.quantity ?? 0,
    });
  }

  await prisma.cartItem.upsert({
    where: { cartId_variantId: { cartId: cart.id, variantId } },
    update: { quantity: next },
    create: { cartId: cart.id, variantId, quantity },
  });
  // Re-read by id: a brand-new guest cookie is on the response, not yet on this request.
  return toCartDTO(await prisma.cart.findUnique({ where: { id: cart.id }, include: cartInclude }), { userId: res.locals.user?.id });
}

export async function updateItem(req: Request, res: Response, itemId: string, quantity: number): Promise<CartDTO> {
  const cart = await findCart(req, res);
  const item = cart?.items.find((i) => i.id === itemId);
  if (!cart || !item) throw new AppError("CART_ITEM_NOT_FOUND", 404, "That item is no longer in your cart.");

  if (quantity === 0) {
    await prisma.cartItem.delete({ where: { id: itemId } });
  } else {
    const limit = Math.min(item.variant.stock, MAX_LINE_QUANTITY);
    if (quantity > limit) throw new AppError("STOCK_LIMIT", 409, `Only ${limit} available.`, { available: limit, inCart: item.quantity });
    await prisma.cartItem.update({ where: { id: itemId }, data: { quantity } });
  }
  return toCartDTO(await findCart(req, res), { userId: res.locals.user?.id });
}

export async function removeItem(req: Request, res: Response, itemId: string): Promise<CartDTO> {
  return updateItem(req, res, itemId, 0);
}

/** The signed-in user's cart with everything pricing needs (null when they have none). */
export function loadUserCart(userId: string): Promise<CartRow | null> {
  return prisma.cart.findUnique({ where: { userId }, include: cartInclude });
}

function clearGuestCookie(res: Response) {
  const { maxAge: _maxAge, ...attributes } = cookieOptions;
  res.clearCookie(CART_COOKIE, attributes);
}

/**
 * First request after sign-in: folds the guest cart into the user's cart (quantities summed and
 * capped at stock), then deletes the guest cart and its cookie. Safe under concurrent requests:
 * only the request whose delete succeeds performs the merge.
 */
export async function mergeGuestCartIntoUser(req: Request, res: Response, userId: string): Promise<void> {
  const token = req.cookies?.[CART_COOKIE] as string | undefined;
  clearGuestCookie(res);
  if (!token || !GUEST_TOKEN.test(token)) return;

  await prisma.$transaction(async (tx) => {
    const guest = await tx.cart.findUnique({ where: { guestToken: token }, include: { items: { orderBy: { createdAt: "asc" } } } });
    if (!guest || guest.userId) return;
    const { count } = await tx.cart.deleteMany({ where: { id: guest.id } });
    if (count === 0 || guest.items.length === 0) return;

    const userCart = await tx.cart.upsert({
      where: { userId },
      update: {},
      create: { userId, couponCode: guest.couponCode },
      include: { items: { orderBy: { createdAt: "asc" } } },
    });
    const variantIds = [...new Set([...guest.items, ...userCart.items].map((i) => i.variantId))];
    const variants = await tx.productVariant.findMany({
      where: { id: { in: variantIds } },
      select: { id: true, stock: true, product: { select: { isActive: true } } },
    });
    const stock = new Map(variants.map((v) => [v.id, v.product.isActive ? v.stock : 0]));
    const merged = mergeCartLines(guest.items, userCart.items, stock);

    await tx.cartItem.deleteMany({ where: { cartId: userCart.id } });
    const base = Date.now();
    if (merged.length > 0) {
      await tx.cartItem.createMany({
        data: merged.map((line, i) => ({
          cartId: userCart.id,
          variantId: line.variantId,
          quantity: line.quantity,
          createdAt: new Date(base + i),
        })),
      });
    }
    if (!userCart.couponCode && guest.couponCode)
      await tx.cart.update({ where: { id: userCart.id }, data: { couponCode: guest.couponCode } });
  });
}
