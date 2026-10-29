"use client";

import { useState, type FormEvent } from "react";
import Image from "next/image";
import { Pencil, Plus, Search } from "lucide-react";
import {
  brandInputSchema,
  categoryInputSchema,
  firstFieldErrors,
  type AdminBrandDTO,
  type AdminCategoryDTO,
  type AdminInventoryRowDTO,
  type BrandInput,
  type CategoryInput,
  type DemoResetResultDTO,
} from "@nestama/shared";
import { errorMessage, useAdminMutation, useAdminQuery } from "@/lib/admin-client";
import { useToast } from "@/components/toast/ToastProvider";
import { Modal, useModalTarget } from "@/components/ui/Modal";
import { FormAlert } from "@/components/ui/Field";
import { cn } from "@/lib/cn";
import { AdminPage, Badge, btn, ConfirmButton, DataTable, Field, inputCls, LoadError, Panel, Toggle, useDebounced } from "./AdminUI";
import { ImageField } from "./fields";

// ───────── Categories ─────────

function CategoryForm({ category, all, onDone }: { category: AdminCategoryDTO | null; all: AdminCategoryDTO[]; onDone: () => void }) {
  const { show } = useToast();
  const [f, setF] = useState<CategoryInput>({
    name: category?.name ?? "",
    slug: category?.slug ?? "",
    description: category?.description ?? "",
    imageUrl: category?.imageUrl ?? "",
    imageAlt: category?.imageAlt ?? "",
    parentId: category?.parentId ?? null,
    sortOrder: category?.sortOrder ?? 0,
    showOnHome: category?.showOnHome ?? true,
    homeLabel: category?.homeLabel ?? "",
  });
  const [errors, setErrors] = useState<Record<string, string | undefined>>({});
  const save = useAdminMutation<CategoryInput, AdminCategoryDTO[]>(
    (input) =>
      category ? { path: `/categories/${category.id}`, method: "PUT", body: input } : { path: "/categories", method: "POST", body: input },
    [["categories"]],
  );
  const set = <K extends keyof CategoryInput>(k: K, v: CategoryInput[K]) => setF((x) => ({ ...x, [k]: v }));
  // Only top-level categories can be parents, and never the category itself.
  const parents = all.filter((c) => !c.parentId && c.id !== category?.id);

  function onSubmit(e: FormEvent) {
    e.preventDefault();
    const parsed = categoryInputSchema.safeParse(f);
    if (!parsed.success) return setErrors(firstFieldErrors(parsed.error));
    setErrors({});
    save.mutate(f, {
      onSuccess: () => {
        show({ title: category ? "Category saved" : "Category added", description: f.name, icon: "check", duration: 2500 });
        onDone();
      },
    });
  }

  return (
    <form onSubmit={onSubmit} noValidate className="grid gap-4 sm:grid-cols-2">
      {save.isError && <FormAlert className="sm:col-span-2">{errorMessage(save.error)}</FormAlert>}
      <Field label="Name" error={errors.name}>
        {(p) => <input {...p} value={f.name} onChange={(e) => set("name", e.target.value)} className={inputCls} />}
      </Field>
      <Field label="Parent" hint="Leave as top level, or nest one level down.">
        {(p) => (
          <select {...p} value={f.parentId ?? ""} onChange={(e) => set("parentId", e.target.value || null)} className={inputCls}>
            <option value="">Top level</option>
            {parents.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>
        )}
      </Field>
      <Field label="Description" className="sm:col-span-2" error={errors.description}>
        {(p) => (
          <textarea
            {...p}
            rows={2}
            value={f.description}
            onChange={(e) => set("description", e.target.value)}
            className={cn(inputCls, "h-auto py-2")}
          />
        )}
      </Field>
      <ImageField
        label="Image"
        value={f.imageUrl}
        onChange={(url) => set("imageUrl", url)}
        error={errors.imageUrl}
        className="sm:col-span-2"
      />
      <Field label="Image description" error={errors.imageAlt}>
        {(p) => <input {...p} value={f.imageAlt} onChange={(e) => set("imageAlt", e.target.value)} className={inputCls} />}
      </Field>
      <Field label="Home card label" hint="Optional shorter name for the homepage circle." error={errors.homeLabel}>
        {(p) => <input {...p} value={f.homeLabel ?? ""} onChange={(e) => set("homeLabel", e.target.value)} className={inputCls} />}
      </Field>
      <Field label="Order" hint="Lower numbers come first.">
        {(p) => (
          <input
            {...p}
            type="number"
            min={0}
            value={f.sortOrder}
            onChange={(e) => set("sortOrder", Number.parseInt(e.target.value, 10) || 0)}
            className={inputCls}
          />
        )}
      </Field>
      <div className="flex items-end pb-2">
        <Toggle checked={f.showOnHome ?? true} onChange={(v) => set("showOnHome", v)} label="Show on the homepage" />
      </div>
      <div className="sm:col-span-2">
        <button type="submit" className={btn.primary} disabled={save.isPending}>
          {category ? "Save category" : "Add category"}
        </button>
      </div>
    </form>
  );
}

export function CategoryManager() {
  const { show } = useToast();
  const list = useAdminQuery<AdminCategoryDTO[]>(["categories"], "/categories");
  const dialog = useModalTarget<AdminCategoryDTO | "new">();
  const remove = useAdminMutation<string, AdminCategoryDTO[]>((id) => ({ path: `/categories/${id}`, method: "DELETE" }), [["categories"]]);

  // Parents first, each followed by its children.
  const rows = (list.data ?? []).filter((c) => !c.parentId).flatMap((p) => [p, ...(list.data ?? []).filter((c) => c.parentId === p.id)]);

  return (
    <AdminPage
      title="Categories"
      description="Organise the catalogue. Categories nest one level deep."
      actions={
        <button type="button" onClick={() => dialog.show("new")} className={btn.primary}>
          <Plus className="size-4" aria-hidden="true" /> New category
        </button>
      }
    >
      <Panel>
        {list.isError ? (
          <LoadError error={list.error} onRetry={() => void list.refetch()} />
        ) : (
          <DataTable
            caption="Categories"
            rows={rows}
            rowKey={(c) => c.id}
            loading={list.isPending}
            columns={[
              {
                key: "name",
                header: "Category",
                cell: (c) => (
                  <span className={cn("flex items-center gap-3", c.parentId && "pl-8")}>
                    <span className="relative size-9 shrink-0 overflow-hidden rounded-full bg-peach">
                      {c.imageUrl && <Image src={c.imageUrl} alt="" fill sizes="36px" className="object-cover" />}
                    </span>
                    <span>
                      <span className="block font-bold">{c.name}</span>
                      <span className="text-xs text-muted">/c/{c.slug}</span>
                    </span>
                  </span>
                ),
              },
              { key: "home", header: "Homepage", cell: (c) => (c.showOnHome ? <Badge tone="green">Shown</Badge> : <Badge>Hidden</Badge>) },
              { key: "products", header: "Products", align: "right", cell: (c) => c.productCount },
              { key: "order", header: "Order", align: "right", cell: (c) => c.sortOrder },
              {
                key: "actions",
                header: <span className="sr-only">Actions</span>,
                align: "right",
                cell: (c) => (
                  <span className="inline-flex items-center gap-1">
                    <button type="button" onClick={() => dialog.show(c)} className={btn.ghost} aria-label={`Edit ${c.name}`}>
                      <Pencil className="size-4" aria-hidden="true" />
                    </button>
                    <ConfirmButton
                      label="Delete"
                      confirmLabel="Delete"
                      pending={remove.isPending}
                      onConfirm={() =>
                        remove.mutate(c.id, {
                          onSuccess: () => show({ title: "Category deleted", description: c.name, icon: "check", duration: 2500 }),
                          onError: (e) => show({ title: "Couldn't delete", description: errorMessage(e), icon: "alert" }),
                        })
                      }
                    />
                  </span>
                ),
              },
            ]}
          />
        )}
      </Panel>
      <Modal open={dialog.open} onClose={dialog.close} title={dialog.target === "new" ? "New category" : "Edit category"} size="wide">
        <CategoryForm category={dialog.target === "new" ? null : dialog.target} all={list.data ?? []} onDone={dialog.close} />
      </Modal>
    </AdminPage>
  );
}

// ───────── Brands ─────────

function BrandForm({ brand, onDone }: { brand: AdminBrandDTO | null; onDone: () => void }) {
  const { show } = useToast();
  const [f, setF] = useState<BrandInput>({ name: brand?.name ?? "", slug: brand?.slug ?? "", description: brand?.description ?? "" });
  const [errors, setErrors] = useState<Record<string, string | undefined>>({});
  const save = useAdminMutation<BrandInput, AdminBrandDTO[]>(
    (input) => (brand ? { path: `/brands/${brand.id}`, method: "PUT", body: input } : { path: "/brands", method: "POST", body: input }),
    [["brands"]],
  );
  return (
    <form
      noValidate
      className="space-y-4"
      onSubmit={(e) => {
        e.preventDefault();
        const parsed = brandInputSchema.safeParse(f);
        if (!parsed.success) return setErrors(firstFieldErrors(parsed.error));
        setErrors({});
        save.mutate(f, {
          onSuccess: () => {
            show({ title: brand ? "Brand saved" : "Brand added", description: f.name, icon: "check", duration: 2500 });
            onDone();
          },
        });
      }}
    >
      {save.isError && <FormAlert>{errorMessage(save.error)}</FormAlert>}
      <Field label="Name" error={errors.name}>
        {(p) => <input {...p} value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} className={inputCls} />}
      </Field>
      <Field label="Description" error={errors.description}>
        {(p) => (
          <textarea
            {...p}
            rows={3}
            value={f.description}
            onChange={(e) => setF({ ...f, description: e.target.value })}
            className={cn(inputCls, "h-auto py-2")}
          />
        )}
      </Field>
      <button type="submit" className={btn.primary} disabled={save.isPending}>
        {brand ? "Save brand" : "Add brand"}
      </button>
    </form>
  );
}

export function BrandManager() {
  const { show } = useToast();
  const list = useAdminQuery<AdminBrandDTO[]>(["brands"], "/brands");
  const dialog = useModalTarget<AdminBrandDTO | "new">();
  const remove = useAdminMutation<string, AdminBrandDTO[]>((id) => ({ path: `/brands/${id}`, method: "DELETE" }), [["brands"]]);
  return (
    <AdminPage
      title="Brands"
      actions={
        <button type="button" onClick={() => dialog.show("new")} className={btn.primary}>
          <Plus className="size-4" aria-hidden="true" /> New brand
        </button>
      }
    >
      <Panel>
        {list.isError ? (
          <LoadError error={list.error} onRetry={() => void list.refetch()} />
        ) : (
          <DataTable
            caption="Brands"
            rows={list.data}
            rowKey={(b) => b.id}
            loading={list.isPending}
            columns={[
              { key: "name", header: "Brand", cell: (b) => <span className="font-bold">{b.name}</span> },
              {
                key: "desc",
                header: "Description",
                cell: (b) => <span className="line-clamp-1 max-w-md text-muted">{b.description || "—"}</span>,
              },
              { key: "products", header: "Products", align: "right", cell: (b) => b.productCount },
              {
                key: "actions",
                header: <span className="sr-only">Actions</span>,
                align: "right",
                cell: (b) => (
                  <span className="inline-flex items-center gap-1">
                    <button type="button" onClick={() => dialog.show(b)} className={btn.ghost} aria-label={`Edit ${b.name}`}>
                      <Pencil className="size-4" aria-hidden="true" />
                    </button>
                    <ConfirmButton
                      label="Delete"
                      confirmLabel="Delete"
                      pending={remove.isPending}
                      onConfirm={() =>
                        remove.mutate(b.id, {
                          onSuccess: () => show({ title: "Brand deleted", description: b.name, icon: "check", duration: 2500 }),
                          onError: (e) => show({ title: "Couldn't delete", description: errorMessage(e), icon: "alert" }),
                        })
                      }
                    />
                  </span>
                ),
              },
            ]}
          />
        )}
      </Panel>
      <Modal open={dialog.open} onClose={dialog.close} title={dialog.target === "new" ? "New brand" : "Edit brand"}>
        <BrandForm brand={dialog.target === "new" ? null : dialog.target} onDone={dialog.close} />
      </Modal>
    </AdminPage>
  );
}

// ───────── Inventory ─────────

export function Inventory({ initialLow = false }: { initialLow?: boolean }) {
  const { show } = useToast();
  const [q, setQ] = useState("");
  const [low, setLow] = useState(initialLow);
  const search = useDebounced(q.trim());
  const list = useAdminQuery<AdminInventoryRowDTO[]>(["inventory"], "/inventory", { q: search, low: low ? "1" : undefined });
  const [edits, setEdits] = useState<Record<string, string>>({});
  const save = useAdminMutation<{ items: { variantId: string; stock: number }[] }, { updated: number }>(
    (body) => ({ path: "/inventory", method: "PATCH", body }),
    [["inventory"], ["products"], ["overview"]],
  );
  // Live demo: restore stock and renew the seeded deals now (it also runs on its own every day).
  const reset = useAdminMutation<void, DemoResetResultDTO>(
    () => ({ path: "/demo/reset", method: "POST" }),
    [["inventory"], ["products"], ["overview"], ["promotions"], ["coupons"]],
  );
  const changed = Object.entries(edits).filter(([id, v]) => {
    const row = list.data?.find((r) => r.variantId === id);
    return row && v !== "" && Number(v) !== row.stock && Number(v) >= 0;
  });

  return (
    <AdminPage
      title="Inventory"
      description="Stock for every product option. Edit the numbers, then save them together."
      actions={
        <div className="flex flex-wrap items-center gap-2">
          <ConfirmButton
            label="Reset demo stock"
            confirmLabel="Reset now"
            pending={reset.isPending}
            onConfirm={() =>
              reset.mutate(undefined, {
                onSuccess: (r) => {
                  setEdits({});
                  show({
                    title: "Demo reset",
                    description: `${r.restockedVariants} option${r.restockedVariants === 1 ? "" : "s"} restocked, ${r.renewedDeals} deal${r.renewedDeals === 1 ? "" : "s"} renewed.`,
                    icon: "check",
                    duration: 3500,
                  });
                },
                onError: (e) => show({ title: "Couldn't reset the demo", description: errorMessage(e), icon: "alert" }),
              })
            }
          />
          <button
            type="button"
            className={btn.primary}
            disabled={changed.length === 0 || save.isPending}
            onClick={() =>
              save.mutate(
                { items: changed.map(([variantId, v]) => ({ variantId, stock: Number.parseInt(v, 10) })) },
                {
                  onSuccess: (r) => {
                    setEdits({});
                    show({ title: `Stock updated for ${r.updated} option${r.updated === 1 ? "" : "s"}`, icon: "check", duration: 2500 });
                  },
                  onError: (e) => show({ title: "Couldn't save stock", description: errorMessage(e), icon: "alert" }),
                },
              )
            }
          >
            Save {changed.length > 0 ? `${changed.length} change${changed.length === 1 ? "" : "s"}` : "changes"}
          </button>
        </div>
      }
    >
      <Panel>
        <div className="mb-4 flex flex-wrap items-center gap-3">
          <label className="relative min-w-[14rem] flex-1">
            <span className="sr-only">Search inventory</span>
            <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted" aria-hidden="true" />
            <input
              type="search"
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Product, option or SKU"
              className={cn(inputCls, "pl-9")}
            />
          </label>
          <Toggle checked={low} onChange={setLow} label="Only low stock" />
        </div>
        {list.isError ? (
          <LoadError error={list.error} onRetry={() => void list.refetch()} />
        ) : (
          <DataTable
            caption="Inventory"
            rows={list.data}
            rowKey={(r) => r.variantId}
            loading={list.isPending}
            dim={list.isPlaceholderData}
            empty={low ? "Nothing is running low." : "No options match."}
            columns={[
              {
                key: "product",
                header: "Product",
                cell: (r) => (
                  <span className="flex items-center gap-3">
                    <span className="relative size-9 shrink-0 overflow-hidden rounded-lg bg-cream-deep">
                      {r.image && <Image src={r.image} alt="" fill sizes="36px" className="object-cover" />}
                    </span>
                    <span className="min-w-0">
                      <span className="block max-w-[16rem] truncate font-bold">{r.productName}</span>
                      <span className="text-xs text-muted">{r.productActive ? r.label : `${r.label} · hidden`}</span>
                    </span>
                  </span>
                ),
              },
              { key: "sku", header: "SKU", cell: (r) => <span className="font-mono text-xs">{r.sku}</span> },
              {
                key: "state",
                header: "Status",
                cell: (r) =>
                  r.stock === 0 ? (
                    <Badge tone="orange">Sold out</Badge>
                  ) : r.stock <= r.lowStockThreshold ? (
                    <Badge>Low (≤ {r.lowStockThreshold})</Badge>
                  ) : (
                    <Badge tone="green">OK</Badge>
                  ),
              },
              {
                key: "stock",
                header: "Stock",
                align: "right",
                cell: (r) => (
                  <input
                    type="number"
                    min={0}
                    inputMode="numeric"
                    aria-label={`Stock for ${r.productName}, ${r.label}`}
                    value={edits[r.variantId] ?? String(r.stock)}
                    onChange={(e) => setEdits((x) => ({ ...x, [r.variantId]: e.target.value }))}
                    className={cn(
                      inputCls,
                      "ml-auto w-24 text-right",
                      edits[r.variantId] !== undefined && Number(edits[r.variantId]) !== r.stock && "border-forest bg-sage/40",
                    )}
                  />
                ),
              },
            ]}
          />
        )}
      </Panel>
    </AdminPage>
  );
}
