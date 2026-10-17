"use client";

import { activeFilters } from "@/lib/listing-url";
import { useListing } from "./ListingShell";

export function ClearFiltersButton() {
  const { params, update } = useListing();
  const chips = activeFilters(params);
  if (chips.length === 0) return null;
  const clearAll = Object.fromEntries(chips.flatMap((c) => Object.keys(c.remove).map((k) => [k, null])));
  return (
    <button
      type="button"
      onClick={() => update(clearAll)}
      className="inline-flex h-11 items-center rounded-full bg-ember px-5 font-bold text-white hover:bg-ember-hover"
    >
      Clear filters
    </button>
  );
}
