import type { ListingFacets, ProductCardDTO, ProductListQuery, ProductSort } from "@nestama/shared";

// Pure listing logic: filtering on *effective* prices (after promotions), sorting and facets.
// The catalog is loaded and priced once per request; at thousands of products this moves into
// SQL with a materialised sale price, but the rules below stay the same.

export interface ListingMeta {
  brandSlug: string;
  brandName: string;
  categorySlug: string;
  categoryName: string;
  parentSlug: string | null;
  parentName: string | null;
  soldCount: number;
  publishedAt: number;
  isFeatured: boolean;
  /** Lower-cased name, brand, category and tags. */
  searchText: string;
}

export interface ListingItem {
  card: ProductCardDTO;
  meta: ListingMeta;
}

type Dimension = "brand" | "price" | "category" | "onSale";

export function filterItems(items: ListingItem[], q: ProductListQuery, ignore?: Dimension): ListingItem[] {
  const words = q.q ? q.q.toLowerCase().split(/\s+/).filter(Boolean) : [];
  const brands = q.brand && ignore !== "brand" ? new Set(q.brand) : null;
  const min = q.minPrice !== undefined && ignore !== "price" ? q.minPrice * 100 : null;
  const max = q.maxPrice !== undefined && ignore !== "price" ? q.maxPrice * 100 : null;

  return items.filter(({ card, meta }) => {
    if (q.pet && card.petType !== "BOTH" && card.petType !== (q.pet === "dog" ? "DOG" : "CAT")) return false;
    if (q.category && ignore !== "category" && meta.categorySlug !== q.category && meta.parentSlug !== q.category) return false;
    if (brands && !brands.has(meta.brandSlug)) return false;
    if (min !== null && card.pricing.salePrice < min) return false;
    if (max !== null && card.pricing.salePrice > max) return false;
    if (q.rating && card.ratingAvg < q.rating) return false;
    if (q.inStock && card.stock === "OUT_OF_STOCK") return false;
    if (q.onSale && ignore !== "onSale" && card.pricing.discountPercent <= 0) return false;
    if (words.length && !words.every((w) => meta.searchText.includes(w))) return false;
    return true;
  });
}

const byName = (a: ListingItem, b: ListingItem) => a.card.name.localeCompare(b.card.name);
const soldOutLast = (a: ListingItem, b: ListingItem) => Number(a.card.stock === "OUT_OF_STOCK") - Number(b.card.stock === "OUT_OF_STOCK");

export function sortItems(items: ListingItem[], sort: ProductSort): ListingItem[] {
  const list = [...items];
  switch (sort) {
    case "price-asc":
      return list.sort((a, b) => a.card.pricing.salePrice - b.card.pricing.salePrice || byName(a, b));
    case "price-desc":
      return list.sort((a, b) => b.card.pricing.salePrice - a.card.pricing.salePrice || byName(a, b));
    case "rating":
      return list.sort(
        (a, b) => soldOutLast(a, b) || b.card.ratingAvg - a.card.ratingAvg || b.card.ratingCount - a.card.ratingCount || byName(a, b),
      );
    case "newest":
      return list.sort((a, b) => soldOutLast(a, b) || b.meta.publishedAt - a.meta.publishedAt || byName(a, b));
    case "bestselling":
      return list.sort((a, b) => soldOutLast(a, b) || b.meta.soldCount - a.meta.soldCount || byName(a, b));
    case "featured":
      return list.sort(
        (a, b) =>
          soldOutLast(a, b) || Number(b.meta.isFeatured) - Number(a.meta.isFeatured) || b.meta.soldCount - a.meta.soldCount || byName(a, b),
      );
  }
}

function countBy(items: ListingItem[], key: (i: ListingItem) => { slug: string; name: string }) {
  const map = new Map<string, { slug: string; name: string; count: number }>();
  for (const i of items) {
    const k = key(i);
    const entry = map.get(k.slug) ?? { ...k, count: 0 };
    entry.count++;
    map.set(k.slug, entry);
  }
  return [...map.values()].sort((a, b) => b.count - a.count || a.name.localeCompare(b.name));
}

/** Each facet ignores its own filter, so shoppers can see (and widen to) the alternatives. */
export function buildFacets(items: ListingItem[], q: ProductListQuery): ListingFacets {
  const brandPool = filterItems(items, q, "brand");
  const brands = countBy(brandPool, (i) => ({ slug: i.meta.brandSlug, name: i.meta.brandName }));
  for (const slug of q.brand ?? []) {
    if (!brands.some((b) => b.slug === slug)) {
      const known = items.find((i) => i.meta.brandSlug === slug);
      if (known) brands.push({ slug, name: known.meta.brandName, count: 0 });
    }
  }

  const categoryPool = filterItems(items, q, "category");
  const categories = countBy(categoryPool, (i) => ({ slug: i.meta.categorySlug, name: i.meta.categoryName }));

  const pricePool = filterItems(items, q, "price").map((i) => i.card.pricing.salePrice);
  const price = pricePool.length ? { min: Math.min(...pricePool), max: Math.max(...pricePool) } : { min: 0, max: 0 };

  const onSaleCount = filterItems(items, q, "onSale").filter((i) => i.card.pricing.discountPercent > 0).length;

  return { brands, categories, price, onSaleCount };
}
