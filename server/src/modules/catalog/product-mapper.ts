import type { ImageDTO, PriceDTO, ProductCardDTO, StockStatus, VariantDTO } from "@nestama/shared";
import { priceVariant, selectBestPromotion, type PricedVariant, type PromotionRule } from "../../lib/pricing";

/** The slice of a product row (with relations) the mappers need. Matches `productCardInclude`. */
export interface ProductForCard {
  id: string;
  slug: string;
  name: string;
  petType: "DOG" | "CAT" | "BOTH";
  isSample: boolean;
  ratingAvg: number;
  ratingCount: number;
  brand: { name: string };
  category: { id: string; slug: string; name: string; parentId: string | null };
  images: ImageDTO[];
  variants: VariantForPricing[];
}

export interface VariantForPricing {
  id: string;
  price: number;
  mrp: number | null;
  stock: number;
  lowStockThreshold: number;
  isDefault: boolean;
}

export function variantStockStatus(v: { stock: number; lowStockThreshold: number }): StockStatus {
  if (v.stock <= 0) return "OUT_OF_STOCK";
  if (v.stock <= v.lowStockThreshold) return "LOW_STOCK";
  return "IN_STOCK";
}

export function toPriceDTO(p: PricedVariant): PriceDTO {
  return {
    price: p.price,
    salePrice: p.salePrice,
    referencePrice: p.referencePrice,
    discountPercent: p.discountPercent,
    promotion: p.promotion ? { slug: p.promotion.slug, name: p.promotion.name, endsAt: p.promotion.endsAt.toISOString() } : null,
  };
}

/** The variant a card represents: the default if it's in stock, otherwise the first in-stock one. */
export function pickCardVariant<V extends VariantForPricing>(variants: V[]): V {
  const fallback = variants.find((v) => v.isDefault) ?? variants[0];
  if (!fallback) throw new Error("Product has no variants");
  if (fallback.stock > 0) return fallback;
  return variants.find((v) => v.stock > 0) ?? fallback;
}

export function promotionFor(p: ProductForCard, promos: PromotionRule[], now: Date): PromotionRule | null {
  return selectBestPromotion(
    promos,
    {
      productId: p.id,
      categoryId: p.category.id,
      categoryAncestorIds: p.category.parentId ? [p.category.parentId] : [],
    },
    now,
  );
}

export function toProductCardDTO(p: ProductForCard, promos: PromotionRule[], now: Date): ProductCardDTO {
  const variant = pickCardVariant(p.variants);
  const promo = promotionFor(p, promos, now);
  const allSoldOut = p.variants.every((v) => v.stock <= 0);
  const [image, hoverImage] = p.images;
  if (!image) throw new Error(`Product ${p.slug} has no images`);

  return {
    id: p.id,
    slug: p.slug,
    name: p.name,
    brand: p.brand.name,
    petType: p.petType,
    category: { slug: p.category.slug, name: p.category.name },
    image,
    hoverImage: hoverImage ?? null,
    defaultVariantId: variant.id,
    pricing: toPriceDTO(priceVariant(variant, promo)),
    ratingAvg: p.ratingAvg,
    ratingCount: p.ratingCount,
    stock: allSoldOut ? "OUT_OF_STOCK" : variantStockStatus(variant),
    isSample: p.isSample,
  };
}

export function toVariantDTO(
  v: VariantForPricing & { sku: string; label: string; options: unknown },
  promo: PromotionRule | null,
): VariantDTO {
  return {
    id: v.id,
    sku: v.sku,
    label: v.label,
    options: (v.options ?? {}) as Record<string, string>,
    pricing: toPriceDTO(priceVariant(v, promo)),
    stock: variantStockStatus(v),
    available: Math.max(0, Math.min(v.stock, 99)),
  };
}
