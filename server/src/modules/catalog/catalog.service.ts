import { formatINR } from "@nestama/shared";
import type {
  CategoryDTO,
  Paginated,
  ProductCardDTO,
  ProductDetailDTO,
  ProductListQuery,
  ProductListResponse,
  PromotionDTO,
  SearchResultDTO,
} from "@nestama/shared";
import { env } from "../../config/env";
import { hybridRank } from "../../lib/hybrid-rank";
import { prisma } from "../../lib/prisma";
import { notFound } from "../../lib/errors";
import type { PromotionRule } from "../../lib/pricing";
import type { Prisma } from "../../generated/prisma/client";
import { promotionFor, toProductCardDTO, toVariantDTO } from "./product-mapper";
import { buildFacets, filterItems, sortItems, type ListingItem } from "./listing";
import { semanticCandidates } from "./semantic";

// ───────────── Shared query shapes ─────────────

export const productCardInclude = {
  brand: { select: { name: true, slug: true } },
  category: { select: { id: true, slug: true, name: true, parentId: true, parent: { select: { slug: true, name: true } } } },
  images: { orderBy: { sortOrder: "asc" }, select: { url: true, alt: true, width: true, height: true } },
  variants: {
    orderBy: { sortOrder: "asc" },
    select: {
      id: true,
      sku: true,
      label: true,
      options: true,
      price: true,
      mrp: true,
      stock: true,
      lowStockThreshold: true,
      isDefault: true,
    },
  },
} satisfies Prisma.ProductInclude;

type ProductRow = Prisma.ProductGetPayload<{ include: typeof productCardInclude }>;

const promotionInclude = {
  categories: { select: { id: true } },
  products: { select: { id: true } },
  coupon: { select: { code: true, type: true, value: true } },
} satisfies Prisma.PromotionInclude;

type PromotionRow = Prisma.PromotionGetPayload<{ include: typeof promotionInclude }>;

// ───────────── Promotions ─────────────

export function couponLabel(c: { type: "PERCENT" | "FIXED"; value: number }): string {
  return c.type === "PERCENT" ? `${c.value}% off` : `${formatINR(c.value)} off`;
}

export async function loadLivePromotions(now: Date): Promise<PromotionRow[]> {
  return prisma.promotion.findMany({
    where: { isActive: true, startsAt: { lte: now }, endsAt: { gt: now } },
    include: promotionInclude,
    orderBy: { sortOrder: "asc" },
  });
}

export function toPromotionRule(p: PromotionRow): PromotionRule {
  return {
    id: p.id,
    slug: p.slug,
    name: p.name,
    discountPercent: p.discountPercent,
    startsAt: p.startsAt,
    endsAt: p.endsAt,
    isActive: p.isActive,
    scope: p.scope,
    categoryIds: p.categories.map((c) => c.id),
    productIds: p.products.map((pr) => pr.id),
  };
}

export function toPromotionDTO(p: PromotionRow): PromotionDTO {
  return {
    id: p.id,
    slug: p.slug,
    name: p.name,
    headline: p.headline,
    subheadline: p.subheadline,
    discountPercent: p.discountPercent,
    startsAt: p.startsAt.toISOString(),
    endsAt: p.endsAt.toISOString(),
    placement: p.placement,
    coupon: p.coupon ? { code: p.coupon.code, label: couponLabel(p.coupon) } : null,
    image: p.imageUrl ? { url: p.imageUrl, alt: p.imageAlt ?? "" } : null,
    ctaLabel: p.ctaLabel,
    ctaHref: p.ctaHref,
    theme: p.theme,
  };
}

// ───────────── Products ─────────────

/** Builds the pure listing items (priced card + filter/sort metadata) for every active product. */
async function listingItems(now: Date): Promise<ListingItem[]> {
  const { cards, rows } = await allProductCards(now);
  return cards.map((card, i) => {
    const row = rows[i]!;
    return {
      card,
      meta: {
        brandSlug: row.brand.slug,
        brandName: row.brand.name,
        categorySlug: row.category.slug,
        categoryName: row.category.name,
        parentSlug: row.category.parent?.slug ?? null,
        parentName: row.category.parent?.name ?? null,
        soldCount: row.soldCount,
        publishedAt: row.publishedAt.getTime(),
        isFeatured: row.isFeatured,
        searchText: [
          row.name,
          row.brand.name,
          row.category.name,
          row.category.parent?.name ?? "",
          ...row.tags,
          row.petType === "CAT" ? "cat kitten" : row.petType === "DOG" ? "dog puppy" : "dog cat",
        ]
          .join(" ")
          .toLowerCase(),
      },
    };
  });
}

export async function listProducts(query: ProductListQuery, now = new Date()): Promise<ProductListResponse> {
  const items = await listingItems(now);
  const matching = sortItems(filterItems(items, query), query.sort);
  const { page, pageSize } = query;
  return {
    ...paginate(
      matching.slice((page - 1) * pageSize, page * pageSize).map((i) => i.card),
      matching.length,
      page,
      pageSize,
    ),
    facets: buildFacets(items, query),
  };
}

/** Keyword matches, best first (name prefix > name contains > anything else, then best sellers). */
function keywordMatches(items: ListingItem[], q: string): ListingItem[] {
  const needle = q.toLowerCase();
  const rank = (i: ListingItem) => {
    const name = i.card.name.toLowerCase();
    return name.startsWith(needle) ? 0 : name.includes(needle) ? 1 : 2;
  };
  return filterItems(items, { q, sort: "featured", page: 1, pageSize: 6 }).sort(
    (a, b) => rank(a) - rank(b) || b.meta.soldCount - a.meta.soldCount,
  );
}

let warnedSemantic = false;

/**
 * The header search's ranking: keyword matches blended with semantic similarity (see
 * `hybridRank`). If the vector query fails (say the model couldn't be downloaded), it falls back
 * to keyword order. Exported for the search evaluation (`pnpm --filter server eval:search`).
 */
export async function rankSearch(
  q: string,
  options: { weight?: number; minSimilarity?: number; limit?: number } = {},
  now = new Date(),
): Promise<ListingItem[]> {
  const { weight = env.SEARCH_SEMANTIC_WEIGHT, minSimilarity = env.SEARCH_MIN_SIMILARITY, limit = 6 } = options;
  const items = await listingItems(now);
  const keyword = keywordMatches(items, q);
  if (weight <= 0) return keyword.slice(0, limit);

  const byId = new Map(items.map((i) => [i.card.id, i]));
  const semantic = await semanticCandidates(q).catch((err: unknown) => {
    if (!warnedSemantic)
      console.warn("[search] Semantic search unavailable, using keywords only:", err instanceof Error ? err.message : err);
    warnedSemantic = true;
    return [];
  });
  return hybridRank(
    keyword.map((i) => i.card.id),
    semantic.filter((s) => byId.has(s.id)), // only products the storefront lists
    { weight, minSimilarity, limit },
  ).map((id) => byId.get(id)!);
}

/** Header search: products (see `rankSearch`) plus categories whose name matches. */
export async function searchCatalog(q: string, now = new Date()): Promise<SearchResultDTO> {
  const products = (await rankSearch(q, {}, now)).map((i) => i.card);
  const needle = q.toLowerCase();

  const categories = (await prisma.category.findMany({ orderBy: { sortOrder: "asc" }, select: { slug: true, name: true } }))
    .filter(
      (c) => c.name.toLowerCase().includes(needle) || needle.split(/\s+/).some((w) => w.length > 2 && c.name.toLowerCase().includes(w)),
    )
    .slice(0, 4);

  return { query: q, products, categories };
}

function paginate<T>(items: T[], total: number, page: number, pageSize: number): Paginated<T> {
  return { items, total, page, pageSize, totalPages: Math.max(1, Math.ceil(total / pageSize)) };
}

/** All active products as cards — used by the homepage to build its sections in one query. */
export async function allProductCards(now = new Date()): Promise<{ cards: ProductCardDTO[]; rows: ProductRow[]; promos: PromotionRow[] }> {
  const [rows, promos] = await Promise.all([
    prisma.product.findMany({ where: { isActive: true }, include: productCardInclude }),
    loadLivePromotions(now),
  ]);
  const rules = promos.map(toPromotionRule);
  return { cards: rows.map((r) => toProductCardDTO(r, rules, now)), rows, promos };
}

export async function getProductBySlug(slug: string, now = new Date()): Promise<ProductDetailDTO> {
  const row = await prisma.product.findFirst({
    where: { slug, isActive: true },
    include: {
      ...productCardInclude,
      category: { select: { id: true, slug: true, name: true, parentId: true, parent: { select: { slug: true, name: true } } } },
    },
  });
  if (!row) throw notFound("Product");

  const rules = (await loadLivePromotions(now)).map(toPromotionRule);
  const card = toProductCardDTO(row, rules, now);
  const promo = promotionFor(row, rules, now);
  const specs = Array.isArray(row.specs) ? (row.specs as { label: string; value: string }[]) : [];

  return {
    ...card,
    shortDescription: row.shortDescription,
    description: row.description,
    specs,
    tags: row.tags,
    images: row.images,
    variants: row.variants.map((v) => toVariantDTO(v, promo)),
    brandSlug: row.brand.slug,
    categoryTrail: [...(row.category.parent ? [row.category.parent] : []), { slug: row.category.slug, name: row.category.name }],
  };
}

export async function getRelatedProducts(slug: string, limit = 8, now = new Date()): Promise<ProductCardDTO[]> {
  const product = await prisma.product.findFirst({
    where: { slug, isActive: true },
    select: { id: true, categoryId: true, petType: true },
  });
  if (!product) throw notFound("Product");
  const rules = (await loadLivePromotions(now)).map(toPromotionRule);
  const rows = await prisma.product.findMany({
    where: {
      isActive: true,
      id: { not: product.id },
      OR: [{ categoryId: product.categoryId }, { petType: product.petType }],
    },
    include: productCardInclude,
    orderBy: [{ soldCount: "desc" }],
    take: limit * 2,
  });
  // Same category first, then same pet type.
  rows.sort((a, b) => Number(b.categoryId === product.categoryId) - Number(a.categoryId === product.categoryId));
  return rows.slice(0, limit).map((r) => toProductCardDTO(r, rules, now));
}

export async function getProductCardsByIds(ids: string[], now = new Date()): Promise<ProductCardDTO[]> {
  if (ids.length === 0) return [];
  const rules = (await loadLivePromotions(now)).map(toPromotionRule);
  const rows = await prisma.product.findMany({ where: { id: { in: ids }, isActive: true }, include: productCardInclude });
  const byId = new Map(rows.map((r) => [r.id, toProductCardDTO(r, rules, now)]));
  // Preserve the caller's order (e.g. most recently viewed first).
  return ids.map((id) => byId.get(id)).filter((c): c is ProductCardDTO => Boolean(c));
}

// ───────────── Categories ─────────────

export async function listCategories(): Promise<CategoryDTO[]> {
  const [categories, counts] = await Promise.all([
    prisma.category.findMany({ orderBy: { sortOrder: "asc" }, include: { parent: { select: { slug: true } } } }),
    prisma.product.groupBy({ by: ["categoryId"], where: { isActive: true }, _count: { _all: true } }),
  ]);
  const own = new Map(counts.map((c) => [c.categoryId, c._count._all]));
  const total = new Map(categories.map((c) => [c.id, own.get(c.id) ?? 0]));
  for (const c of categories) {
    if (c.parentId) total.set(c.parentId, (total.get(c.parentId) ?? 0) + (own.get(c.id) ?? 0));
  }
  return categories.map((c) => ({
    id: c.id,
    slug: c.slug,
    name: c.name,
    homeLabel: c.homeLabel ?? c.name,
    description: c.description,
    image: { url: c.imageUrl, alt: c.imageAlt },
    parentSlug: c.parent?.slug ?? null,
    productCount: total.get(c.id) ?? 0,
    showOnHome: c.showOnHome,
  }));
}

export async function getCategoryBySlug(slug: string): Promise<CategoryDTO> {
  const category = (await listCategories()).find((c) => c.slug === slug);
  if (!category) throw notFound("Category");
  return category;
}
