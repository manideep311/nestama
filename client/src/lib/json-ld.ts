import type { ProductDetailDTO, StockStatus } from "@nestama/shared";

const AVAILABILITY: Record<StockStatus, string> = {
  IN_STOCK: "https://schema.org/InStock",
  LOW_STOCK: "https://schema.org/LimitedAvailability",
  OUT_OF_STOCK: "https://schema.org/OutOfStock",
};

/**
 * schema.org Product data for a product page, serialized for a `<script type="application/ld+json">`.
 * `<` is escaped so text from the catalogue can never close the script element.
 */
export function productJsonLd(product: ProductDetailDTO, siteUrl: string): string {
  const base = siteUrl.replace(/\/+$/, "");
  const absolute = (url: string) => (url.startsWith("/") ? `${base}${url}` : url);
  const url = `${base}/products/${product.slug}`;
  const data = {
    "@context": "https://schema.org",
    "@type": "Product",
    name: product.name,
    description: product.shortDescription || product.description,
    image: product.images.map((i) => absolute(i.url)),
    brand: { "@type": "Brand", name: product.brand },
    url,
    offers: product.variants.map((v) => ({
      "@type": "Offer",
      sku: v.sku,
      price: (v.pricing.salePrice / 100).toFixed(2),
      priceCurrency: "INR",
      availability: AVAILABILITY[v.stock],
      itemCondition: "https://schema.org/NewCondition",
      url,
    })),
    ...(product.ratingCount > 0 && {
      aggregateRating: { "@type": "AggregateRating", ratingValue: product.ratingAvg, reviewCount: product.ratingCount },
    }),
  };
  return JSON.stringify(data).replace(/</g, "\\u003c");
}
