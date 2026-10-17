"use client";

import { useState, ViewTransition, type MouseEvent } from "react";
import Image from "next/image";
import Link from "next/link";
import { useReducedMotion } from "motion/react";
import type { ProductCardDTO } from "@nestama/shared";
import { Rating } from "@/components/ui/Rating";
import { PawBurst } from "@/components/animations/PawBurst";
import { usePetMoment } from "@/components/animations/PetMomentProvider";
import { cn } from "@/lib/cn";
import { PriceTag } from "./PriceTag";
import { StockNote } from "./StockNote";
import { WishlistButton } from "./WishlistButton";
import { AddToCartButton } from "./AddToCartButton";
import { QuickViewButton } from "./QuickView";

export const productCardSizes = "(min-width: 1280px) 290px, (min-width: 1024px) 24vw, (min-width: 640px) 32vw, 48vw";

interface Props {
  product: ProductCardDTO;
  priority?: boolean;
  className?: string;
}

/** Plain primary clicks only — new-tab / modified clicks keep the browser's default behaviour. */
function isPlainClick(e: MouseEvent) {
  return e.button === 0 && !e.metaKey && !e.ctrlKey && !e.shiftKey && !e.altKey && !e.defaultPrevented;
}

/**
 * Product tile. The title link is stretched over the whole card, so the card is one
 * click/Enter target while the wishlist and cart buttons stay separately focusable.
 * Opening a product lifts the card, bursts paw prints and cues the wagging dog — while the
 * navigation itself starts on the same click.
 */
export function ProductCard({ product, priority = false, className }: Props) {
  const soldOut = product.stock === "OUT_OF_STOCK";
  const href = `/products/${product.slug}`;
  const reduce = useReducedMotion();
  const { celebrate } = usePetMoment();
  const [opening, setOpening] = useState(false);
  const [burst, setBurst] = useState(0);

  function onOpen(e: MouseEvent<HTMLAnchorElement>) {
    if (!isPlainClick(e) || reduce) return;
    setOpening(true);
    setBurst((b) => b + 1);
    celebrate();
    // Pages can be restored with their UI state on Back; don't leave the card lifted/named.
    window.setTimeout(() => setOpening(false), 1200);
  }

  return (
    <article
      data-product-card
      className={cn(
        "group relative flex h-full flex-col rounded-3xl border border-line bg-white p-2.5 shadow-card",
        "transition-[transform,box-shadow] duration-300 ease-soft hover:-translate-y-1 hover:shadow-lift",
        "has-[a:focus-visible]:-translate-y-1 has-[a:focus-visible]:shadow-lift",
        opening && "z-20 scale-[1.02] shadow-lift",
        className,
      )}
    >
      {/* Image — named for the shared-element morph only on the card being opened (names must be unique). */}
      <ViewTransition name={opening ? `product-${product.slug}` : undefined} share="morph" default="none">
        <div className="relative aspect-square overflow-hidden rounded-2xl bg-cream-deep">
          <Image
            src={product.image.url}
            alt={product.image.alt}
            fill
            sizes={productCardSizes}
            loading={priority ? "eager" : "lazy"}
            className={cn(
              "object-cover transition-[opacity,transform] duration-500 ease-soft group-hover:scale-[1.04]",
              product.hoverImage && "[@media(hover:hover)]:group-hover:opacity-0",
              soldOut && "grayscale-[0.6]",
            )}
          />
          {product.hoverImage && (
            <Image
              src={product.hoverImage.url}
              alt=""
              fill
              sizes={productCardSizes}
              className="object-cover opacity-0 transition-opacity duration-500 ease-soft [@media(hover:hover)]:group-hover:opacity-100"
            />
          )}

          {product.pricing.discountPercent > 0 && !soldOut && (
            <span className="absolute top-2.5 left-2.5 rounded-lg bg-ember px-2 py-1 text-[11px] leading-none font-extrabold tracking-wide text-white">
              {product.pricing.discountPercent}% OFF
            </span>
          )}
          {soldOut && (
            <span className="absolute top-2.5 left-2.5 rounded-lg bg-charcoal/85 px-2 py-1 text-[11px] leading-none font-extrabold tracking-wide text-white">
              SOLD OUT
            </span>
          )}
        </div>
      </ViewTransition>

      <WishlistButton productId={product.id} productName={product.name} className="absolute top-4 right-4" />
      <QuickViewButton slug={product.slug} productName={product.name} className="absolute top-16 right-4" />
      <PawBurst trigger={burst} count={8} radius={70} className="top-[38%]" />

      {/* Details */}
      <div className="flex flex-1 flex-col px-1.5 pt-3 pb-1">
        <p className="text-xs font-semibold tracking-wide text-muted">{product.brand}</p>
        <h3 className="mt-0.5 line-clamp-2 min-h-[2.6em] text-[15px] leading-[1.3] font-bold text-charcoal">
          <Link
            href={href}
            // Per-link prefetch resolves the product page before the click, so the hero morph pairs.
            prefetch={true}
            onClick={onOpen}
            className="outline-none after:absolute after:inset-0 after:rounded-3xl after:content-[''] focus-visible:after:outline-2 focus-visible:after:outline-offset-2 focus-visible:after:outline-forest"
          >
            {product.name}
          </Link>
        </h3>
        <Rating value={product.ratingAvg} count={product.ratingCount} className="mt-1.5" />

        <div className="mt-auto flex items-end justify-between gap-2 pt-3">
          <div className="min-w-0">
            <PriceTag pricing={product.pricing} size="md" />
            <StockNote stock={product.stock} className="mt-0.5" />
          </div>
          <AddToCartButton variantId={product.defaultVariantId} productName={product.name} soldOut={soldOut} />
        </div>
      </div>
    </article>
  );
}
