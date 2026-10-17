/** The storefront's public origin (no trailing slash), used for canonical URLs, sitemaps and structured data. */
export const SITE_URL = (process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000").replace(/\/+$/, "");
