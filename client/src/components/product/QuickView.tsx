"use client";

import { createContext, use, useCallback, useEffect, useId, useRef, useState, type ReactNode } from "react";
import Image from "next/image";
import Link from "next/link";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { ArrowRight, Eye, X } from "lucide-react";
import type { ProductDetailDTO } from "@nestama/shared";
import { apiFetch } from "@/lib/cart-client";
import { Rating } from "@/components/ui/Rating";
import { VariantPicker } from "@/components/pdp/VariantPicker";
import { QuantityStepper } from "@/components/pdp/QuantityStepper";
import { cn } from "@/lib/cn";
import { PriceTag } from "./PriceTag";
import { AddToCartButton } from "./AddToCartButton";
import { WishlistButton } from "./WishlistButton";

const productQuery = (slug: string) => ({
  queryKey: ["product", slug] as const,
  queryFn: () => apiFetch<ProductDetailDTO>(`/products/${encodeURIComponent(slug)}`),
  staleTime: 60_000,
});

const QuickViewContext = createContext<((slug: string) => void) | null>(null);

/**
 * One shared quick-view dialog for every product card. A native modal `<dialog>` gives the
 * focus trap, Escape to close and focus restore (back to the eye button) for free; clicking the
 * backdrop closes it too. It is a bottom sheet on phones and a centred card from `md` up.
 */
export function QuickViewProvider({ children }: { children: ReactNode }) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const [view, setView] = useState<{ slug: string; n: number } | null>(null);
  const titleId = useId();

  const open = useCallback((slug: string) => setView((v) => ({ slug, n: (v?.n ?? 0) + 1 })), []);
  const close = useCallback(() => dialogRef.current?.close(), []);

  // Open after the new product's body has rendered, so the dialog focuses its close button.
  useEffect(() => {
    const dialog = dialogRef.current;
    if (view && dialog && !dialog.open) dialog.showModal();
  }, [view]);

  // The dialog lives in the root layout: Back/Forward must not leave it over another page.
  useEffect(() => {
    window.addEventListener("popstate", close);
    return () => window.removeEventListener("popstate", close);
  }, [close]);

  return (
    <QuickViewContext value={open}>
      {children}
      <dialog
        ref={dialogRef}
        aria-labelledby={titleId}
        className="quick-view bg-cream text-charcoal shadow-lift"
        onClick={(e) => {
          if (e.target === e.currentTarget) close();
        }}
      >
        {view && <QuickViewBody key={view.n} slug={view.slug} titleId={titleId} onClose={close} />}
      </dialog>
    </QuickViewContext>
  );
}

/** The eye button on product cards (prefetches the product on hover/focus). */
export function QuickViewButton({ slug, productName, className }: { slug: string; productName: string; className?: string }) {
  const open = use(QuickViewContext);
  const queryClient = useQueryClient();
  if (!open) return null;
  const prefetch = () => void queryClient.prefetchQuery(productQuery(slug));

  return (
    <button
      type="button"
      onClick={() => open(slug)}
      onPointerEnter={prefetch}
      onFocus={prefetch}
      aria-haspopup="dialog"
      aria-label={`Quick view: ${productName}`}
      className={cn(
        "relative z-10 grid size-10 place-items-center rounded-full bg-white/95 text-forest shadow-card transition-[color,opacity] duration-200 hover:text-orange-ink",
        // Hover devices reveal it with the card; touch devices always show it.
        "[@media(hover:hover)]:opacity-0 [@media(hover:hover)]:group-hover:opacity-100 [@media(hover:hover)]:group-has-[:focus-visible]:opacity-100",
        className,
      )}
    >
      <Eye className="size-[18px]" aria-hidden="true" />
    </button>
  );
}

function QuickViewBody({ slug, titleId, onClose }: { slug: string; titleId: string; onClose: () => void }) {
  const { data: product, isPending, isError, refetch, isRefetching } = useQuery(productQuery(slug));

  return (
    <div data-quick-view className="relative grid md:grid-cols-2">
      <button
        type="button"
        onClick={onClose}
        aria-label="Close quick view"
        className="absolute top-3 right-3 z-10 grid size-10 place-items-center rounded-full bg-white text-forest shadow-card hover:bg-sage"
      >
        <X className="size-5" aria-hidden="true" />
      </button>

      {isPending ? (
        <QuickViewSkeleton titleId={titleId} />
      ) : isError || !product ? (
        <div className="col-span-full px-6 py-14 text-center">
          <h2 id={titleId} className="text-2xl font-extrabold">
            We couldn&apos;t fetch this one
          </h2>
          <p className="mt-2 text-muted">Check your connection and try again.</p>
          <div className="mt-5 flex justify-center gap-3">
            <button
              type="button"
              onClick={() => void refetch()}
              disabled={isRefetching}
              className="h-11 rounded-full bg-forest px-5 font-bold text-cream disabled:opacity-60"
            >
              Try again
            </button>
            <Link
              href={`/products/${slug}`}
              onClick={onClose}
              className="inline-flex h-11 items-center rounded-full px-5 font-bold text-forest ring-2 ring-line"
            >
              Open product page
            </Link>
          </div>
        </div>
      ) : (
        <QuickViewProduct product={product} titleId={titleId} onClose={onClose} />
      )}
    </div>
  );
}

function QuickViewProduct({ product, titleId, onClose }: { product: ProductDetailDTO; titleId: string; onClose: () => void }) {
  const firstAvailable = product.variants.find((v) => v.stock !== "OUT_OF_STOCK") ?? product.variants[0]!;
  const [variantId, setVariantId] = useState(firstAvailable.id);
  const [qty, setQty] = useState(1);
  const [imageIndex, setImageIndex] = useState(0);

  const variant = product.variants.find((v) => v.id === variantId) ?? firstAvailable;
  const soldOut = variant.stock === "OUT_OF_STOCK";
  const maxQty = Math.max(1, Math.min(variant.available, 10));
  const showPicker = product.variants.length > 1;
  const images = (product.images.length > 0 ? product.images : [product.image]).slice(0, 5);
  const image = images[imageIndex] ?? images[0]!;

  return (
    <>
      <div className="p-3 md:p-4">
        <div className="relative aspect-[4/3] overflow-hidden rounded-[1.6rem] bg-cream-deep md:aspect-square">
          <Image
            key={image.url}
            src={image.url}
            alt={image.alt}
            fill
            sizes="(min-width: 768px) 440px, 94vw"
            className="animate-fade-in object-cover"
          />
          {variant.pricing.discountPercent > 0 && !soldOut && (
            <span className="absolute top-3 left-3 rounded-lg bg-ember px-2 py-1 text-xs leading-none font-extrabold tracking-wide text-white">
              {variant.pricing.discountPercent}% OFF
            </span>
          )}
        </div>
        {images.length > 1 && (
          <div className="mt-3 flex gap-2" role="group" aria-label="Product images">
            {images.map((im, i) => (
              <button
                key={im.url}
                type="button"
                onClick={() => setImageIndex(i)}
                aria-label={`Show image ${i + 1} of ${images.length}`}
                aria-pressed={i === imageIndex}
                className={cn(
                  "relative size-14 overflow-hidden rounded-xl ring-2 transition-[box-shadow,opacity]",
                  i === imageIndex ? "ring-forest" : "opacity-75 ring-transparent hover:opacity-100",
                )}
              >
                <Image src={im.url} alt="" fill sizes="56px" className="object-cover" />
              </button>
            ))}
          </div>
        )}
      </div>

      <div className="flex flex-col px-5 pt-1 pb-6 md:py-7 md:pr-7 md:pl-3">
        <p className="text-sm font-bold tracking-wide text-orange-ink uppercase">{product.brand}</p>
        <h2 id={titleId} className="mt-1 pr-12 text-2xl leading-tight font-extrabold sm:text-[1.7rem]">
          {product.name}
        </h2>
        <Rating value={product.ratingAvg} count={product.ratingCount} size="md" className="mt-2" />

        <div className="mt-4">
          <PriceTag pricing={variant.pricing} size="lg" showBadge />
          <p className="mt-1 text-xs text-muted">Inclusive of all taxes</p>
        </div>

        {product.shortDescription && (
          <p className="mt-4 line-clamp-3 text-[15px] leading-relaxed text-charcoal/90">{product.shortDescription}</p>
        )}

        {showPicker && (
          <VariantPicker
            className="mt-5"
            variants={product.variants}
            value={variant.id}
            onChange={(id) => {
              setVariantId(id);
              setQty(1);
            }}
          />
        )}

        <div className="mt-5 flex flex-wrap items-center gap-3">
          <QuantityStepper value={qty} max={maxQty} disabled={soldOut} onChange={setQty} />
          <AddToCartButton
            variantId={variant.id}
            productName={`${product.name}${showPicker ? ` (${variant.label})` : ""}`}
            quantity={qty}
            soldOut={soldOut}
            appearance="full"
            className="flex-1"
            onAddStart={onClose}
          />
          <WishlistButton productId={product.id} productName={product.name} className="size-13 shadow-none ring-2 ring-line" />
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

        <Link
          href={`/products/${product.slug}`}
          onClick={onClose}
          className="group/link mt-6 inline-flex items-center gap-1.5 self-start font-bold text-orange-ink underline-offset-4 hover:underline md:mt-auto md:pt-6"
        >
          View full details
          <ArrowRight className="size-4 transition-transform group-hover/link:translate-x-0.5" aria-hidden="true" />
        </Link>
      </div>
    </>
  );
}

function QuickViewSkeleton({ titleId }: { titleId: string }) {
  return (
    <>
      <h2 id={titleId} className="sr-only">
        Loading product
      </h2>
      <div className="p-3 md:p-4">
        <div className="aspect-[4/3] skeleton rounded-[1.6rem] md:aspect-square" />
      </div>
      <div className="space-y-4 px-5 pt-1 pb-6 md:py-7 md:pr-7 md:pl-3" aria-hidden="true">
        <div className="h-4 w-24 skeleton rounded-full" />
        <div className="h-9 w-4/5 skeleton rounded-2xl" />
        <div className="h-4 w-36 skeleton rounded-full" />
        <div className="h-9 w-40 skeleton rounded-xl" />
        <div className="h-16 w-full skeleton rounded-2xl" />
        <div className="h-13 w-full skeleton rounded-full" />
      </div>
    </>
  );
}
