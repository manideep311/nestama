import { describe, expect, it } from "vitest";
import type { ProductDetailDTO } from "@nestama/shared";
import { productJsonLd } from "./json-ld";

const price = (sale: number, regular = sale) => ({
  price: regular,
  salePrice: sale,
  referencePrice: sale < regular ? regular : null,
  discountPercent: 0,
  promotion: null,
});

const product = {
  id: "p1",
  slug: "cosy-bed",
  name: 'Cosy Bed </script><script>alert("x")</script>',
  brand: "Nestama Home",
  shortDescription: "A soft bed.",
  description: "Long description.",
  image: { url: "https://images.unsplash.com/photo-1", alt: "Bed" },
  images: [
    { url: "https://images.unsplash.com/photo-1", alt: "Bed" },
    { url: "/uploads/2026-10/a.png", alt: "Bed side" },
  ],
  ratingAvg: 4.6,
  ratingCount: 12,
  variants: [
    { id: "v1", sku: "NH-BED-M", label: "M", options: {}, pricing: price(149900, 199900), stock: "IN_STOCK", available: 10 },
    { id: "v2", sku: "NH-BED-L", label: "L", options: {}, pricing: price(249900), stock: "OUT_OF_STOCK", available: 0 },
  ],
} as unknown as ProductDetailDTO;

describe("productJsonLd", () => {
  it("never lets product text close the script tag", () => {
    const out = productJsonLd(product, "https://nestama.example");
    expect(out).not.toContain("</script>");
    expect(out).not.toContain("<");
    expect(JSON.parse(out).name).toBe(product.name);
  });

  it("describes the product, its offers and rating for search engines", () => {
    const data = JSON.parse(productJsonLd(product, "https://nestama.example/"));
    expect(data).toMatchObject({
      "@context": "https://schema.org",
      "@type": "Product",
      name: product.name,
      description: "A soft bed.",
      brand: { "@type": "Brand", name: "Nestama Home" },
      aggregateRating: { "@type": "AggregateRating", ratingValue: 4.6, reviewCount: 12 },
    });
    expect(data.image).toEqual(["https://images.unsplash.com/photo-1", "https://nestama.example/uploads/2026-10/a.png"]);
    expect(data.offers).toEqual([
      expect.objectContaining({
        "@type": "Offer",
        sku: "NH-BED-M",
        price: "1499.00",
        priceCurrency: "INR",
        availability: "https://schema.org/InStock",
        url: "https://nestama.example/products/cosy-bed",
      }),
      expect.objectContaining({ sku: "NH-BED-L", price: "2499.00", availability: "https://schema.org/OutOfStock" }),
    ]);
  });

  it("omits the rating when there are no reviews", () => {
    expect(JSON.parse(productJsonLd({ ...product, ratingCount: 0 }, "https://nestama.example")).aggregateRating).toBeUndefined();
  });
});
