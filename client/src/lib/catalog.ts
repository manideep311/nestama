import "server-only";
import { cacheLife, cacheTag } from "next/cache";
import type {
  CategoryDTO,
  HomeDTO,
  ProductCardDTO,
  ProductDetailDTO,
  ProductListResponse,
  PromotionDTO,
  ReviewListDTO,
  StoreSettingsPublicDTO,
} from "@nestama/shared";
import { ApiError, apiGet } from "./api";

// Public catalog reads use the built-in `minutes` profile (stale 5 min, revalidate 1 min, expire 1 h).
// A stale window of at least 5 minutes keeps this data in the App Shell, so navigations stay instant.
// Prices shown here are display-only; the API re-prices everything at cart and checkout.

export async function getHome(): Promise<HomeDTO> {
  "use cache";
  cacheLife("minutes");
  cacheTag("catalog", "home");
  return apiGet<HomeDTO>("/home");
}

export async function getStoreSettings(): Promise<StoreSettingsPublicDTO> {
  "use cache";
  cacheLife("minutes");
  cacheTag("catalog", "settings");
  return apiGet<StoreSettingsPublicDTO>("/settings/public");
}

export async function getActivePromotions(): Promise<PromotionDTO[]> {
  "use cache";
  cacheLife("minutes");
  cacheTag("catalog", "promotions");
  return apiGet<PromotionDTO[]>("/promotions/active");
}

export async function getListing(queryString: string): Promise<ProductListResponse> {
  "use cache";
  cacheLife("minutes");
  cacheTag("catalog", "listing");
  return apiGet<ProductListResponse>(`/products${queryString ? `?${queryString}` : ""}`);
}

export async function getCategories(): Promise<CategoryDTO[]> {
  "use cache";
  cacheLife("hours");
  cacheTag("catalog", "categories");
  return apiGet<CategoryDTO[]>("/categories");
}

export async function getProduct(slug: string): Promise<ProductDetailDTO | null> {
  "use cache";
  cacheLife("minutes");
  cacheTag("catalog", `product-${slug}`);
  try {
    return await apiGet<ProductDetailDTO>(`/products/${encodeURIComponent(slug)}`);
  } catch (err) {
    if (err instanceof ApiError && err.status === 404) return null;
    throw err;
  }
}

export async function getRelatedProducts(slug: string): Promise<ProductCardDTO[]> {
  "use cache";
  cacheLife("minutes");
  cacheTag("catalog", `product-${slug}`);
  return apiGet<ProductCardDTO[]>(`/products/${encodeURIComponent(slug)}/related`);
}

/** Every active product slug (for generateStaticParams). */
export async function getAllProductSlugs(): Promise<string[]> {
  "use cache";
  cacheLife("hours");
  cacheTag("catalog", "listing");
  const slugs: string[] = [];
  for (let page = 1; page <= 20; page++) {
    const res = await apiGet<ProductListResponse>(`/products?pageSize=48&page=${page}&sort=newest`);
    slugs.push(...res.items.map((p) => p.slug));
    if (page >= res.totalPages) break;
  }
  return slugs;
}

export async function getReviews(slug: string, page = 1): Promise<ReviewListDTO> {
  "use cache";
  cacheLife("minutes");
  cacheTag("catalog", `reviews-${slug}`);
  return apiGet<ReviewListDTO>(`/products/${encodeURIComponent(slug)}/reviews?page=${page}`);
}
