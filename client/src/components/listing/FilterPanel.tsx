"use client";

import { useId, useState, type ReactNode } from "react";
import { Star } from "lucide-react";
import type { ListingFacets } from "@nestama/shared";
import { toggleListValue } from "@/lib/listing-url";
import { cn } from "@/lib/cn";
import { useListing } from "./ListingShell";

export interface FilterPanelProps {
  facets: ListingFacets;
  /** Hide filters the route already fixes. */
  hide?: { category?: boolean; onSale?: boolean };
}

const pricePresets: { label: string; min?: number; max?: number }[] = [
  { label: "Under ₹500", max: 500 },
  { label: "₹500 – ₹1,000", min: 500, max: 1000 },
  { label: "₹1,000 – ₹2,500", min: 1000, max: 2500 },
  { label: "Over ₹2,500", min: 2500 },
];

export function FilterPanel({ facets, hide = {} }: FilterPanelProps) {
  const { params, update } = useListing();
  const pet = params.get("pet") ?? "";
  const brands = params.get("brand") ?? "";
  const category = params.get("category") ?? "";
  const min = params.get("minPrice") ?? "";
  const max = params.get("maxPrice") ?? "";
  const rating = params.get("rating") ?? "";
  const presetIndex = pricePresets.findIndex((p) => String(p.min ?? "") === min && String(p.max ?? "") === max);
  // A custom range selects no preset radio (rather than wrongly showing "Any price").
  const priceValue = presetIndex >= 0 ? String(presetIndex) : min || max ? "custom" : "-1";

  return (
    <div className="space-y-7">
      <Group title="Pet">
        <RadioList
          name="pet"
          value={pet}
          options={[
            { value: "", label: "All pets" },
            { value: "dog", label: "Dogs" },
            { value: "cat", label: "Cats" },
          ]}
          onChange={(v) => update({ pet: v || null })}
        />
      </Group>

      {!hide.category && facets.categories.length > 0 && (
        <Group title="Category">
          <RadioList
            name="category"
            value={category}
            options={[
              { value: "", label: "All categories" },
              ...facets.categories.map((c) => ({ value: c.slug, label: c.name, count: c.count })),
            ]}
            onChange={(v) => update({ category: v || null })}
          />
        </Group>
      )}

      {facets.brands.length > 0 && (
        <Group title="Brand">
          <ul className="space-y-1.5">
            {facets.brands.map((b) => {
              const checked = brands.split(",").includes(b.slug);
              return (
                <li key={b.slug}>
                  <Check
                    label={b.name}
                    count={b.count}
                    checked={checked}
                    disabled={!checked && b.count === 0}
                    onChange={() => update({ brand: toggleListValue(brands, b.slug) })}
                  />
                </li>
              );
            })}
          </ul>
        </Group>
      )}

      <Group title="Price">
        <RadioList
          name="price"
          value={priceValue}
          options={[{ value: "-1", label: "Any price" }, ...pricePresets.map((p, i) => ({ value: String(i), label: p.label }))]}
          onChange={(v) => {
            const preset = pricePresets[Number(v)];
            update({ minPrice: preset?.min ? String(preset.min) : null, maxPrice: preset?.max ? String(preset.max) : null });
          }}
        />
        <PriceRange
          key={`${min}-${max}`}
          min={min}
          max={max}
          floor={Math.floor(facets.price.min / 100)}
          ceiling={Math.ceil(facets.price.max / 100)}
        />
      </Group>

      <Group title="Customer rating">
        <RadioList
          name="rating"
          value={rating}
          options={[
            { value: "", label: "Any rating" },
            { value: "4", label: <StarsLabel n={4} /> },
            { value: "3", label: <StarsLabel n={3} /> },
          ]}
          onChange={(v) => update({ rating: v || null })}
        />
      </Group>

      <Group title="Availability">
        <ul className="space-y-1.5">
          <li>
            <Check
              label="In stock only"
              checked={params.has("inStock")}
              onChange={() => update({ inStock: params.has("inStock") ? null : "1" })}
            />
          </li>
          {!hide.onSale && (
            <li>
              <Check
                label="On sale"
                count={facets.onSaleCount}
                checked={params.has("onSale")}
                onChange={() => update({ onSale: params.has("onSale") ? null : "1" })}
              />
            </li>
          )}
        </ul>
      </Group>
    </div>
  );
}

function Group({ title, children }: { title: string; children: ReactNode }) {
  return (
    <fieldset>
      <legend className="mb-2.5 text-sm font-extrabold tracking-wide text-forest uppercase">{title}</legend>
      {children}
    </fieldset>
  );
}

function RadioList({
  name,
  value,
  options,
  onChange,
}: {
  name: string;
  value: string;
  options: { value: string; label: ReactNode; count?: number }[];
  onChange: (value: string) => void;
}) {
  const id = useId();
  return (
    <ul className="space-y-1.5">
      {options.map((o) => (
        <li key={o.value}>
          <label
            htmlFor={`${id}-${o.value}`}
            className="group flex cursor-pointer items-center gap-2.5 rounded-lg py-0.5 text-[14.5px] text-charcoal"
          >
            <input
              id={`${id}-${o.value}`}
              type="radio"
              name={`${id}-${name}`}
              checked={value === o.value}
              onChange={() => onChange(o.value)}
              className="size-4 accent-forest"
            />
            <span className="flex-1 group-hover:text-forest">{o.label}</span>
            {o.count !== undefined && <span className="text-xs text-muted tabular-nums">{o.count}</span>}
          </label>
        </li>
      ))}
    </ul>
  );
}

function Check({
  label,
  count,
  checked,
  disabled,
  onChange,
}: {
  label: string;
  count?: number;
  checked: boolean;
  disabled?: boolean;
  onChange: () => void;
}) {
  const id = useId();
  return (
    <label
      htmlFor={id}
      className={cn(
        "group flex cursor-pointer items-center gap-2.5 py-0.5 text-[14.5px] text-charcoal",
        disabled && "cursor-not-allowed opacity-45",
      )}
    >
      <input id={id} type="checkbox" checked={checked} disabled={disabled} onChange={onChange} className="size-4 rounded accent-forest" />
      <span className="flex-1 group-hover:text-forest">{label}</span>
      {count !== undefined && <span className="text-xs text-muted tabular-nums">{count}</span>}
    </label>
  );
}

function StarsLabel({ n }: { n: number }) {
  return (
    <span className="inline-flex items-center gap-1">
      <span className="sr-only">{n} stars</span>
      <span aria-hidden="true" className="inline-flex text-[#F5A524]">
        {Array.from({ length: 5 }, (_, i) => (
          <Star key={i} className={cn("size-3.5", i < n ? "fill-current" : "text-forest/20")} />
        ))}
      </span>
      & up
    </span>
  );
}

function PriceRange({ min, max, floor, ceiling }: { min: string; max: string; floor: number; ceiling: number }) {
  const { update } = useListing();
  const [lo, setLo] = useState(min);
  const [hi, setHi] = useState(max);
  const id = useId();
  const invalid = lo !== "" && hi !== "" && Number(lo) > Number(hi);

  return (
    <form
      className="mt-3 flex items-end gap-2"
      onSubmit={(e) => {
        e.preventDefault();
        if (!invalid) update({ minPrice: lo || null, maxPrice: hi || null });
      }}
    >
      <label htmlFor={`${id}-min`} className="flex-1 text-xs font-semibold text-muted">
        Min ₹
        <input
          id={`${id}-min`}
          inputMode="numeric"
          value={lo}
          placeholder={String(floor)}
          onChange={(e) => setLo(e.target.value.replace(/\D/g, ""))}
          className="mt-1 h-10 w-full rounded-xl border border-line bg-white px-2.5 text-sm text-charcoal tabular-nums outline-none focus:border-forest"
        />
      </label>
      <label htmlFor={`${id}-max`} className="flex-1 text-xs font-semibold text-muted">
        Max ₹
        <input
          id={`${id}-max`}
          inputMode="numeric"
          value={hi}
          placeholder={String(ceiling)}
          onChange={(e) => setHi(e.target.value.replace(/\D/g, ""))}
          aria-invalid={invalid}
          className="mt-1 h-10 w-full rounded-xl border border-line bg-white px-2.5 text-sm text-charcoal tabular-nums outline-none focus:border-forest"
        />
      </label>
      <button
        type="submit"
        disabled={invalid}
        className="h-10 rounded-xl bg-forest px-3 text-sm font-bold text-cream hover:bg-forest-700 disabled:opacity-50"
      >
        Go
      </button>
    </form>
  );
}
