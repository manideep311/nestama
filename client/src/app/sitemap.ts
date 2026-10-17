import type { MetadataRoute } from "next";
import { getAllProductSlugs, getCategories } from "@/lib/catalog";
import { SITE_URL } from "@/lib/site";

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const pages: MetadataRoute.Sitemap = [
    { url: `${SITE_URL}/`, changeFrequency: "daily", priority: 1 },
    { url: `${SITE_URL}/shop`, changeFrequency: "daily", priority: 0.8 },
    { url: `${SITE_URL}/offers`, changeFrequency: "daily", priority: 0.7 },
  ];
  // The catalogue comes from the API; if it's unreachable the sitemap still lists the main pages.
  const [categories, slugs] = await Promise.all([getCategories().catch(() => []), getAllProductSlugs().catch(() => [])]);
  return [
    ...pages,
    ...categories.map((c) => ({ url: `${SITE_URL}/c/${c.slug}`, changeFrequency: "weekly" as const, priority: 0.7 })),
    ...slugs.map((slug) => ({ url: `${SITE_URL}/products/${slug}`, changeFrequency: "weekly" as const, priority: 0.6 })),
  ];
}
