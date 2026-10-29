import type { NextConfig } from "next";
import { securityHeaders } from "./src/lib/security-headers";

const isDev = process.env.NODE_ENV === "development";
const isHttps = (process.env.NEXT_PUBLIC_SITE_URL ?? "").startsWith("https://");

const nextConfig: NextConfig = {
  cacheComponents: true,
  partialPrefetching: true,
  transpilePackages: ["@nestama/shared"],
  images: {
    // Unsplash and Cloudinary resize on their own CDNs; see src/lib/image-loader.ts.
    loader: "custom",
    loaderFile: "./src/lib/image-loader.ts",
  },
  async headers() {
    // Pages only: proxied /api/* responses carry the API's own headers (its docs page needs a CDN script).
    return [{ source: "/((?!api/).*)", headers: securityHeaders({ dev: isDev, https: isHttps }) }];
  },
  turbopack: {
    rules: {
      "*.css": {
        // Only our own stylesheets: running Tailwind over Next internals (e.g. next/font CSS)
        // rewrites their url() queries and breaks production builds.
        condition: { not: "foreign" },
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
    },
  },
};

export default nextConfig;
