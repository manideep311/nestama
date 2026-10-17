import { describe, it, expect } from "vitest";
import {
  isPromotionLive,
  promotionApplies,
  selectBestPromotion,
  priceVariant,
  summarizeCart,
  type PromotionRule,
  type PricingTarget,
} from "./pricing";

const now = new Date("2026-10-10T12:00:00Z");

const promo = (o: Partial<PromotionRule> = {}): PromotionRule => ({
  id: "p1",
  slug: "toys",
  name: "Toys",
  discountPercent: 15,
  startsAt: new Date("2026-10-01T00:00:00Z"),
  endsAt: new Date("2026-10-20T00:00:00Z"),
  isActive: true,
  scope: "ALL",
  categoryIds: [],
  productIds: [],
  ...o,
});

const toy: PricingTarget = { productId: "prod1", categoryId: "toys", categoryAncestorIds: [] };
const collar: PricingTarget = { productId: "prod2", categoryId: "collars", categoryAncestorIds: ["accessories"] };

describe("isPromotionLive", () => {
  it("is live inside [startsAt, endsAt)", () => {
    expect(isPromotionLive(promo(), now)).toBe(true);
  });

  it("is not live before start, at/after end, or when inactive", () => {
    expect(isPromotionLive(promo({ startsAt: new Date("2026-10-11T00:00:00Z") }), now)).toBe(false);
    expect(isPromotionLive(promo({ endsAt: now }), now)).toBe(false);
    expect(isPromotionLive(promo({ isActive: false }), now)).toBe(false);
  });
});

describe("promotionApplies", () => {
  it("ALL applies to everything", () => {
    expect(promotionApplies(promo(), toy)).toBe(true);
  });

  it("CATEGORIES matches the product category or an ancestor", () => {
    expect(promotionApplies(promo({ scope: "CATEGORIES", categoryIds: ["toys"] }), toy)).toBe(true);
    expect(promotionApplies(promo({ scope: "CATEGORIES", categoryIds: ["accessories"] }), collar)).toBe(true);
    expect(promotionApplies(promo({ scope: "CATEGORIES", categoryIds: ["beds"] }), toy)).toBe(false);
  });

  it("PRODUCTS matches listed product ids", () => {
    expect(promotionApplies(promo({ scope: "PRODUCTS", productIds: ["prod1"] }), toy)).toBe(true);
    expect(promotionApplies(promo({ scope: "PRODUCTS", productIds: ["prod1"] }), collar)).toBe(false);
  });
});

describe("selectBestPromotion", () => {
  it("picks the highest live applicable percent and never stacks", () => {
    const best = selectBestPromotion(
      [
        promo({ id: "a", discountPercent: 15 }),
        promo({ id: "b", discountPercent: 25, scope: "PRODUCTS", productIds: ["prod1"] }),
        promo({ id: "c", discountPercent: 40, isActive: false }),
      ],
      toy,
      now,
    );
    expect(best?.id).toBe("b");
  });

  it("returns null when nothing applies", () => {
    expect(selectBestPromotion([promo({ scope: "PRODUCTS", productIds: ["x"] })], toy, now)).toBeNull();
  });
});

describe("priceVariant", () => {
  it("applies the promotion and rounds to whole rupees", () => {
    const r = priceVariant({ price: 129900, mrp: 149900 }, promo({ discountPercent: 15 }));
    expect(r.salePrice).toBe(110400); // 1104.15 → 1104
    expect(r.referencePrice).toBe(129900); // strike-through is the regular price when promoted
    expect(r.discountPercent).toBe(15);
    expect(r.promotion?.slug).toBe("toys");
  });

  it("falls back to MRP as the reference when no promotion", () => {
    const r = priceVariant({ price: 79900, mrp: 99900 }, null);
    expect(r.salePrice).toBe(79900);
    expect(r.referencePrice).toBe(99900);
    expect(r.discountPercent).toBe(20);
    expect(r.promotion).toBeNull();
  });

  it("has no reference or badge when price equals MRP or MRP missing", () => {
    expect(priceVariant({ price: 50000, mrp: 50000 }, null)).toMatchObject({ referencePrice: null, discountPercent: 0 });
    expect(priceVariant({ price: 50000, mrp: null }, null)).toMatchObject({ referencePrice: null, discountPercent: 0 });
  });
});

describe("summarizeCart", () => {
  const opts = { couponDiscount: 0, freeShippingThreshold: 99900, flatShippingFee: 7900, gstRatePercent: 18 };

  it("returns zeros and no shipping for an empty cart", () => {
    expect(summarizeCart([], opts)).toEqual({
      subtotal: 0,
      promoSavings: 0,
      couponDiscount: 0,
      shipping: 0,
      total: 0,
      gstIncluded: 0,
      gstRatePercent: 18,
      freeShippingThreshold: 99900,
      amountToFreeShipping: 99900,
    });
  });

  it("charges the flat fee below the free-shipping threshold", () => {
    const s = summarizeCart([{ salePrice: 34900, price: 39900, quantity: 2 }], opts);
    expect(s.subtotal).toBe(69800);
    expect(s.promoSavings).toBe(10000);
    expect(s.shipping).toBe(7900);
    expect(s.total).toBe(77700);
    expect(s.amountToFreeShipping).toBe(30100);
    expect(s.gstIncluded).toBe(10647); // 69800 × 18 / 118 = 10647.46
  });

  it("ships free at or above the threshold", () => {
    const s = summarizeCart([{ salePrice: 99900, price: 99900, quantity: 1 }], opts);
    expect(s.shipping).toBe(0);
    expect(s.amountToFreeShipping).toBe(0);
    expect(s.total).toBe(99900);
  });

  it("counts the coupon against the threshold and the GST base", () => {
    const s = summarizeCart([{ salePrice: 109900, price: 109900, quantity: 1 }], { ...opts, couponDiscount: 20000 });
    expect(s.couponDiscount).toBe(20000);
    expect(s.shipping).toBe(7900); // goods 89,900 < 99,900
    expect(s.total).toBe(97800);
    expect(s.gstIncluded).toBe(13714); // 89900 × 18 / 118 = 13713.56
  });

  it("never discounts more than the subtotal", () => {
    const s = summarizeCart([{ salePrice: 50000, price: 50000, quantity: 1 }], { ...opts, couponDiscount: 200000 });
    expect(s.couponDiscount).toBe(50000);
    expect(s.total).toBe(7900);
  });
});
