import { describe, it, expect } from "vitest";
import { toProductCardDTO, variantStockStatus, type ProductForCard } from "./product-mapper";
import { priceVariant, type PromotionRule } from "../../lib/pricing";

const now = new Date("2026-10-10T12:00:00Z");

const toysPromo: PromotionRule = {
  id: "promo-toys",
  slug: "toys",
  name: "Toys",
  discountPercent: 15,
  startsAt: new Date("2026-10-01T00:00:00Z"),
  endsAt: new Date("2026-10-20T00:00:00Z"),
  isActive: true,
  scope: "CATEGORIES",
  categoryIds: ["cat-toys"],
  productIds: [],
};

function fixture(overrides: Partial<ProductForCard> = {}): ProductForCard {
  return {
    id: "p1",
    slug: "rope-toy",
    name: "Rope Toy",
    petType: "DOG",
    isSample: true,
    ratingAvg: 4.6,
    ratingCount: 120,
    brand: { name: "Tug Theory" },
    category: { id: "cat-toys", slug: "toys", name: "Toys", parentId: null },
    images: [
      { url: "https://img/1", alt: "first", width: 1000, height: 1500 },
      { url: "https://img/2", alt: "second", width: 1000, height: 1000 },
    ],
    variants: [
      { id: "v1", price: 39900, mrp: 49900, stock: 3, lowStockThreshold: 5, isDefault: true },
      { id: "v2", price: 54900, mrp: 64900, stock: 40, lowStockThreshold: 5, isDefault: false },
    ],
    ...overrides,
  };
}

describe("toProductCardDTO", () => {
  it("prices the default variant through the pricing rules", () => {
    const dto = toProductCardDTO(fixture(), [toysPromo], now);
    const expected = priceVariant({ price: 39900, mrp: 49900 }, toysPromo);
    expect(dto.pricing.salePrice).toBe(expected.salePrice);
    expect(dto.pricing.referencePrice).toBe(expected.referencePrice);
    expect(dto.pricing.discountPercent).toBe(15);
    expect(dto.pricing.promotion).toEqual({ slug: "toys", name: "Toys", endsAt: "2026-10-20T00:00:00.000Z" });
  });

  it("uses the first image as the main image and the second as the hover image", () => {
    const dto = toProductCardDTO(fixture(), [], now);
    expect(dto.image.url).toBe("https://img/1");
    expect(dto.hoverImage?.url).toBe("https://img/2");
    expect(toProductCardDTO(fixture({ images: [fixture().images[0]!] }), [], now).hoverImage).toBeNull();
  });

  it("reports LOW_STOCK when the default variant is at or under its threshold", () => {
    expect(toProductCardDTO(fixture(), [], now).stock).toBe("LOW_STOCK");
  });

  it("falls back to an in-stock variant when the default is sold out", () => {
    const f = fixture();
    f.variants[0]!.stock = 0;
    const dto = toProductCardDTO(f, [], now);
    expect(dto.defaultVariantId).toBe("v2");
    expect(dto.stock).toBe("IN_STOCK");
  });

  it("reports OUT_OF_STOCK when every variant is at zero", () => {
    const f = fixture();
    f.variants.forEach((v) => (v.stock = 0));
    const dto = toProductCardDTO(f, [], now);
    expect(dto.stock).toBe("OUT_OF_STOCK");
    expect(dto.defaultVariantId).toBe("v1");
  });

  it("applies category promotions to child categories via the parent", () => {
    const accessoriesPromo: PromotionRule = { ...toysPromo, categoryIds: ["cat-accessories"] };
    const collar = fixture({ category: { id: "cat-collars", slug: "collars", name: "Collars", parentId: "cat-accessories" } });
    expect(toProductCardDTO(collar, [accessoriesPromo], now).pricing.discountPercent).toBe(15);
  });
});

describe("variantStockStatus", () => {
  it("classifies stock levels", () => {
    expect(variantStockStatus({ stock: 0, lowStockThreshold: 5 })).toBe("OUT_OF_STOCK");
    expect(variantStockStatus({ stock: 5, lowStockThreshold: 5 })).toBe("LOW_STOCK");
    expect(variantStockStatus({ stock: 6, lowStockThreshold: 5 })).toBe("IN_STOCK");
  });
});
