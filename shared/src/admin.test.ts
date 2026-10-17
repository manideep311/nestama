import { describe, expect, it } from "vitest";
import { adminProductInputSchema, couponInputSchema, promotionInputSchema, settingsInputSchema } from "./admin";

const variant = { sku: "ab-1", label: "Medium", price: 99900, mrp: 129900, stock: 10, isDefault: true };
const product = {
  name: "Trail Harness",
  description: "A padded harness for long walks and adventures.",
  petType: "DOG",
  categoryId: "c1",
  brandId: "b1",
  variants: [variant],
  images: [{ url: "/uploads/abc.webp", alt: "Harness on a dog", width: 800, height: 800 }],
};

describe("adminProductInputSchema", () => {
  it("accepts a valid product and normalises SKUs, tags and the slug", () => {
    const p = adminProductInputSchema.parse({ ...product, slug: "", tags: ["Walk", "walk", " Dog "] });
    expect(p.variants[0]!.sku).toBe("AB-1");
    expect(p.tags).toEqual(["walk", "dog"]);
    expect(p.slug).toBeUndefined();
  });

  it("rejects an MRP below the selling price", () => {
    const r = adminProductInputSchema.safeParse({ ...product, variants: [{ ...variant, mrp: 50000 }] });
    expect(r.success).toBe(false);
  });

  it("needs exactly one default option and unique SKUs", () => {
    const two = adminProductInputSchema.safeParse({ ...product, variants: [variant, { ...variant, sku: "ab-2" }] });
    expect(two.success).toBe(false);
    const none = adminProductInputSchema.safeParse({ ...product, variants: [{ ...variant, isDefault: false }] });
    expect(none.success).toBe(false);
    const dup = adminProductInputSchema.safeParse({ ...product, variants: [variant, { ...variant, sku: "AB-1", isDefault: false }] });
    expect(dup.success).toBe(false);
  });

  it("only allows uploaded or https images", () => {
    const bad = adminProductInputSchema.safeParse({ ...product, images: [{ ...product.images[0]!, url: "http://example.com/x.jpg" }] });
    expect(bad.success).toBe(false);
  });
});

describe("promotionInputSchema", () => {
  const promo = {
    name: "Winter warmers",
    headline: "Cosy beds 20% off",
    discountPercent: 20,
    startsAt: "2026-10-20T00:00:00.000Z",
    endsAt: "2026-10-27T00:00:00.000Z",
  };

  it("accepts a valid window and defaults the rest", () => {
    expect(promotionInputSchema.parse(promo)).toMatchObject({ scope: "ALL", placement: "NONE", theme: "peach", ctaHref: "/offers" });
  });

  it("rejects an end before the start, out-of-range percent and external links", () => {
    expect(promotionInputSchema.safeParse({ ...promo, endsAt: promo.startsAt }).success).toBe(false);
    expect(promotionInputSchema.safeParse({ ...promo, discountPercent: 95 }).success).toBe(false);
    expect(promotionInputSchema.safeParse({ ...promo, ctaHref: "https://evil.example" }).success).toBe(false);
  });

  it("requires targets for scoped promotions", () => {
    expect(promotionInputSchema.safeParse({ ...promo, scope: "CATEGORIES" }).success).toBe(false);
    expect(promotionInputSchema.safeParse({ ...promo, scope: "CATEGORIES", categoryIds: ["c1"] }).success).toBe(true);
  });
});

describe("couponInputSchema", () => {
  const coupon = { code: "paws15", type: "PERCENT", value: 15, startsAt: "2026-10-20T00:00:00Z", endsAt: "2026-11-20T00:00:00Z" };

  it("uppercases the code and validates the value by type", () => {
    expect(couponInputSchema.parse(coupon).code).toBe("PAWS15");
    expect(couponInputSchema.safeParse({ ...coupon, value: 95 }).success).toBe(false);
    expect(couponInputSchema.safeParse({ ...coupon, type: "FIXED", value: 50 }).success).toBe(false);
    expect(couponInputSchema.safeParse({ ...coupon, type: "FIXED", value: 15000 }).success).toBe(true);
    expect(couponInputSchema.safeParse({ ...coupon, code: "A B" }).success).toBe(false);
  });
});

describe("settingsInputSchema", () => {
  it("de-duplicates popular searches and validates the support email", () => {
    const base = {
      freeShippingThreshold: 99900,
      flatShippingFee: 7900,
      gstRatePercent: 18,
      heroHeadline: "Happy Pets.",
      heroSubcopy: "",
      heroImageUrl: "https://images.unsplash.com/photo-1",
      heroImageAlt: "",
      popularSearches: ["Dog beds", "Dog beds", "Cat toys"],
      supportEmail: "hello@nestama.test",
      supportPhone: "1800-NESTAMA",
    };
    expect(settingsInputSchema.parse(base).popularSearches).toEqual(["Dog beds", "Cat toys"]);
    expect(settingsInputSchema.safeParse({ ...base, supportEmail: "nope" }).success).toBe(false);
  });
});
