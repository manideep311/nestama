import type { AdminCouponDTO, AdminPromotionDTO } from "@nestama/shared";
import { prisma } from "../../lib/prisma";
import { AppError } from "../../lib/errors";
import { slugify } from "../../lib/slug";
import { promotionStatus } from "../../lib/promotion-status";
import { revalidateStorefront } from "../../lib/revalidate";
import type { Prisma } from "../../generated/prisma/client";

type Scope = "ALL" | "CATEGORIES" | "PRODUCTS";

async function assertTargets(categoryIds: string[], productIds: string[]) {
  const [cats, prods] = await Promise.all([
    categoryIds.length ? prisma.category.count({ where: { id: { in: categoryIds } } }) : 0,
    productIds.length ? prisma.product.count({ where: { id: { in: productIds } } }) : 0,
  ]);
  if (cats !== new Set(categoryIds).size || prods !== new Set(productIds).size) {
    throw new AppError("TARGET_NOT_FOUND", 404, "Some of the chosen categories or products no longer exist.");
  }
}

/** Only the relations that match the scope are kept, so switching scope never leaves stale links. */
function scopedTargets(scope: Scope, categoryIds: string[], productIds: string[]) {
  const categories = scope === "CATEGORIES" ? categoryIds.map((id) => ({ id })) : [];
  const products = scope === "PRODUCTS" ? productIds.map((id) => ({ id })) : [];
  return {
    create: { categories: { connect: categories }, products: { connect: products } },
    update: { categories: { set: categories }, products: { set: products } },
  };
}

// ───────── Promotions ─────────

export interface PromotionData {
  name: string;
  slug?: string;
  headline: string;
  subheadline: string;
  discountPercent: number;
  startsAt: string;
  endsAt: string;
  isActive: boolean;
  placement: "HERO_CARD" | "COUNTDOWN_BANNER" | "CAMPAIGN" | "NONE";
  scope: Scope;
  categoryIds: string[];
  productIds: string[];
  couponId: string | null;
  imageUrl: string | null;
  imageAlt: string | null;
  ctaLabel: string;
  ctaHref: string;
  theme: string;
  sortOrder: number;
}

const promotionInclude = {
  categories: { select: { id: true } },
  products: { select: { id: true } },
  coupon: { select: { code: true } },
} satisfies Prisma.PromotionInclude;

function toPromotionDTO(p: Prisma.PromotionGetPayload<{ include: typeof promotionInclude }>, now = new Date()): AdminPromotionDTO {
  return {
    id: p.id,
    slug: p.slug,
    name: p.name,
    headline: p.headline,
    subheadline: p.subheadline,
    discountPercent: p.discountPercent,
    startsAt: p.startsAt.toISOString(),
    endsAt: p.endsAt.toISOString(),
    isActive: p.isActive,
    placement: p.placement,
    scope: p.scope,
    categoryIds: p.categories.map((c) => c.id),
    productIds: p.products.map((x) => x.id),
    couponId: p.couponId,
    couponCode: p.coupon?.code ?? null,
    imageUrl: p.imageUrl,
    imageAlt: p.imageAlt,
    ctaLabel: p.ctaLabel,
    ctaHref: p.ctaHref,
    theme: p.theme,
    sortOrder: p.sortOrder,
    status: promotionStatus(p, now),
  };
}

export async function listPromotions(): Promise<AdminPromotionDTO[]> {
  const rows = await prisma.promotion.findMany({ include: promotionInclude, orderBy: [{ endsAt: "desc" }, { sortOrder: "asc" }] });
  return rows.map((p) => toPromotionDTO(p));
}

async function promotionSlug(data: PromotionData, excludeId?: string): Promise<string> {
  const taken = async (slug: string) => {
    const hit = await prisma.promotion.findUnique({ where: { slug }, select: { id: true } });
    return Boolean(hit && hit.id !== excludeId);
  };
  if (data.slug) {
    if (await taken(data.slug)) throw new AppError("SLUG_TAKEN", 409, `The slug “${data.slug}” is already used by another promotion.`);
    return data.slug;
  }
  const base = slugify(data.name) || "promotion";
  let slug = base;
  for (let n = 2; await taken(slug); n++) slug = `${base}-${n}`;
  return slug;
}

async function promotionFields(data: PromotionData, slug: string) {
  await assertTargets(data.categoryIds, data.productIds);
  if (data.couponId && !(await prisma.coupon.findUnique({ where: { id: data.couponId }, select: { id: true } }))) {
    throw new AppError("COUPON_NOT_FOUND", 404, "The linked coupon no longer exists.");
  }
  return {
    slug,
    name: data.name,
    headline: data.headline,
    subheadline: data.subheadline,
    discountPercent: data.discountPercent,
    startsAt: new Date(data.startsAt),
    endsAt: new Date(data.endsAt),
    isActive: data.isActive,
    placement: data.placement,
    scope: data.scope,
    couponId: data.couponId,
    imageUrl: data.imageUrl,
    imageAlt: data.imageAlt,
    ctaLabel: data.ctaLabel,
    ctaHref: data.ctaHref,
    theme: data.theme,
    sortOrder: data.sortOrder,
  };
}

export async function createPromotion(data: PromotionData): Promise<AdminPromotionDTO> {
  const fields = await promotionFields(data, await promotionSlug(data));
  const created = await prisma.promotion.create({
    data: { ...fields, ...scopedTargets(data.scope, data.categoryIds, data.productIds).create },
    include: promotionInclude,
  });
  revalidateStorefront();
  return toPromotionDTO(created);
}

export async function updatePromotion(id: string, data: PromotionData): Promise<AdminPromotionDTO> {
  if (!(await prisma.promotion.findUnique({ where: { id }, select: { id: true } })))
    throw new AppError("PROMOTION_NOT_FOUND", 404, "That promotion doesn't exist.");
  const fields = await promotionFields(data, await promotionSlug(data, id));
  const updated = await prisma.promotion.update({
    where: { id },
    data: { ...fields, ...scopedTargets(data.scope, data.categoryIds, data.productIds).update },
    include: promotionInclude,
  });
  revalidateStorefront();
  return toPromotionDTO(updated);
}

export async function deletePromotion(id: string): Promise<{ deleted: true }> {
  if (!(await prisma.promotion.findUnique({ where: { id }, select: { id: true } })))
    throw new AppError("PROMOTION_NOT_FOUND", 404, "That promotion doesn't exist.");
  await prisma.promotion.delete({ where: { id } });
  revalidateStorefront();
  return { deleted: true };
}

// ───────── Coupons ─────────

export interface CouponData {
  code: string;
  description: string;
  type: "PERCENT" | "FIXED";
  value: number;
  minOrder: number;
  maxDiscount: number | null;
  startsAt: string;
  endsAt: string;
  usageLimit: number | null;
  perUserLimit: number | null;
  scope: Scope;
  categoryIds: string[];
  productIds: string[];
  isActive: boolean;
}

const couponInclude = { categories: { select: { id: true } }, products: { select: { id: true } } } satisfies Prisma.CouponInclude;

function toCouponDTO(c: Prisma.CouponGetPayload<{ include: typeof couponInclude }>, now = new Date()): AdminCouponDTO {
  return {
    id: c.id,
    code: c.code,
    description: c.description,
    type: c.type,
    value: c.value,
    minOrder: c.minOrder,
    maxDiscount: c.maxDiscount,
    startsAt: c.startsAt.toISOString(),
    endsAt: c.endsAt.toISOString(),
    usageLimit: c.usageLimit,
    perUserLimit: c.perUserLimit,
    scope: c.scope,
    categoryIds: c.categories.map((x) => x.id),
    productIds: c.products.map((x) => x.id),
    isActive: c.isActive,
    usedCount: c.usedCount,
    status: promotionStatus(c, now),
  };
}

export async function listCoupons(): Promise<AdminCouponDTO[]> {
  const rows = await prisma.coupon.findMany({ include: couponInclude, orderBy: [{ endsAt: "desc" }, { code: "asc" }] });
  return rows.map((c) => toCouponDTO(c));
}

async function couponFields(data: CouponData, excludeId?: string) {
  const clash = await prisma.coupon.findUnique({ where: { code: data.code }, select: { id: true } });
  if (clash && clash.id !== excludeId) throw new AppError("CODE_TAKEN", 409, `The code ${data.code} already exists.`);
  await assertTargets(data.categoryIds, data.productIds);
  return {
    code: data.code,
    description: data.description,
    type: data.type,
    value: data.value,
    minOrder: data.minOrder,
    maxDiscount: data.type === "PERCENT" ? data.maxDiscount : null,
    startsAt: new Date(data.startsAt),
    endsAt: new Date(data.endsAt),
    usageLimit: data.usageLimit,
    perUserLimit: data.perUserLimit,
    scope: data.scope,
    isActive: data.isActive,
  };
}

export async function createCoupon(data: CouponData): Promise<AdminCouponDTO> {
  const created = await prisma.coupon.create({
    data: { ...(await couponFields(data)), ...scopedTargets(data.scope, data.categoryIds, data.productIds).create },
    include: couponInclude,
  });
  revalidateStorefront();
  return toCouponDTO(created);
}

export async function updateCoupon(id: string, data: CouponData): Promise<AdminCouponDTO> {
  if (!(await prisma.coupon.findUnique({ where: { id }, select: { id: true } })))
    throw new AppError("COUPON_NOT_FOUND", 404, "That coupon doesn't exist.");
  const updated = await prisma.coupon.update({
    where: { id },
    data: { ...(await couponFields(data, id)), ...scopedTargets(data.scope, data.categoryIds, data.productIds).update },
    include: couponInclude,
  });
  revalidateStorefront();
  return toCouponDTO(updated);
}

/** Used coupons keep their redemption history: deactivate them instead of deleting. */
export async function deleteCoupon(id: string): Promise<{ deleted: true }> {
  const c = await prisma.coupon.findUnique({ where: { id }, include: { _count: { select: { redemptions: true } } } });
  if (!c) throw new AppError("COUPON_NOT_FOUND", 404, "That coupon doesn't exist.");
  if (c._count.redemptions > 0) {
    throw new AppError(
      "COUPON_USED",
      409,
      `${c.code} has been used on ${c._count.redemptions} order(s). Switch it off instead of deleting it.`,
    );
  }
  await prisma.coupon.delete({ where: { id } });
  revalidateStorefront();
  return { deleted: true };
}
