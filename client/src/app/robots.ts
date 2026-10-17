import type { MetadataRoute } from "next";
import { SITE_URL } from "@/lib/site";

export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: "*",
      allow: "/",
      // Private, per-shopper or operational pages have nothing for search engines.
      disallow: ["/admin", "/account", "/cart", "/checkout", "/orders", "/api"],
    },
    sitemap: `${SITE_URL}/sitemap.xml`,
  };
}
