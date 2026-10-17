import { roundToRupee } from "@nestama/shared";

// Pure pricing rules. No I/O — every price shown or charged anywhere is derived from here.

export type PromotionScope = "ALL" | "CATEGORIES" | "PRODUCTS";

export interface PromotionRule {
  id: string;
  slug: string;
  name: string;
  discountPercent: number;
  startsAt: Date;
  endsAt: Date;
  isActive: boolean;
  scope: PromotionScope;
  categoryIds: string[];
  productIds: string[];
}

export interface PricingTarget {
  productId: string;
  categoryId: string;
  /** Parent chain of the product's category, so a promo on "Accessories" reaches "Collars". */
  categoryAncestorIds: string[];
}

export interface VariantPriceInput {
  price: number;
  mrp: number | null;
}

export interface PricedVariant {
  /** Regular selling price (paise). */
  price: number;
  /** What the customer pays right now (paise). */
  salePrice: number;
  /** Strike-through price, or null when there is nothing to compare against. */
  referencePrice: number | null;
  /** Badge percentage; 0 when there is no reference price. */
  discountPercent: number;
  promotion: { id: string; slug: string; name: string; endsAt: Date } | null;
}

export function isPromotionLive(p: PromotionRule, now: Date): boolean {
  return p.isActive && p.startsAt.getTime() <= now.getTime() && now.getTime() < p.endsAt.getTime();
}

export function promotionApplies(p: PromotionRule, t: PricingTarget): boolean {
  switch (p.scope) {
    case "ALL":
      return true;
    case "CATEGORIES":
      return p.categoryIds.includes(t.categoryId) || t.categoryAncestorIds.some((id) => p.categoryIds.includes(id));
    case "PRODUCTS":
      return p.productIds.includes(t.productId);
  }
}

/** Highest live, applicable promotion. Promotions never stack. */
export function selectBestPromotion(promos: PromotionRule[], t: PricingTarget, now: Date): PromotionRule | null {
  let best: PromotionRule | null = null;
  for (const p of promos) {
    if (!isPromotionLive(p, now) || !promotionApplies(p, t)) continue;
    if (!best || p.discountPercent > best.discountPercent) best = p;
  }
  return best;
}

export function priceVariant(v: VariantPriceInput, promo: PromotionRule | null): PricedVariant {
  const salePrice = promo ? roundToRupee((v.price * (100 - promo.discountPercent)) / 100) : v.price;

  let referencePrice: number | null = null;
  if (promo && salePrice < v.price) referencePrice = v.price;
  else if (!promo && v.mrp !== null && v.mrp > v.price) referencePrice = v.mrp;

  const discountPercent = referencePrice ? Math.round((1 - salePrice / referencePrice) * 100) : 0;

  return {
    price: v.price,
    salePrice,
    referencePrice,
    discountPercent,
    promotion: promo ? { id: promo.id, slug: promo.slug, name: promo.name, endsAt: promo.endsAt } : null,
  };
}

// ───────────── Cart totals ─────────────

export interface CartPricingLine {
  /** What the customer pays per unit now. */
  salePrice: number;
  /** Regular price per unit (for promotion savings). */
  price: number;
  quantity: number;
}

export interface CartTotalsOptions {
  couponDiscount: number;
  freeShippingThreshold: number;
  flatShippingFee: number;
  gstRatePercent: number;
}

export interface CartTotals {
  subtotal: number;
  promoSavings: number;
  couponDiscount: number;
  shipping: number;
  total: number;
  /** GST already included in the goods total (prices are GST-inclusive). */
  gstIncluded: number;
  gstRatePercent: number;
  freeShippingThreshold: number;
  amountToFreeShipping: number;
}

/** Spec §6: subtotal → coupon → shipping threshold (on goods after coupon) → total; GST is inclusive. */
export function summarizeCart(lines: CartPricingLine[], opts: CartTotalsOptions): CartTotals {
  const subtotal = lines.reduce((sum, l) => sum + l.salePrice * l.quantity, 0);
  const promoSavings = lines.reduce((sum, l) => sum + Math.max(0, l.price - l.salePrice) * l.quantity, 0);
  const couponDiscount = Math.min(Math.max(0, opts.couponDiscount), subtotal);
  const goods = subtotal - couponDiscount;
  const shipping = lines.length === 0 || goods >= opts.freeShippingThreshold ? 0 : opts.flatShippingFee;

  return {
    subtotal,
    promoSavings,
    couponDiscount,
    shipping,
    total: goods + shipping,
    gstIncluded: Math.round((goods * opts.gstRatePercent) / (100 + opts.gstRatePercent)),
    gstRatePercent: opts.gstRatePercent,
    freeShippingThreshold: opts.freeShippingThreshold,
    amountToFreeShipping: Math.max(0, opts.freeShippingThreshold - goods),
  };
}
