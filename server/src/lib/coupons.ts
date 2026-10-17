import { formatINR } from "@nestama/shared";

// Pure coupon rules. The cart re-evaluates the stored code on every read, so a coupon that stops
// qualifying (cart shrank, code expired) simply stops discounting and explains why.

export interface CouponRule {
  code: string;
  type: "PERCENT" | "FIXED";
  /** Percent (1–100) or paise. */
  value: number;
  minOrder: number;
  maxDiscount: number | null;
  startsAt: Date;
  endsAt: Date;
  isActive: boolean;
  usageLimit: number | null;
  perUserLimit: number | null;
  usedCount: number;
}

export interface CouponContext {
  now: Date;
  /** Whole-cart goods subtotal (after promotions), used for the minimum order. */
  subtotal: number;
  /** Part of the subtotal the coupon applies to (its scope). */
  eligibleSubtotal: number;
  /** Paid orders by this shopper that used the code. */
  userRedemptions: number;
}

export type CouponFailure = "NOT_FOUND" | "INACTIVE" | "NOT_STARTED" | "EXPIRED" | "MIN_ORDER_NOT_MET" | "NOT_ELIGIBLE" | "USAGE_LIMIT";

export type CouponResult = { ok: true; discount: number } | { ok: false; reason: CouponFailure; message: string };

const fail = (reason: CouponFailure, message: string): CouponResult => ({ ok: false, reason, message });

export function evaluateCoupon(coupon: CouponRule | null, ctx: CouponContext): CouponResult {
  if (!coupon) return fail("NOT_FOUND", "That code isn't valid. Check the spelling and try again.");
  if (!coupon.isActive) return fail("INACTIVE", `${coupon.code} is no longer active.`);
  if (ctx.now < coupon.startsAt) return fail("NOT_STARTED", `${coupon.code} isn't active yet.`);
  if (ctx.now >= coupon.endsAt) return fail("EXPIRED", `${coupon.code} has expired.`);
  if (coupon.usageLimit !== null && coupon.usedCount >= coupon.usageLimit)
    return fail("USAGE_LIMIT", `${coupon.code} has reached its usage limit.`);
  if (coupon.perUserLimit !== null && ctx.userRedemptions >= coupon.perUserLimit)
    return fail("USAGE_LIMIT", `You've already used ${coupon.code}.`);
  if (ctx.subtotal < coupon.minOrder) {
    return fail("MIN_ORDER_NOT_MET", `Add ${formatINR(coupon.minOrder - ctx.subtotal)} more to use ${coupon.code}.`);
  }
  if (ctx.eligibleSubtotal <= 0) return fail("NOT_ELIGIBLE", `None of the items in your cart are eligible for ${coupon.code}.`);

  const raw = coupon.type === "PERCENT" ? Math.round((ctx.eligibleSubtotal * coupon.value) / 100) : coupon.value;
  const capped = coupon.maxDiscount !== null ? Math.min(raw, coupon.maxDiscount) : raw;
  return { ok: true, discount: Math.min(capped, ctx.eligibleSubtotal) };
}
