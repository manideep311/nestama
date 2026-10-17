"use client";

import { useMemo, useState } from "react";
import Image from "next/image";
import { Search } from "lucide-react";
import type { AdminCategoryDTO, AdminInventoryRowDTO, DISCOUNT_SCOPES } from "@nestama/shared";
import { errorMessage, uploadImage, useAdminQuery } from "@/lib/admin-client";
import { useToast } from "@/components/toast/ToastProvider";
import { cn } from "@/lib/cn";
import { btn, Field, inputCls } from "./AdminUI";

// Form pieces shared by promotions, coupons, categories and settings.

export type Scope = (typeof DISCOUNT_SCOPES)[number];

/** A photo field: paste an https:// link or upload one (stored under /uploads or on Cloudinary). */
export function ImageField({
  label,
  value,
  onChange,
  error,
  hint = "Upload a photo or paste an https:// link.",
  className,
}: {
  label: string;
  value: string;
  onChange: (url: string) => void;
  error?: string;
  hint?: string;
  className?: string;
}) {
  const { show } = useToast();
  const [uploading, setUploading] = useState(false);
  return (
    <Field label={label} error={error} hint={hint} className={className}>
      {(p) => (
        <div className="flex gap-2">
          {value && (
            <span className="relative size-10 shrink-0 overflow-hidden rounded-lg bg-cream-deep ring-1 ring-line">
              <Image src={value} alt="" fill sizes="40px" className="object-cover" />
            </span>
          )}
          <input {...p} value={value} onChange={(e) => onChange(e.target.value)} className={inputCls} />
          <label className={cn(btn.outline, "shrink-0 cursor-pointer", uploading && "pointer-events-none opacity-50")}>
            {uploading ? "Uploading…" : "Upload"}
            <input
              type="file"
              accept="image/jpeg,image/png,image/webp,image/avif"
              className="sr-only"
              onChange={async (e) => {
                const input = e.currentTarget;
                const file = input.files?.[0];
                if (!file) return;
                setUploading(true);
                try {
                  onChange((await uploadImage(file)).url);
                } catch (err) {
                  show({ title: "Upload failed", description: errorMessage(err), icon: "alert" });
                } finally {
                  setUploading(false);
                  input.value = "";
                }
              }}
            />
          </label>
        </div>
      )}
    </Field>
  );
}

/** Start and end in India time (datetime-local has no zone; see lib/ist.ts). */
export function ScheduleFields({
  startsAt,
  endsAt,
  onChange,
  errors,
}: {
  startsAt: string;
  endsAt: string;
  onChange: (patch: { startsAt?: string; endsAt?: string }) => void;
  errors: { startsAt?: string; endsAt?: string };
}) {
  return (
    <>
      <Field label="Starts (India time)" error={errors.startsAt}>
        {(p) => (
          <input
            {...p}
            type="datetime-local"
            value={startsAt}
            onChange={(e) => onChange({ startsAt: e.target.value })}
            className={inputCls}
          />
        )}
      </Field>
      <Field label="Ends (India time)" error={errors.endsAt}>
        {(p) => (
          <input {...p} type="datetime-local" value={endsAt} onChange={(e) => onChange({ endsAt: e.target.value })} className={inputCls} />
        )}
      </Field>
    </>
  );
}

const SCOPE_LABEL: Record<Scope, string> = { ALL: "Everything", CATEGORIES: "Some categories", PRODUCTS: "Some products" };

/**
 * What a discount applies to. Choosing a top-level category also covers its sub-categories, matching
 * how the storefront prices products.
 */
export function ScopeFields({
  scope,
  categoryIds,
  productIds,
  onChange,
  error,
}: {
  scope: Scope;
  categoryIds: string[];
  productIds: string[];
  onChange: (patch: { scope?: Scope; categoryIds?: string[]; productIds?: string[] }) => void;
  error?: string;
}) {
  const toggle = (list: string[], id: string) => (list.includes(id) ? list.filter((x) => x !== id) : [...list, id]);
  return (
    <fieldset className="space-y-3">
      <legend className="mb-1 text-xs font-bold text-forest">Applies to</legend>
      <div className="flex flex-wrap gap-2">
        {(Object.keys(SCOPE_LABEL) as Scope[]).map((s) => (
          <label
            key={s}
            className={cn(
              "relative flex h-9 cursor-pointer items-center gap-2 rounded-full px-3.5 text-sm font-semibold ring-1 transition-colors has-focus-visible:outline-2 has-focus-visible:outline-forest",
              scope === s ? "bg-forest text-cream ring-forest" : "bg-white text-forest ring-line hover:bg-sage",
            )}
          >
            <input type="radio" name="scope" value={s} checked={scope === s} onChange={() => onChange({ scope: s })} className="sr-only" />
            {SCOPE_LABEL[s]}
          </label>
        ))}
      </div>
      {error && <p className="text-xs font-semibold text-orange-ink">{error}</p>}
      {scope === "CATEGORIES" && (
        <CategoryChecklist selected={categoryIds} onToggle={(id) => onChange({ categoryIds: toggle(categoryIds, id) })} />
      )}
      {scope === "PRODUCTS" && (
        <ProductChecklist selected={productIds} onToggle={(id) => onChange({ productIds: toggle(productIds, id) })} />
      )}
    </fieldset>
  );
}

function CategoryChecklist({ selected, onToggle }: { selected: string[]; onToggle: (id: string) => void }) {
  const categories = useAdminQuery<AdminCategoryDTO[]>(["categories"], "/categories");
  const all = categories.data ?? [];
  const rows = all.filter((c) => !c.parentId).flatMap((p) => [p, ...all.filter((c) => c.parentId === p.id)]);
  if (categories.isPending) return <div className="h-32 skeleton rounded-xl" />;
  return (
    <ul className="grid gap-1 rounded-xl bg-white p-2 ring-1 ring-line sm:grid-cols-2" aria-label="Categories">
      {rows.map((c) => (
        <li key={c.id}>
          <label
            className={cn("flex h-9 cursor-pointer items-center gap-2.5 rounded-lg px-2 text-sm hover:bg-sage/60", c.parentId && "pl-7")}
          >
            <input type="checkbox" checked={selected.includes(c.id)} onChange={() => onToggle(c.id)} className="size-4 accent-forest" />
            <span className={c.parentId ? undefined : "font-semibold"}>{c.name}</span>
            {!c.parentId && all.some((x) => x.parentId === c.id) && <span className="text-xs text-muted">+ sub-categories</span>}
          </label>
        </li>
      ))}
    </ul>
  );
}

function ProductChecklist({ selected, onToggle }: { selected: string[]; onToggle: (id: string) => void }) {
  // The inventory list carries every product (one row per option), so it doubles as a product index.
  const inventory = useAdminQuery<AdminInventoryRowDTO[]>(["inventory"], "/inventory");
  const [q, setQ] = useState("");
  const products = useMemo(() => {
    const seen = new Map<string, { id: string; name: string; image: string | null; active: boolean }>();
    for (const r of inventory.data ?? [])
      if (!seen.has(r.productId)) seen.set(r.productId, { id: r.productId, name: r.productName, image: r.image, active: r.productActive });
    return [...seen.values()].sort((a, b) => a.name.localeCompare(b.name));
  }, [inventory.data]);
  const needle = q.trim().toLowerCase();
  // Chosen products stay on top so they're easy to review and remove.
  const shown = products
    .filter((p) => selected.includes(p.id) || !needle || p.name.toLowerCase().includes(needle))
    .sort((a, b) => Number(selected.includes(b.id)) - Number(selected.includes(a.id)));

  if (inventory.isPending) return <div className="h-40 skeleton rounded-xl" />;
  return (
    <div className="rounded-xl bg-white p-2 ring-1 ring-line">
      <div className="flex items-center gap-2 p-1">
        <label className="relative flex-1">
          <span className="sr-only">Search products</span>
          <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted" aria-hidden="true" />
          <input
            type="search"
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Search products"
            className={cn(inputCls, "h-9 pl-9")}
          />
        </label>
        <span className="shrink-0 px-2 text-xs font-bold text-forest" aria-live="polite">
          {selected.length} chosen
        </span>
      </div>
      <ul className="mt-1 max-h-60 overflow-y-auto" aria-label="Products">
        {shown.map((p) => (
          <li key={p.id}>
            <label className="flex h-11 cursor-pointer items-center gap-2.5 rounded-lg px-2 text-sm hover:bg-sage/60">
              <input
                type="checkbox"
                checked={selected.includes(p.id)}
                onChange={() => onToggle(p.id)}
                className="size-4 shrink-0 accent-forest"
              />
              <span className="relative size-8 shrink-0 overflow-hidden rounded-md bg-cream-deep">
                {p.image && <Image src={p.image} alt="" fill sizes="32px" className="object-cover" />}
              </span>
              <span className="min-w-0 truncate">{p.name}</span>
              {!p.active && <span className="shrink-0 text-xs text-muted">hidden</span>}
            </label>
          </li>
        ))}
        {shown.length === 0 && <li className="px-2 py-4 text-center text-sm text-muted">No products match.</li>}
      </ul>
    </div>
  );
}

/** Map zod issues to the first message per dotted path. */
export function issueMap(issues: { path: PropertyKey[]; message: string }[]): Record<string, string> {
  const map: Record<string, string> = {};
  for (const issue of issues) {
    const path = issue.path.map(String).join(".");
    if (!map[path]) map[path] = issue.message;
  }
  return map;
}
