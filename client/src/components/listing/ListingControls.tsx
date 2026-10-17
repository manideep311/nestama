"use client";

import { useEffect, useId, useRef, useState, useSyncExternalStore } from "react";
import { createPortal } from "react-dom";
import Link from "next/link";
import { AnimatePresence, useReducedMotion } from "motion/react";
import * as m from "motion/react-m";
import { ChevronLeft, ChevronRight, SlidersHorizontal, X } from "lucide-react";
import type { ProductCardDTO } from "@nestama/shared";
import { activeFilters } from "@/lib/listing-url";
import { ProductCard } from "@/components/product/ProductCard";
import { cn } from "@/lib/cn";
import { useListing } from "./ListingShell";
import { FilterPanel, type FilterPanelProps } from "./FilterPanel";

const sortOptions = [
  { value: "featured", label: "Featured" },
  { value: "bestselling", label: "Best selling" },
  { value: "newest", label: "Newest" },
  { value: "rating", label: "Top rated" },
  { value: "price-asc", label: "Price: low to high" },
  { value: "price-desc", label: "Price: high to low" },
];

export function SortSelect() {
  const { params, update } = useListing();
  const id = useId();
  return (
    <div className="flex items-center gap-2">
      <label htmlFor={id} className="text-sm font-semibold whitespace-nowrap text-muted">
        Sort by
      </label>
      <select
        id={id}
        value={params.get("sort") ?? "featured"}
        onChange={(e) => update({ sort: e.target.value })}
        className="h-10 rounded-full border border-line bg-white pr-8 pl-4 text-sm font-semibold text-forest outline-none focus:border-forest"
      >
        {sortOptions.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </select>
    </div>
  );
}

export function ActiveFilters({ brandNames }: { brandNames: Record<string, string> }) {
  const { params, update, hrefFor } = useListing();
  const chips = activeFilters(params, { brandNames });
  if (chips.length === 0) return null;
  const clearAll = Object.fromEntries(chips.flatMap((c) => Object.keys(c.remove).map((k) => [k, null])));
  return (
    <div className="flex flex-wrap items-center gap-2" aria-label="Active filters">
      {chips.map((c) => (
        <button
          key={c.key}
          type="button"
          onClick={() => update(c.remove)}
          className="inline-flex items-center gap-1.5 rounded-full bg-sage py-1.5 pr-2.5 pl-3.5 text-sm font-semibold text-forest transition-colors hover:bg-sage-deep"
        >
          {c.label}
          <X className="size-3.5" aria-hidden="true" />
          <span className="sr-only">Remove filter</span>
        </button>
      ))}
      <Link
        href={hrefFor(clearAll)}
        onClick={(e) => {
          e.preventDefault();
          update(clearAll);
        }}
        className="text-sm font-bold text-orange-ink underline-offset-4 hover:underline"
      >
        Clear all
      </Link>
    </div>
  );
}

export function ProductGrid({ products }: { products: ProductCardDTO[] }) {
  const { isPending } = useListing();
  return (
    <>
      {/* Cards use h3 titles; this keeps the outline h1 → h2 → h3 for screen-reader heading navigation. */}
      <h2 className="sr-only">Products</h2>
      <ul
        aria-busy={isPending}
        className={cn(
          "grid grid-cols-2 gap-3 transition-opacity duration-200 sm:gap-4 md:grid-cols-3 xl:grid-cols-4",
          isPending && "opacity-55",
        )}
      >
        {products.map((p, i) => (
          <li key={p.id}>
            <ProductCard product={p} priority={i < 4} />
          </li>
        ))}
      </ul>
    </>
  );
}

/** Numbered pagination with real links (crawlable), navigated as transitions. */
export function Pagination({ page, totalPages }: { page: number; totalPages: number }) {
  const { update, hrefFor } = useListing();
  if (totalPages <= 1) return null;

  const pages = Array.from({ length: totalPages }, (_, i) => i + 1).filter((p) => p === 1 || p === totalPages || Math.abs(p - page) <= 1);
  const go = (p: number) => (e: React.MouseEvent) => {
    e.preventDefault();
    update({ page: String(p) });
    window.scrollTo({ top: 0, behavior: window.matchMedia("(prefers-reduced-motion: reduce)").matches ? "auto" : "smooth" });
  };

  return (
    <nav aria-label="Pages" className="mt-10 flex items-center justify-center gap-1.5">
      <PageLink href={hrefFor({ page: String(page - 1) })} onClick={go(page - 1)} disabled={page <= 1} label="Previous page">
        <ChevronLeft className="size-4" aria-hidden="true" />
      </PageLink>
      {pages.map((p, i) => (
        <span key={p} className="flex items-center gap-1.5">
          {i > 0 && p - pages[i - 1]! > 1 && <span className="px-1 text-muted">…</span>}
          <PageLink href={hrefFor({ page: String(p) })} onClick={go(p)} current={p === page} label={`Page ${p}`}>
            {p}
          </PageLink>
        </span>
      ))}
      <PageLink href={hrefFor({ page: String(page + 1) })} onClick={go(page + 1)} disabled={page >= totalPages} label="Next page">
        <ChevronRight className="size-4" aria-hidden="true" />
      </PageLink>
    </nav>
  );
}

function PageLink({
  href,
  onClick,
  current,
  disabled,
  label,
  children,
}: {
  href: string;
  onClick: (e: React.MouseEvent) => void;
  current?: boolean;
  disabled?: boolean;
  label: string;
  children: React.ReactNode;
}) {
  const base = "grid size-10 place-items-center rounded-full text-sm font-bold tabular-nums transition-colors";
  if (disabled)
    return (
      <span aria-hidden="true" className={cn(base, "text-forest/25")}>
        {children}
      </span>
    );
  return (
    <Link
      href={href}
      onClick={onClick}
      aria-label={label}
      aria-current={current ? "page" : undefined}
      className={cn(base, current ? "bg-forest text-cream" : "text-forest hover:bg-sage")}
    >
      {children}
    </Link>
  );
}

const noopSubscribe = () => () => {};

/** Phone/tablet filters in a bottom sheet. Filters apply as you choose them. */
export function MobileFilters({ facets, hide, total }: FilterPanelProps & { total: number }) {
  const [open, setOpen] = useState(false);
  const reduce = useReducedMotion();
  const { params } = useListing();
  const isClient = useSyncExternalStore(
    noopSubscribe,
    () => true,
    () => false,
  );
  const closeRef = useRef<HTMLButtonElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const activeCount = activeFilters(params).length;

  useEffect(() => {
    if (!open) return;
    const trigger = triggerRef.current;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    closeRef.current?.focus();
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = prev;
      trigger?.focus();
    };
  }, [open]);

  return (
    <>
      <button
        ref={triggerRef}
        type="button"
        onClick={() => setOpen(true)}
        aria-expanded={open}
        className="inline-flex h-10 items-center gap-2 rounded-full border border-line bg-white px-4 text-sm font-bold text-forest lg:hidden"
      >
        <SlidersHorizontal className="size-4" aria-hidden="true" />
        Filters
        {activeCount > 0 && (
          <span className="grid size-5 place-items-center rounded-full bg-ember text-[11px] text-white">{activeCount}</span>
        )}
      </button>

      {isClient &&
        createPortal(
          <AnimatePresence>
            {open && (
              <div className="fixed inset-0 z-[70] lg:hidden">
                <m.div
                  className="absolute inset-0 bg-forest-900/45"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  onClick={() => setOpen(false)}
                />
                <m.div
                  role="dialog"
                  aria-modal="true"
                  aria-label="Filters"
                  className="absolute inset-x-0 bottom-0 flex max-h-[85dvh] flex-col rounded-t-[1.75rem] bg-cream shadow-lift"
                  initial={reduce ? { opacity: 0 } : { y: "100%" }}
                  animate={reduce ? { opacity: 1 } : { y: 0 }}
                  exit={reduce ? { opacity: 0 } : { y: "100%" }}
                  transition={{ type: "tween", duration: 0.28, ease: [0.2, 0.8, 0.2, 1] }}
                >
                  <div className="flex items-center justify-between border-b border-line px-5 py-3">
                    <h2 className="text-xl font-extrabold">Filters</h2>
                    <button
                      ref={closeRef}
                      type="button"
                      onClick={() => setOpen(false)}
                      className="grid size-10 place-items-center rounded-full hover:bg-sage"
                    >
                      <X className="size-5" aria-hidden="true" />
                      <span className="sr-only">Close filters</span>
                    </button>
                  </div>
                  <div className="flex-1 overflow-y-auto px-5 py-5">
                    <FilterPanel facets={facets} hide={hide} />
                  </div>
                  <div className="border-t border-line p-4">
                    <button
                      type="button"
                      onClick={() => setOpen(false)}
                      className="h-12 w-full rounded-full bg-forest text-base font-bold text-cream"
                    >
                      Show {total} {total === 1 ? "product" : "products"}
                    </button>
                  </div>
                </m.div>
              </div>
            )}
          </AnimatePresence>,
          document.body,
        )}
    </>
  );
}
