import type { PromotionStatusValue } from "@nestama/shared";

/** Where a promotion or coupon stands right now: ended beats paused, which beats the schedule. */
export function promotionStatus(p: { isActive: boolean; startsAt: Date; endsAt: Date }, now = new Date()): PromotionStatusValue {
  if (now >= p.endsAt) return "ended";
  if (!p.isActive) return "paused";
  if (now < p.startsAt) return "scheduled";
  return "live";
}
