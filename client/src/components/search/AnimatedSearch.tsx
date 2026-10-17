"use client";

import { useEffect, useId, useMemo, useRef, useState } from "react";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { AnimatePresence, useReducedMotion } from "motion/react";
import * as m from "motion/react-m";
import { keepPreviousData, useQuery } from "@tanstack/react-query";
import { ArrowRight, Search, TrendingUp, X } from "lucide-react";
import { formatINR, type ProductCardDTO, type ProductListResponse, type SearchResultDTO } from "@nestama/shared";
import { apiFetch } from "@/lib/cart-client";
import { PawIcon } from "@/components/ui/icons";
import { cn } from "@/lib/cn";

function useDebounced<T>(value: T, ms: number): T {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const t = setTimeout(() => setDebounced(value), ms);
    return () => clearTimeout(t);
  }, [value, ms]);
  return debounced;
}

type Option = { id: string; href: string; label: string };

/**
 * Header search as an ARIA combobox: popular searches on focus, live product suggestions while
 * typing (debounced), a paw loader only during real requests, ↑/↓/Enter/Escape support.
 */
export function AnimatedSearch({ popular }: { popular: string[] }) {
  const router = useRouter();
  const reduce = useReducedMotion();
  const id = useId();
  const listId = `${id}-list`;
  const [q, setQ] = useState("");
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(-1);
  const inputRef = useRef<HTMLInputElement>(null);
  const term = useDebounced(q.trim(), 200);
  const searching = term.length >= 2;

  const { data, isFetching, isError } = useQuery({
    queryKey: ["search", term],
    queryFn: () => apiFetch<SearchResultDTO>(`/search?q=${encodeURIComponent(term)}`),
    enabled: searching,
    placeholderData: keepPreviousData,
    staleTime: 60_000,
  });

  // Trending picks for the empty state; fetched once, the first time the panel opens.
  const trending = useQuery({
    queryKey: ["search", "trending"],
    queryFn: () => apiFetch<ProductListResponse>("/products?sort=bestselling&pageSize=4"),
    enabled: open,
    staleTime: 10 * 60_000,
  });
  const trendingItems = useMemo(() => trending.data?.items ?? [], [trending.data]);

  const options: Option[] = useMemo(() => {
    if (!searching) {
      const chips = popular.map((p, i) => ({ id: `${id}-pop-${i}`, href: `/shop?q=${encodeURIComponent(p)}`, label: p }));
      return [...chips, ...trendingItems.map((p) => ({ id: `${id}-t-${p.id}`, href: `/products/${p.slug}`, label: p.name }))];
    }
    const items: Option[] = (data?.products ?? []).map((p) => ({ id: `${id}-p-${p.id}`, href: `/products/${p.slug}`, label: p.name }));
    (data?.categories ?? []).forEach((c) => items.push({ id: `${id}-c-${c.slug}`, href: `/c/${c.slug}`, label: c.name }));
    items.push({ id: `${id}-all`, href: `/shop?q=${encodeURIComponent(term)}`, label: `See all results for “${term}”` });
    return items;
  }, [searching, popular, trendingItems, data, term, id]);

  function go(href: string) {
    setOpen(false);
    setActive(-1);
    inputRef.current?.blur();
    router.push(href);
  }

  function onKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if ((e.key === "ArrowDown" || e.key === "ArrowUp") && options.length === 0) return;
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setOpen(true);
      setActive((a) => (a + 1) % options.length);
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setOpen(true);
      setActive((a) => (a <= 0 ? options.length - 1 : a - 1));
    } else if (e.key === "Escape") {
      if (open) {
        e.preventDefault();
        setOpen(false);
        setActive(-1);
      } else setQ("");
    } else if (e.key === "Enter") {
      e.preventDefault();
      const chosen = options[active];
      if (chosen) go(chosen.href);
      else if (q.trim()) go(`/shop?q=${encodeURIComponent(q.trim())}`);
    }
  }

  const products = searching ? (data?.products ?? []) : [];
  const categories = searching ? (data?.categories ?? []) : [];
  const optionIndex = (optionId: string) => options.findIndex((o) => o.id === optionId);

  return (
    <div
      className="relative w-full max-w-xl"
      role="search"
      onBlur={(e) => {
        if (!e.currentTarget.contains(e.relatedTarget as Node | null)) {
          setOpen(false);
          setActive(-1);
        }
      }}
    >
      <label htmlFor={`${id}-input`} className="sr-only">
        Search products
      </label>
      <Search className="pointer-events-none absolute top-1/2 left-4 z-10 size-[18px] -translate-y-1/2 text-muted" aria-hidden="true" />
      <input
        ref={inputRef}
        id={`${id}-input`}
        type="search"
        role="combobox"
        aria-expanded={open}
        aria-controls={listId}
        aria-autocomplete="list"
        aria-activedescendant={active >= 0 ? options[active]?.id : undefined}
        value={q}
        onChange={(e) => {
          setQ(e.target.value);
          setOpen(true);
          setActive(-1);
        }}
        onFocus={() => setOpen(true)}
        onKeyDown={onKeyDown}
        placeholder="Search food, toys, accessories…"
        autoComplete="off"
        className={cn(
          "relative h-12 w-full rounded-full border border-line bg-white pr-11 pl-11 text-[15px] text-charcoal outline-none placeholder:text-muted/80",
          "transition-[border-color,box-shadow] focus:border-forest/40 focus:shadow-[0_0_0_4px_rgb(18_61_47/0.08)]",
        )}
      />
      {q && (
        <button
          type="button"
          onClick={() => {
            setQ("");
            setActive(-1);
            inputRef.current?.focus();
          }}
          className="absolute top-1/2 right-3 z-10 grid size-8 -translate-y-1/2 place-items-center rounded-full text-muted hover:bg-cream"
          aria-label="Clear search"
        >
          <X className="size-4" aria-hidden="true" />
        </button>
      )}

      <AnimatePresence>
        {open && (
          <m.div
            initial={reduce ? { opacity: 0 } : { opacity: 0, y: -6, scale: 0.98 }}
            animate={reduce ? { opacity: 1 } : { opacity: 1, y: 0, scale: 1 }}
            exit={reduce ? { opacity: 0 } : { opacity: 0, y: -6, scale: 0.98, transition: { duration: 0.12 } }}
            transition={{ type: "spring", stiffness: 520, damping: 34 }}
            tabIndex={-1}
            className="absolute inset-x-0 top-[calc(100%+0.5rem)] z-[60] origin-top overflow-hidden rounded-3xl bg-white shadow-lift ring-1 ring-line"
          >
            <ul
              id={listId}
              role="listbox"
              aria-label={searching ? `Results for ${term}` : "Popular searches"}
              className="max-h-[70vh] overflow-y-auto p-2"
            >
              {!searching && (
                <>
                  <li
                    role="presentation"
                    className="flex items-center gap-1.5 px-3 pt-2 pb-1 text-xs font-bold tracking-wider text-muted uppercase"
                  >
                    <TrendingUp className="size-3.5" aria-hidden="true" /> Popular searches
                  </li>
                  <li role="presentation" className="flex flex-wrap gap-2 px-2 pb-2">
                    {options.slice(0, popular.length).map((o, i) => (
                      <span
                        key={o.id}
                        id={o.id}
                        role="option"
                        aria-selected={i === active}
                        onMouseDown={(e) => e.preventDefault()}
                        onClick={() => go(o.href)}
                        className={cn(
                          "cursor-pointer rounded-full px-3.5 py-1.5 text-sm font-semibold text-forest ring-1 ring-line transition-colors",
                          i === active ? "bg-forest text-cream" : "bg-cream hover:bg-sage",
                        )}
                      >
                        {o.label}
                      </span>
                    ))}
                  </li>
                  {trendingItems.length > 0 && (
                    <li role="presentation" className="px-3 pt-3 pb-1 text-xs font-bold tracking-wider text-muted uppercase">
                      Trending now
                    </li>
                  )}
                  {trendingItems.map((p) => {
                    const optionId = `${id}-t-${p.id}`;
                    const i = optionIndex(optionId);
                    return (
                      <ProductOption
                        key={p.id}
                        id={optionId}
                        product={p}
                        active={i === active}
                        onHover={() => setActive(i)}
                        onPick={() => go(`/products/${p.slug}`)}
                      />
                    );
                  })}
                </>
              )}

              {searching && isFetching && products.length === 0 && (
                <li role="presentation" className="flex items-center justify-center gap-3 px-3 py-6 text-sm text-muted">
                  <PawLoader /> Sniffing out matches…
                </li>
              )}
              {searching && isError && (
                <li role="presentation" className="px-3 py-5 text-sm text-muted">
                  Search is taking a nap. Try again in a moment.
                </li>
              )}
              {searching && !isFetching && !isError && products.length === 0 && categories.length === 0 && (
                <li role="presentation" className="px-3 py-5 text-sm text-muted">
                  No products match “{term}”. Try a broader word like “bed” or “toy”.
                </li>
              )}

              {products.map((p) => {
                const optionId = `${id}-p-${p.id}`;
                const i = optionIndex(optionId);
                return (
                  <ProductOption
                    key={p.id}
                    id={optionId}
                    product={p}
                    active={i === active}
                    onHover={() => setActive(i)}
                    onPick={() => go(`/products/${p.slug}`)}
                  />
                );
              })}

              {categories.length > 0 && (
                <li role="presentation" className="px-3 pt-3 pb-1 text-xs font-bold tracking-wider text-muted uppercase">
                  Categories
                </li>
              )}
              {categories.map((c) => {
                const optionId = `${id}-c-${c.slug}`;
                const i = optionIndex(optionId);
                return (
                  <li
                    key={c.slug}
                    id={optionId}
                    role="option"
                    aria-selected={i === active}
                    onMouseDown={(e) => e.preventDefault()}
                    onClick={() => go(`/c/${c.slug}`)}
                    onMouseEnter={() => setActive(i)}
                    className={cn(
                      "flex cursor-pointer items-center gap-2 rounded-2xl px-3 py-2 text-sm font-semibold text-forest",
                      i === active && "bg-cream",
                    )}
                  >
                    <PawIcon className="size-3.5 text-orange" /> {c.name}
                  </li>
                );
              })}

              {searching && (
                <li
                  id={`${id}-all`}
                  role="option"
                  aria-selected={optionIndex(`${id}-all`) === active}
                  onMouseDown={(e) => e.preventDefault()}
                  onClick={() => go(`/shop?q=${encodeURIComponent(term)}`)}
                  onMouseEnter={() => setActive(optionIndex(`${id}-all`))}
                  className={cn(
                    "mt-1 flex cursor-pointer items-center justify-between rounded-2xl px-3 py-2.5 text-sm font-bold text-orange-ink",
                    optionIndex(`${id}-all`) === active && "bg-cream",
                  )}
                >
                  See all results for “{term}”
                  <span className="flex items-center gap-2">
                    {isFetching && products.length > 0 && <PawLoader />}
                    <ArrowRight className="size-4" aria-hidden="true" />
                  </span>
                </li>
              )}
            </ul>
          </m.div>
        )}
      </AnimatePresence>
    </div>
  );
}

function ProductOption({
  id,
  product: p,
  active,
  onHover,
  onPick,
}: {
  id: string;
  product: ProductCardDTO;
  active: boolean;
  onHover: () => void;
  onPick: () => void;
}) {
  return (
    <li
      id={id}
      role="option"
      aria-selected={active}
      onMouseDown={(e) => e.preventDefault()}
      onClick={onPick}
      onMouseEnter={onHover}
      className={cn("flex cursor-pointer items-center gap-3 rounded-2xl p-2", active && "bg-cream")}
    >
      <span className="relative size-12 shrink-0 overflow-hidden rounded-xl bg-cream-deep">
        <Image src={p.image.url} alt="" fill sizes="48px" className="object-cover" />
      </span>
      <span className="min-w-0 flex-1">
        <span className="block truncate text-sm font-bold text-charcoal">{p.name}</span>
        <span className="block text-xs text-muted">{p.brand}</span>
      </span>
      <span className="text-sm font-extrabold text-charcoal tabular-nums">{formatINR(p.pricing.salePrice)}</span>
    </li>
  );
}

/** Three paws pulsing in turn — shown only while a search request is in flight. */
export function PawLoader() {
  return (
    <span className="inline-flex items-center gap-1" role="status" aria-label="Searching">
      {[0, 1, 2].map((i) => (
        <PawIcon
          key={i}
          className="size-3.5 animate-[paw-pulse_1s_ease-in-out_infinite] text-orange"
          style={{ animationDelay: `${i * 0.15}s` }}
        />
      ))}
    </span>
  );
}
