import { describe, it, expect } from "vitest";
import { productListQuerySchema, type ProductCardDTO } from "@nestama/shared";
import { buildFacets, filterItems, sortItems, type ListingItem } from "./listing";

function item(
  id: string,
  o: {
    pet?: ProductCardDTO["petType"];
    brand?: string;
    category?: string;
    parent?: string | null;
    sale?: number;
    price?: number;
    rating?: number;
    sold?: number;
    days?: number;
    featured?: boolean;
    stock?: ProductCardDTO["stock"];
    text?: string;
  } = {},
): ListingItem {
  const price = o.price ?? 50000;
  const sale = o.sale ?? price;
  return {
    card: {
      id,
      slug: id,
      name: `Product ${id}`,
      brand: o.brand ?? "brand-a",
      petType: o.pet ?? "DOG",
      category: { slug: o.category ?? "toys", name: o.category ?? "toys" },
      image: { url: "", alt: "" },
      hoverImage: null,
      defaultVariantId: `${id}-v`,
      pricing: {
        price,
        salePrice: sale,
        referencePrice: sale < price ? price : null,
        discountPercent: sale < price ? Math.round((1 - sale / price) * 100) : 0,
        promotion: null,
      },
      ratingAvg: o.rating ?? 4.5,
      ratingCount: 10,
      stock: o.stock ?? "IN_STOCK",
      isSample: true,
    },
    meta: {
      brandSlug: o.brand ?? "brand-a",
      brandName: (o.brand ?? "brand-a").toUpperCase(),
      categorySlug: o.category ?? "toys",
      categoryName: o.category ?? "toys",
      parentSlug: o.parent ?? null,
      parentName: o.parent ?? null,
      soldCount: o.sold ?? 0,
      publishedAt: Date.UTC(2026, 9, 10) - (o.days ?? 0) * 86400000,
      isFeatured: o.featured ?? false,
      searchText: (o.text ?? `product ${id}`).toLowerCase(),
    },
  };
}

const q = (raw: Record<string, string>) => productListQuerySchema.parse(raw);

const items = [
  item("a", { pet: "DOG", brand: "tug", category: "toys", price: 39900, sale: 33900, rating: 4.7, sold: 50, text: "rope tug toy" }),
  item("b", { pet: "CAT", brand: "whisker", category: "toys", price: 29900, rating: 4.2, sold: 90, text: "feather wand" }),
  item("c", { pet: "BOTH", brand: "tug", category: "collars", parent: "accessories", price: 99900, rating: 4.9, sold: 10, days: 2 }),
  item("d", {
    pet: "DOG",
    brand: "home",
    category: "beds",
    price: 249900,
    sale: 199900,
    rating: 3.9,
    sold: 5,
    stock: "OUT_OF_STOCK",
    featured: true,
  }),
];

const ids = (list: ListingItem[]) => list.map((i) => i.card.id);

describe("filterItems", () => {
  it("filters by pet type including BOTH", () => {
    expect(ids(filterItems(items, q({ pet: "cat" })))).toEqual(["b", "c"]);
  });

  it("matches a category directly or through its parent", () => {
    expect(ids(filterItems(items, q({ category: "accessories" })))).toEqual(["c"]);
    expect(ids(filterItems(items, q({ category: "toys" })))).toEqual(["a", "b"]);
  });

  it("filters by brand list, effective price range (rupees), rating floor, stock and sale", () => {
    expect(ids(filterItems(items, q({ brand: "tug,home" })))).toEqual(["a", "c", "d"]);
    expect(ids(filterItems(items, q({ minPrice: "300", maxPrice: "1000" })))).toEqual(["a", "c"]); // a sells at ₹339
    expect(ids(filterItems(items, q({ rating: "4" })))).toEqual(["a", "b", "c"]);
    expect(ids(filterItems(items, q({ inStock: "1" })))).toEqual(["a", "b", "c"]);
    expect(ids(filterItems(items, q({ onSale: "1" })))).toEqual(["a", "d"]);
  });

  it("requires every search word to match", () => {
    expect(ids(filterItems(items, q({ q: "tug toy" })))).toEqual(["a"]);
    expect(ids(filterItems(items, q({ q: "tug wand" })))).toEqual([]);
  });

  it("can ignore one dimension (for facets)", () => {
    expect(ids(filterItems(items, q({ brand: "whisker", pet: "dog" }), "brand"))).toEqual(["a", "c", "d"]);
  });
});

describe("sortItems", () => {
  it("sorts by effective price both ways", () => {
    expect(ids(sortItems(items, "price-asc"))).toEqual(["b", "a", "c", "d"]);
    expect(ids(sortItems(items, "price-desc"))).toEqual(["d", "c", "a", "b"]);
  });

  it("puts sold-out items last for merchandising sorts", () => {
    expect(ids(sortItems(items, "featured")).at(-1)).toBe("d");
    expect(ids(sortItems(items, "bestselling"))).toEqual(["b", "a", "c", "d"]);
    expect(ids(sortItems(items, "rating"))).toEqual(["c", "a", "b", "d"]);
  });

  it("sorts newest first", () => {
    expect(ids(sortItems(items, "newest"))[0]).toBe("a");
  });
});

describe("buildFacets", () => {
  it("counts brands ignoring the brand filter but honouring the others", () => {
    const f = buildFacets(items, q({ pet: "dog", brand: "tug" }));
    expect(f.brands).toEqual([
      { slug: "tug", name: "TUG", count: 2 },
      { slug: "home", name: "HOME", count: 1 },
    ]);
  });

  it("reports price bounds ignoring the price filter, and the on-sale count", () => {
    const f = buildFacets(items, q({ maxPrice: "500" }));
    expect(f.price).toEqual({ min: 29900, max: 199900 });
    expect(f.onSaleCount).toBe(1); // only "a" is on sale within ≤ ₹500
  });
});
