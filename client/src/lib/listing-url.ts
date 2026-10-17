// Listing state lives in the URL. These helpers keep URLs clean and shareable.

export const LISTING_KEYS = [
  "pet",
  "category",
  "brand",
  "minPrice",
  "maxPrice",
  "rating",
  "inStock",
  "onSale",
  "q",
  "sort",
  "page",
] as const;
export type ListingKey = (typeof LISTING_KEYS)[number];
export type ListingPatch = Partial<Record<ListingKey, string | null>>;

const DEFAULTS: Partial<Record<ListingKey, string>> = { sort: "featured", page: "1" };

/** New href with `patch` applied. Any change other than `page` sends the shopper back to page 1. */
export function hrefWith(pathname: string, current: URLSearchParams, patch: ListingPatch): string {
  const next = new URLSearchParams(current);
  if (!("page" in patch)) next.delete("page");
  for (const [key, value] of Object.entries(patch)) {
    if (value === null || value === undefined || value === "" || DEFAULTS[key as ListingKey] === value) next.delete(key);
    else next.set(key, value);
  }
  const qs = next.toString().replace(/%2C/g, ",");
  return qs ? `${pathname}?${qs}` : pathname;
}

/** Toggle `value` in a comma-separated list; null when the list becomes empty. */
export function toggleListValue(list: string, value: string): string | null {
  const items = list.split(",").filter(Boolean);
  const next = items.includes(value) ? items.filter((v) => v !== value) : [...items, value];
  return next.length ? next.join(",") : null;
}

export interface FilterChip {
  key: string;
  label: string;
  remove: ListingPatch;
}

/** Human labels for the active filters, each with the patch that removes it. */
export function activeFilters(params: URLSearchParams, names: { brandNames?: Record<string, string> } = {}): FilterChip[] {
  const chips: FilterChip[] = [];
  const pet = params.get("pet");
  if (pet === "dog" || pet === "cat") chips.push({ key: "pet", label: pet === "dog" ? "Dogs" : "Cats", remove: { pet: null } });

  const brands = (params.get("brand") ?? "").split(",").filter(Boolean);
  for (const slug of brands) {
    chips.push({
      key: `brand-${slug}`,
      label: names.brandNames?.[slug] ?? slug,
      remove: { brand: toggleListValue(brands.join(","), slug) },
    });
  }

  const min = params.get("minPrice");
  const max = params.get("maxPrice");
  if (min) chips.push({ key: "minPrice", label: `From ₹${Number(min).toLocaleString("en-IN")}`, remove: { minPrice: null } });
  if (max) chips.push({ key: "maxPrice", label: `Up to ₹${Number(max).toLocaleString("en-IN")}`, remove: { maxPrice: null } });

  const rating = params.get("rating");
  if (rating) chips.push({ key: "rating", label: `${rating}★ & up`, remove: { rating: null } });
  if (params.get("inStock")) chips.push({ key: "inStock", label: "In stock", remove: { inStock: null } });
  if (params.get("onSale")) chips.push({ key: "onSale", label: "On sale", remove: { onSale: null } });

  const q = params.get("q");
  if (q) chips.push({ key: "q", label: `“${q}”`, remove: { q: null } });
  return chips;
}

/** Query string for the API: only known keys, plus fixed values from the route (e.g. category). */
export function apiQueryString(params: Record<string, string | string[] | undefined>, fixed: ListingPatch = {}): string {
  const out = new URLSearchParams();
  for (const key of LISTING_KEYS) {
    if (key in fixed) continue;
    const raw = params[key];
    const value = Array.isArray(raw) ? raw[0] : raw;
    if (value) out.set(key, value);
  }
  for (const [key, value] of Object.entries(fixed)) if (value) out.set(key, value);
  return out.toString().replace(/%2C/g, ",");
}
