"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Check, ChevronLeft, ChevronRight } from "lucide-react";
import type { ProductCardDTO } from "@nestama/shared";
import { cn } from "@/lib/cn";
import { ProductCard } from "./ProductCard";

/**
 * Horizontal, scroll-snapping product rail with previous/next controls.
 * Native scrolling keeps touch swipe, trackpads and keyboard (Tab through cards) working.
 */
export function ProductCarousel({
  products,
  label,
  priorityCount = 0,
  notes,
}: {
  products: ProductCardDTO[];
  label: string;
  priorityCount?: number;
  /** A short caption under a card, keyed by product id (e.g. why it was recommended). */
  notes?: Record<string, string>;
}) {
  const trackRef = useRef<HTMLUListElement>(null);
  const [edges, setEdges] = useState({ start: true, end: false });

  const measure = useCallback(() => {
    const el = trackRef.current;
    if (!el) return;
    setEdges({ start: el.scrollLeft <= 4, end: el.scrollLeft + el.clientWidth >= el.scrollWidth - 4 });
  }, []);

  useEffect(() => {
    measure();
    const el = trackRef.current;
    if (!el) return;
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    return () => ro.disconnect();
  }, [measure]);

  function page(dir: 1 | -1) {
    const el = trackRef.current;
    if (!el) return;
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    el.scrollBy({ left: dir * el.clientWidth * 0.85, behavior: reduce ? "auto" : "smooth" });
  }

  return (
    <div className="relative">
      <ul
        ref={trackRef}
        onScroll={measure}
        aria-label={label}
        className={cn(
          "-mx-4 scrollbar-none flex snap-x snap-mandatory gap-3 overflow-x-auto scroll-smooth px-4 pt-1 pb-4 sm:-mx-6 sm:gap-4 sm:px-6 lg:mx-0 lg:px-0",
          "scroll-px-4 sm:scroll-px-6 lg:scroll-px-0",
        )}
      >
        {products.map((p, i) => (
          <li
            key={p.id}
            // A column, so an optional caption sits under the card instead of overflowing the
            // card's full-height box (which would clip it inside the scrolling track).
            className="flex w-[68%] shrink-0 snap-start flex-col gap-2 sm:w-[41%] md:w-[31%] lg:w-[calc((100%-3rem)/4)] xl:w-[calc((100%-4rem)/5)]"
          >
            <div className="flex-1">
              <ProductCard product={p} priority={i < priorityCount} />
            </div>
            {notes?.[p.id] && (
              <p className="inline-flex items-center gap-1.5 self-start rounded-full bg-sage px-2.5 py-1 text-xs font-bold text-forest">
                <Check className="size-3.5" aria-hidden="true" />
                {notes[p.id]}
              </p>
            )}
          </li>
        ))}
      </ul>

      <CarouselButton dir={-1} disabled={edges.start} onClick={() => page(-1)} label={`Previous ${label}`} />
      <CarouselButton dir={1} disabled={edges.end} onClick={() => page(1)} label={`Next ${label}`} />
    </div>
  );
}

function CarouselButton({ dir, disabled, onClick, label }: { dir: 1 | -1; disabled: boolean; onClick: () => void; label: string }) {
  const Icon = dir === 1 ? ChevronRight : ChevronLeft;
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      aria-label={label}
      className={cn(
        "absolute top-[38%] z-20 hidden size-11 -translate-y-1/2 place-items-center rounded-full bg-white text-forest shadow-lift ring-1 ring-line transition-[opacity,transform] duration-200 hover:scale-105 lg:grid",
        dir === 1 ? "-right-5" : "-left-5",
        disabled && "pointer-events-none opacity-0",
      )}
    >
      <Icon className="size-5" aria-hidden="true" />
    </button>
  );
}
