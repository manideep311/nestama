"use client";

import { useState } from "react";
import Link from "next/link";
import { RotateCcw, ShieldCheck, Truck } from "lucide-react";
import { formatINR, type ProductDetailDTO } from "@nestama/shared";
import { Rating } from "@/components/ui/Rating";
import { PriceTag } from "@/components/product/PriceTag";
import { AddToCartButton } from "@/components/product/AddToCartButton";
import { WishlistButton } from "@/components/product/WishlistButton";
import { WaggingDogMascot } from "@/components/animations/WaggingDogMascot";
import { OfferCountdown } from "@/components/promo/OfferCountdown";
import { cn } from "@/lib/cn";
import { DeliveryEstimate } from "./DeliveryEstimate";
import { QuantityStepper } from "./QuantityStepper";
import { VariantPicker } from "./VariantPicker";

/** Name, price, variants, quantity, delivery and add-to-cart — with the compact dog that wags on add. */
export function PurchasePanel({ product, freeShippingThreshold }: { product: ProductDetailDTO; freeShippingThreshold: number }) {
  const firstAvailable = product.variants.find((v) => v.stock !== "OUT_OF_STOCK") ?? product.variants[0]!;
  const [variantId, setVariantId] = useState(firstAvailable.id);
  const [qty, setQty] = useState(1);
  const [wag, setWag] = useState(0);

  const variant = product.variants.find((v) => v.id === variantId) ?? firstAvailable;
  const soldOut = variant.stock === "OUT_OF_STOCK";
  const maxQty = Math.max(1, Math.min(variant.available, 10));
  const showPicker = product.variants.length > 1;

  return (
    <div>
      <p className="text-sm font-bold tracking-wide text-orange-ink uppercase">{product.brand}</p>
      <h1 className="mt-1 text-3xl leading-tight font-extrabold sm:text-4xl">{product.name}</h1>
      <a href="#reviews" className="mt-2 inline-flex items-center gap-2 text-sm text-muted hover:text-forest">
        <Rating value={product.ratingAvg} count={product.ratingCount} size="md" />
        <span className="underline-offset-4 hover:underline">Read reviews</span>
      </a>

      <div className="mt-5 rounded-3xl bg-white p-5 ring-1 ring-line">
        <PriceTag pricing={variant.pricing} size="lg" showBadge />
        <p className="mt-1 text-xs text-muted">Inclusive of all taxes</p>
        {variant.pricing.promotion && (
          <div className="mt-3 flex flex-wrap items-center gap-2 text-sm">
            <span className="font-semibold text-forest">{variant.pricing.promotion.name} price ends soon:</span>
            <OfferCountdown endsAt={variant.pricing.promotion.endsAt} variant="pill" />
          </div>
        )}
      </div>

      {product.shortDescription && <p className="mt-5 text-[15px] leading-relaxed text-charcoal/90">{product.shortDescription}</p>}

      {showPicker && (
        <VariantPicker
          className="mt-6"
          variants={product.variants}
          value={variant.id}
          onChange={(id) => {
            setVariantId(id);
            setQty(1);
          }}
        />
      )}

      <div className="mt-6 flex flex-wrap items-center gap-3">
        <QuantityStepper value={qty} max={maxQty} disabled={soldOut} onChange={setQty} />

        <AddToCartButton
          variantId={variant.id}
          productName={`${product.name}${showPicker ? ` (${variant.label})` : ""}`}
          quantity={qty}
          soldOut={soldOut}
          appearance="full"
          className="flex-1 sm:flex-none"
          onAdded={() => setWag((w) => w + 1)}
        />
        <WishlistButton productId={product.id} productName={product.name} className="size-13 shadow-none ring-2 ring-line" />
        <WaggingDogMascot play={wag} size="sm" className="hidden sm:block" />
      </div>

      <p
        className={cn(
          "mt-3 text-sm font-semibold",
          variant.stock === "IN_STOCK" ? "text-forest" : variant.stock === "LOW_STOCK" ? "text-orange-ink" : "text-muted",
        )}
      >
        {variant.stock === "IN_STOCK"
          ? "In stock — ready to ship"
          : variant.stock === "LOW_STOCK"
            ? `Only ${variant.available} left — order soon`
            : "Sold out — check back soon"}
      </p>

      <div className="mt-5">
        <DeliveryEstimate />
      </div>

      <ul className="mt-5 grid grid-cols-3 gap-2 text-center text-xs font-semibold text-forest">
        <li className="rounded-2xl bg-sage/60 px-2 py-3">
          <Truck className="mx-auto mb-1 size-5" aria-hidden="true" />
          Free shipping over {formatINR(freeShippingThreshold)}
        </li>
        <li className="rounded-2xl bg-sage/60 px-2 py-3">
          <RotateCcw className="mx-auto mb-1 size-5" aria-hidden="true" />
          Easy 7-day returns
        </li>
        <li className="rounded-2xl bg-sage/60 px-2 py-3">
          <ShieldCheck className="mx-auto mb-1 size-5" aria-hidden="true" />
          Secure checkout
        </li>
      </ul>

      {product.tags.length > 0 && (
        <ul className="mt-5 flex flex-wrap gap-2" aria-label="Product tags">
          {product.tags.map((t) => (
            <li key={t}>
              <Link
                href={`/shop?q=${encodeURIComponent(t)}`}
                className="inline-flex rounded-full bg-peach/60 px-3 py-1 text-xs font-bold text-orange-ink capitalize hover:bg-peach"
              >
                {t}
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
