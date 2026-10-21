"use client";

import { useRef, useState, type FormEvent, type ReactNode } from "react";
import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowDown, ArrowUp, ExternalLink, ImagePlus, Loader2, Plus, Trash2 } from "lucide-react";
import {
  adminProductInputSchema,
  PET_TYPES,
  type AdminBrandDTO,
  type AdminCategoryDTO,
  type AdminProductDTO,
  type AdminProductInput,
  type PetTypeValue,
} from "@nestama/shared";
import { errorMessage, uploadImage, useAdminMutation, useAdminQuery } from "@/lib/admin-client";
import { useToast } from "@/components/toast/ToastProvider";
import { FormAlert } from "@/components/ui/Field";
import { cn } from "@/lib/cn";
import { AdminPage, btn, Field, inputCls, LoadError, Panel, RupeeInput, Toggle } from "./AdminUI";

interface VariantRow {
  key: string;
  id?: string;
  sku: string;
  label: string;
  price: number | null;
  mrp: number | null;
  stock: string;
  lowStockThreshold: string;
  isDefault: boolean;
  hasOrders: boolean;
}

interface ImageRow {
  key: string;
  id?: string;
  url: string;
  alt: string;
  width: number;
  height: number;
}

interface Draft {
  name: string;
  slug: string;
  shortDescription: string;
  description: string;
  petType: PetTypeValue;
  categoryId: string;
  brandId: string;
  isActive: boolean;
  isFeatured: boolean;
  isSample: boolean;
  optionName: string;
  variants: VariantRow[];
  images: ImageRow[];
  specs: { key: string; label: string; value: string }[];
  tags: string;
}

let seq = 0;
const key = () => `k${++seq}`;
const PET_LABEL: Record<PetTypeValue, string> = { DOG: "Dogs", CAT: "Cats", BOTH: "Dogs & cats" };

function emptyVariant(isDefault: boolean): VariantRow {
  return { key: key(), sku: "", label: "", price: null, mrp: null, stock: "0", lowStockThreshold: "5", isDefault, hasOrders: false };
}

function fromProduct(p?: AdminProductDTO): Draft {
  if (!p) {
    return {
      name: "",
      slug: "",
      shortDescription: "",
      description: "",
      petType: "DOG",
      categoryId: "",
      brandId: "",
      isActive: true,
      isFeatured: false,
      isSample: false,
      optionName: "Size",
      variants: [emptyVariant(true)],
      images: [],
      specs: [],
      tags: "",
    };
  }
  return {
    name: p.name,
    slug: p.slug,
    shortDescription: p.shortDescription,
    description: p.description,
    petType: p.petType,
    categoryId: p.categoryId,
    brandId: p.brandId,
    isActive: p.isActive,
    isFeatured: p.isFeatured,
    isSample: p.isSample,
    optionName: Object.keys(p.variants[0]?.options ?? {})[0] ?? "",
    variants: p.variants.map((v) => ({
      key: key(),
      id: v.id,
      sku: v.sku,
      label: v.label,
      price: v.price,
      mrp: v.mrp,
      stock: String(v.stock),
      lowStockThreshold: String(v.lowStockThreshold),
      isDefault: v.isDefault,
      hasOrders: v.hasOrders,
    })),
    images: p.images.map((i) => ({ key: key(), ...i })),
    specs: p.specs.map((s) => ({ key: key(), ...s })),
    tags: p.tags.join(", "),
  };
}

function toInput(d: Draft): AdminProductInput {
  const option = d.optionName.trim();
  return {
    name: d.name,
    slug: d.slug,
    shortDescription: d.shortDescription,
    description: d.description,
    petType: d.petType,
    categoryId: d.categoryId,
    brandId: d.brandId,
    isActive: d.isActive,
    isFeatured: d.isFeatured,
    isSample: d.isSample,
    specs: d.specs.filter((s) => s.label.trim() || s.value.trim()).map(({ label, value }) => ({ label, value })),
    tags: d.tags
      .split(",")
      .map((t) => t.trim())
      .filter(Boolean),
    variants: d.variants.map((v) => ({
      id: v.id,
      sku: v.sku,
      label: v.label,
      options: option && v.label.trim() ? { [option]: v.label.trim() } : {},
      price: v.price ?? 0,
      mrp: v.mrp,
      stock: Number.parseInt(v.stock, 10) || 0,
      lowStockThreshold: Number.parseInt(v.lowStockThreshold, 10) || 0,
      isDefault: v.isDefault,
    })),
    images: d.images.map(({ id, url, alt, width, height }) => ({ id, url, alt, width, height })),
  };
}

function Section({
  title,
  description,
  children,
  action,
}: {
  title: string;
  description?: string;
  children: ReactNode;
  action?: ReactNode;
}) {
  return (
    <Panel
      title={
        <span>
          {title}
          {description && <span className="mt-0.5 block text-xs font-medium text-muted">{description}</span>}
        </span>
      }
      action={action}
    >
      {children}
    </Panel>
  );
}

export function ProductEditor({ id }: { id?: string }) {
  const product = useAdminQuery<AdminProductDTO>(["product", id], `/products/${id}`, {}, Boolean(id));
  if (id && product.isError)
    return (
      <AdminPage title="Edit product">
        <LoadError error={product.error} onRetry={() => void product.refetch()} />
      </AdminPage>
    );
  if (id && !product.data) {
    return (
      <AdminPage title="Edit product">
        <div className="space-y-4" aria-busy="true">
          <div className="h-64 skeleton rounded-2xl" />
          <div className="h-48 skeleton rounded-2xl" />
        </div>
      </AdminPage>
    );
  }
  return <ProductForm key={product.data?.id ?? "new"} product={product.data} />;
}

function ProductForm({ product }: { product?: AdminProductDTO }) {
  const router = useRouter();
  const { show } = useToast();
  const categories = useAdminQuery<AdminCategoryDTO[]>(["categories"], "/categories");
  const brands = useAdminQuery<AdminBrandDTO[]>(["brands"], "/brands");
  const [d, setD] = useState<Draft>(() => fromProduct(product));
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  const save = useAdminMutation<AdminProductInput, AdminProductDTO>(
    (input) =>
      product ? { path: `/products/${product.id}`, method: "PUT", body: input } : { path: "/products", method: "POST", body: input },
    [["products"], ["product"], ["inventory"], ["overview"]],
  );

  // Editing a field clears its message; the rest wait for the next save.
  const clearErrors = (match: (path: string) => boolean) =>
    setErrors((e) => {
      const keep = Object.entries(e).filter(([path]) => !match(path));
      return keep.length === Object.keys(e).length ? e : Object.fromEntries(keep);
    });
  const set = <K extends keyof Draft>(k: K, v: Draft[K]) => {
    setD((x) => ({ ...x, [k]: v }));
    clearErrors((path) => path === k || (k === "images" && path.startsWith("images.")));
  };
  const setVariant = (i: number, patch: Partial<VariantRow>) => {
    setD((x) => ({ ...x, variants: x.variants.map((v, j) => (j === i ? { ...v, ...patch } : v)) }));
    clearErrors((path) => Object.keys(patch).some((f) => path === `variants.${i}.${f}` || (f === "price" && path === `variants.${i}.mrp`)));
  };
  const err = (path: string) => errors[path];

  function move<T>(list: T[], i: number, by: number): T[] {
    const next = [...list];
    const [item] = next.splice(i, 1);
    next.splice(i + by, 0, item!);
    return next;
  }

  async function onFiles(files: FileList | null) {
    if (!files?.length) return;
    setUploading(true);
    try {
      for (const file of Array.from(files).slice(0, 10 - d.images.length)) {
        const up = await uploadImage(file);
        const alt = d.name ? `${d.name}` : file.name.replace(/\.[^.]+$/, "").replace(/[-_]+/g, " ");
        setD((x) => ({ ...x, images: [...x.images, { key: key(), url: up.url, alt, width: up.width, height: up.height }] }));
        clearErrors((path) => path === "images");
      }
    } catch (e) {
      show({ title: "Upload failed", description: errorMessage(e), icon: "alert" });
    } finally {
      setUploading(false);
      if (fileRef.current) fileRef.current.value = "";
    }
  }

  function onSubmit(e: FormEvent) {
    e.preventDefault();
    setFormError(null);
    const input = toInput(d);
    const parsed = adminProductInputSchema.safeParse(input);
    if (!parsed.success) {
      const map: Record<string, string> = {};
      for (const issue of parsed.error.issues) {
        const path = issue.path.join(".");
        if (!map[path]) map[path] = issue.message;
      }
      setErrors(map);
      setFormError("Check the highlighted fields.");
      return;
    }
    setErrors({});
    save.mutate(input, {
      onSuccess: (saved) => {
        show({ title: product ? "Product saved" : "Product created", description: saved.name, icon: "check", duration: 2500 });
        if (!product) router.replace(`/admin/products/${saved.id}`);
      },
      onError: (e2) => setFormError(errorMessage(e2)),
    });
  }

  return (
    <AdminPage
      title={product ? product.name : "New product"}
      description={
        product
          ? `/products/${product.slug} · ${product.soldCount} sold · ${product.ratingCount ? `rated ${product.ratingAvg.toFixed(1)} from ${product.ratingCount} review${product.ratingCount === 1 ? "" : "s"}` : "no reviews yet"}`
          : "Fill in the details, add at least one photo and one option."
      }
      actions={
        <>
          <Link href="/admin/products" className={btn.ghost}>
            All products
          </Link>
          {product && (
            <Link href={`/products/${product.slug}`} target="_blank" className={btn.outline}>
              <ExternalLink className="size-4" aria-hidden="true" /> View in store
            </Link>
          )}
        </>
      }
    >
      <form onSubmit={onSubmit} noValidate className="grid gap-6 xl:grid-cols-[1fr_20rem]">
        <div className="space-y-6">
          {formError && <FormAlert>{formError}</FormAlert>}

          <Section title="Details">
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="Name" error={err("name")} className="sm:col-span-2">
                {(p) => <input {...p} value={d.name} onChange={(e) => set("name", e.target.value)} className={inputCls} maxLength={120} />}
              </Field>
              <Field
                label="Short description"
                hint="One line under the name on the product page."
                error={err("shortDescription")}
                className="sm:col-span-2"
              >
                {(p) => (
                  <input
                    {...p}
                    value={d.shortDescription}
                    onChange={(e) => set("shortDescription", e.target.value)}
                    className={inputCls}
                    maxLength={200}
                  />
                )}
              </Field>
              <Field label="Description" error={err("description")} className="sm:col-span-2">
                {(p) => (
                  <textarea
                    {...p}
                    value={d.description}
                    onChange={(e) => set("description", e.target.value)}
                    rows={5}
                    maxLength={5000}
                    className={cn(inputCls, "h-auto py-2")}
                  />
                )}
              </Field>
              <Field label="Category" error={err("categoryId")}>
                {(p) => (
                  <select {...p} value={d.categoryId} onChange={(e) => set("categoryId", e.target.value)} className={inputCls}>
                    <option value="">Choose…</option>
                    {categories.data?.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.parentId ? `— ${c.name}` : c.name}
                      </option>
                    ))}
                  </select>
                )}
              </Field>
              <Field label="Brand" error={err("brandId")}>
                {(p) => (
                  <select {...p} value={d.brandId} onChange={(e) => set("brandId", e.target.value)} className={inputCls}>
                    <option value="">Choose…</option>
                    {brands.data?.map((b) => (
                      <option key={b.id} value={b.id}>
                        {b.name}
                      </option>
                    ))}
                  </select>
                )}
              </Field>
              <Field label="For" error={err("petType")}>
                {(p) => (
                  <select {...p} value={d.petType} onChange={(e) => set("petType", e.target.value as PetTypeValue)} className={inputCls}>
                    {PET_TYPES.map((t) => (
                      <option key={t} value={t}>
                        {PET_LABEL[t]}
                      </option>
                    ))}
                  </select>
                )}
              </Field>
              <Field label="URL" hint={d.slug ? `/products/${d.slug}` : "Leave blank to make one from the name."} error={err("slug")}>
                {(p) => (
                  <input
                    {...p}
                    value={d.slug}
                    onChange={(e) => set("slug", e.target.value.toLowerCase())}
                    placeholder="made-from-the-name"
                    className={inputCls}
                  />
                )}
              </Field>
            </div>
          </Section>

          <Section
            title="Photos"
            description="The first photo is the cover. Describe each one for screen readers."
            action={
              <>
                <input
                  ref={fileRef}
                  type="file"
                  accept="image/jpeg,image/png,image/webp,image/avif"
                  multiple
                  className="sr-only"
                  id="product-upload"
                  onChange={(e) => void onFiles(e.target.files)}
                />
                <label
                  htmlFor="product-upload"
                  className={cn(btn.outline, "cursor-pointer", (uploading || d.images.length >= 10) && "pointer-events-none opacity-50")}
                >
                  {uploading ? (
                    <Loader2 className="size-4 animate-spin" aria-hidden="true" />
                  ) : (
                    <ImagePlus className="size-4" aria-hidden="true" />
                  )}
                  {uploading ? "Uploading…" : "Upload"}
                </label>
              </>
            }
          >
            {err("images") && <p className="mb-3 text-xs font-semibold text-orange-ink">{err("images")}</p>}
            {d.images.length === 0 ? (
              <p className="rounded-xl border-2 border-dashed border-line px-4 py-8 text-center text-sm text-muted">
                No photos yet. Upload JPG, PNG, WebP or AVIF (up to 5 MB each).
              </p>
            ) : (
              <ul className="grid gap-3 sm:grid-cols-2">
                {d.images.map((img, i) => (
                  <li key={img.key} className="flex gap-3 rounded-xl p-2 ring-1 ring-line">
                    <span className="relative size-20 shrink-0 overflow-hidden rounded-lg bg-cream-deep">
                      <Image src={img.url} alt="" fill sizes="80px" className="object-cover" />
                      {i === 0 && (
                        <span className="absolute bottom-1 left-1 rounded bg-forest px-1.5 text-[10px] font-bold text-cream">Cover</span>
                      )}
                    </span>
                    <div className="min-w-0 flex-1">
                      <Field label="Alt text" error={err(`images.${i}.alt`)}>
                        {(p) => (
                          <input
                            {...p}
                            value={img.alt}
                            onChange={(e) => {
                              setD((x) => ({ ...x, images: x.images.map((m, j) => (j === i ? { ...m, alt: e.target.value } : m)) }));
                              clearErrors((path) => path === `images.${i}.alt`);
                            }}
                            className={inputCls}
                          />
                        )}
                      </Field>
                      <div className="mt-1.5 flex gap-1">
                        <button
                          type="button"
                          disabled={i === 0}
                          onClick={() => set("images", move(d.images, i, -1))}
                          className={btn.ghost}
                          aria-label={`Move photo ${i + 1} earlier`}
                        >
                          <ArrowUp className="size-4" aria-hidden="true" />
                        </button>
                        <button
                          type="button"
                          disabled={i === d.images.length - 1}
                          onClick={() => set("images", move(d.images, i, 1))}
                          className={btn.ghost}
                          aria-label={`Move photo ${i + 1} later`}
                        >
                          <ArrowDown className="size-4" aria-hidden="true" />
                        </button>
                        <button
                          type="button"
                          onClick={() =>
                            set(
                              "images",
                              d.images.filter((_, j) => j !== i),
                            )
                          }
                          className={cn(btn.ghost, "text-orange-ink")}
                          aria-label={`Remove photo ${i + 1}`}
                        >
                          <Trash2 className="size-4" aria-hidden="true" />
                        </button>
                      </div>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </Section>

          <Section
            title="Options & stock"
            description="Each option has its own SKU, price and stock. Prices are in rupees, GST inclusive."
            action={
              <button
                type="button"
                onClick={() => set("variants", [...d.variants, emptyVariant(false)])}
                className={btn.outline}
                disabled={d.variants.length >= 30}
              >
                <Plus className="size-4" aria-hidden="true" /> Add option
              </button>
            }
          >
            <Field label="Option type" hint="e.g. Size, Colour or Weight. Leave blank for a single version." className="mb-4 max-w-xs">
              {(p) => (
                <input
                  {...p}
                  value={d.optionName}
                  onChange={(e) => set("optionName", e.target.value)}
                  className={inputCls}
                  maxLength={30}
                />
              )}
            </Field>
            {err("variants") && <p className="mb-3 text-xs font-semibold text-orange-ink">{err("variants")}</p>}
            <div className="space-y-3">
              {d.variants.map((v, i) => (
                <fieldset key={v.key} className="rounded-xl p-3 ring-1 ring-line">
                  <legend className="sr-only">Option {i + 1}</legend>
                  <div className="mb-2 flex items-center justify-between gap-2">
                    <span className="text-xs font-bold text-muted" aria-hidden="true">
                      Option {i + 1}
                    </span>
                    <span className="flex items-center gap-1">
                      <label className="flex h-9 cursor-pointer items-center gap-1.5 px-2 text-xs font-bold text-forest">
                        <input
                          type="radio"
                          name="default-variant"
                          checked={v.isDefault}
                          onChange={() => setD((x) => ({ ...x, variants: x.variants.map((w, j) => ({ ...w, isDefault: j === i })) }))}
                          className="size-4 accent-forest"
                        />
                        Default
                      </label>
                      <button
                        type="button"
                        disabled={d.variants.length === 1}
                        onClick={() => {
                          setD((x) => {
                            const rest = x.variants.filter((_, j) => j !== i);
                            if (v.isDefault && rest[0]) rest[0] = { ...rest[0], isDefault: true };
                            return { ...x, variants: rest };
                          });
                          // Row indexes shift, so per-option messages no longer line up.
                          clearErrors((path) => path.startsWith("variants."));
                        }}
                        className={cn(btn.ghost, "text-orange-ink")}
                        aria-label={`Remove option ${v.label || i + 1}`}
                        title={v.hasOrders ? "Past orders keep their own copy of this option's name and price." : undefined}
                      >
                        <Trash2 className="size-4" aria-hidden="true" />
                      </button>
                    </span>
                  </div>
                  <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                    <Field label={d.optionName.trim() || "Name"} error={err(`variants.${i}.label`)} className="lg:col-span-2">
                      {(p) => (
                        <input
                          {...p}
                          value={v.label}
                          onChange={(e) => setVariant(i, { label: e.target.value })}
                          className={inputCls}
                          placeholder="Medium"
                        />
                      )}
                    </Field>
                    <Field label="SKU" error={err(`variants.${i}.sku`)} className="lg:col-span-2">
                      {(p) => (
                        <input
                          {...p}
                          value={v.sku}
                          onChange={(e) => setVariant(i, { sku: e.target.value.toUpperCase() })}
                          className={cn(inputCls, "font-mono")}
                          placeholder="TT-HAR-M"
                        />
                      )}
                    </Field>
                    <Field label="Price" error={err(`variants.${i}.price`)}>
                      {(p) => <RupeeInput {...p} value={v.price} onChange={(price) => setVariant(i, { price })} />}
                    </Field>
                    <Field label="MRP" hint="Optional" error={err(`variants.${i}.mrp`)}>
                      {(p) => <RupeeInput {...p} value={v.mrp} onChange={(mrp) => setVariant(i, { mrp })} />}
                    </Field>
                    <Field label="Stock" error={err(`variants.${i}.stock`)}>
                      {(p) => (
                        <input
                          {...p}
                          type="number"
                          min={0}
                          inputMode="numeric"
                          value={v.stock}
                          onChange={(e) => setVariant(i, { stock: e.target.value })}
                          className={inputCls}
                        />
                      )}
                    </Field>
                    <Field label="Alert at" hint="Low-stock warning" error={err(`variants.${i}.lowStockThreshold`)}>
                      {(p) => (
                        <input
                          {...p}
                          type="number"
                          min={0}
                          inputMode="numeric"
                          value={v.lowStockThreshold}
                          onChange={(e) => setVariant(i, { lowStockThreshold: e.target.value })}
                          className={inputCls}
                        />
                      )}
                    </Field>
                  </div>
                </fieldset>
              ))}
            </div>
          </Section>

          <Section
            title="Specifications"
            description="Shown as a table on the product page."
            action={
              <button
                type="button"
                onClick={() => set("specs", [...d.specs, { key: key(), label: "", value: "" }])}
                className={btn.outline}
                disabled={d.specs.length >= 20}
              >
                <Plus className="size-4" aria-hidden="true" /> Add row
              </button>
            }
          >
            {d.specs.length === 0 ? (
              <p className="text-sm text-muted">No specifications yet.</p>
            ) : (
              <ul className="space-y-2">
                {d.specs.map((s, i) => (
                  <li key={s.key} className="grid grid-cols-[1fr_1.6fr_auto] gap-2">
                    <input
                      aria-label={`Specification ${i + 1} name`}
                      value={s.label}
                      onChange={(e) =>
                        set(
                          "specs",
                          d.specs.map((x, j) => (j === i ? { ...x, label: e.target.value } : x)),
                        )
                      }
                      placeholder="Material"
                      className={inputCls}
                    />
                    <input
                      aria-label={`Specification ${i + 1} value`}
                      value={s.value}
                      onChange={(e) =>
                        set(
                          "specs",
                          d.specs.map((x, j) => (j === i ? { ...x, value: e.target.value } : x)),
                        )
                      }
                      placeholder="Breathable mesh"
                      className={inputCls}
                    />
                    <button
                      type="button"
                      onClick={() =>
                        set(
                          "specs",
                          d.specs.filter((_, j) => j !== i),
                        )
                      }
                      className={cn(btn.ghost, "text-orange-ink")}
                      aria-label={`Remove specification ${i + 1}`}
                    >
                      <Trash2 className="size-4" aria-hidden="true" />
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </Section>
        </div>

        <aside className="space-y-6 xl:sticky xl:top-8 xl:self-start">
          <Panel title="Visibility">
            <div className="space-y-3">
              <Toggle checked={d.isActive} onChange={(v) => set("isActive", v)} label="Show in the store" />
              <Toggle checked={d.isFeatured} onChange={(v) => set("isFeatured", v)} label="Featured on the homepage" />
              <Toggle checked={d.isSample} onChange={(v) => set("isSample", v)} label="Sample product" />
            </div>
          </Panel>
          <Panel title="Tags">
            <Field label="Search words" hint="Comma separated, e.g. harness, walking, reflective">
              {(p) => <input {...p} value={d.tags} onChange={(e) => set("tags", e.target.value)} className={inputCls} />}
            </Field>
          </Panel>
          <button type="submit" className={cn(btn.primary, "h-12 w-full text-base")} disabled={save.isPending || uploading}>
            {save.isPending && <Loader2 className="size-5 animate-spin" aria-hidden="true" />}
            {product ? "Save changes" : "Create product"}
          </button>
        </aside>
      </form>
    </AdminPage>
  );
}
