"use client";

interface LoaderArgs {
  src: string;
  width: number;
  quality?: number;
}

/**
 * Global next/image loader.
 * - Unsplash (imgix): resize via w/q/auto=format query params.
 * - Cloudinary: inject a transformation segment after /upload/.
 * - Local uploads (no Cloudinary configured): not resized; the width only satisfies next/image.
 * - Anything else (SVGs, static assets): served as-is.
 */
export default function imageLoader({ src, width, quality }: LoaderArgs): string {
  const q = quality ?? 75;

  if (src.startsWith("https://images.unsplash.com/")) {
    const url = new URL(src);
    url.searchParams.set("w", String(width));
    url.searchParams.set("q", String(q));
    url.searchParams.set("auto", "format");
    if (!url.searchParams.has("fit")) url.searchParams.set("fit", "crop");
    return url.toString();
  }

  if (src.startsWith("https://res.cloudinary.com/") && src.includes("/upload/")) {
    return src.replace("/upload/", `/upload/f_auto,q_${q},w_${width},c_limit/`);
  }

  if (src.startsWith("/uploads/")) return `${src}?w=${width}`;

  return src;
}
