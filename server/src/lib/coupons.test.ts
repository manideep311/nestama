import { describe, it, expect } from "vitest";
import { evaluateCoupon, type CouponRule } from "./coupons";

const now = new Date("2026-10-11T12:00:00Z");

const coupon = (o: Partial<CouponRule> = {}): CouponRule => ({
  code: "NESTAMA20",
  type: "PERCENT",
  value: 20,
  minOrder: 99900,
  maxDiscount: 50000,
  startsAt: new Date("2026-10-01T00:00:00Z"),
  endsAt: new Date("2026-10-20T00:00:00Z"),
  isActive: true,
  usageLimit: null,
  perUserLimit: null,
  usedCount: 0,
  ...o,
});

const ctx = (o: Partial<Parameters<typeof evaluateCoupon>[1]> = {}) => ({
  now,
  subtotal: 150000,
  eligibleSubtotal: 150000,
  userRedemptions: 0,
  ...o,
});

describe("evaluateCoupon", () => {
  it("applies a percentage discount", () => {
    expect(evaluateCoupon(coupon(), ctx())).toEqual({ ok: true, discount: 30000 });
  });

  it("caps percentage discounts at maxDiscount", () => {
    expect(evaluateCoupon(coupon(), ctx({ subtotal: 400000, eligibleSubtotal: 400000 }))).toEqual({ ok: true, discount: 50000 });
  });

  it("never gives a fixed discount larger than the eligible amount", () => {
    const flat = coupon({ type: "FIXED", value: 15000, minOrder: 0, maxDiscount: null });
    expect(evaluateCoupon(flat, ctx({ eligibleSubtotal: 9900 }))).toEqual({ ok: true, discount: 9900 });
  });

  it("explains how much more is needed for the minimum order", () => {
    const r = evaluateCoupon(coupon(), ctx({ subtotal: 79900, eligibleSubtotal: 79900 }));
    expect(r).toMatchObject({ ok: false, reason: "MIN_ORDER_NOT_MET" });
    expect(!r.ok && r.message).toBe("Add ₹200 more to use NESTAMA20.");
  });

  it.each([
    ["NOT_FOUND", null, ctx()],
    ["INACTIVE", coupon({ isActive: false }), ctx()],
    ["NOT_STARTED", coupon({ startsAt: new Date("2026-10-12T00:00:00Z") }), ctx()],
    ["EXPIRED", coupon({ endsAt: new Date("2026-10-11T11:00:00Z") }), ctx()],
    ["NOT_ELIGIBLE", coupon({ minOrder: 0 }), ctx({ eligibleSubtotal: 0 })],
    ["USAGE_LIMIT", coupon({ usageLimit: 100, usedCount: 100 }), ctx()],
    ["USAGE_LIMIT", coupon({ perUserLimit: 1 }), ctx({ userRedemptions: 1 })],
  ] as const)("rejects with %s", (reason, c, context) => {
    const r = evaluateCoupon(c, context);
    expect(r.ok).toBe(false);
    expect(!r.ok && r.reason).toBe(reason);
    expect(!r.ok && r.message.length).toBeGreaterThan(10);
  });
});
