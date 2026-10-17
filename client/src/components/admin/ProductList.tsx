"use client";

import { useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { Plus, Search } from "lucide-react";
import { formatINR, type AdminCategoryDTO, type AdminProductRowDTO, type Paginated } from "@nestama/shared";
import { useAdminMutation, useAdminQuery } from "@/lib/admin-client";
import { useToast } from "@/components/toast/ToastProvider";
import { cn } from "@/lib/cn";
import { AdminPage, Badge, btn, DataTable, inputCls, LoadError, Pager, Panel, Toggle, useDebounced, type Column } from "./AdminUI";

const PET = { DOG: "Dog", CAT: "Cat", BOTH: "Dog & cat" } as const;

export function ProductList() {
  const { show } = useToast();
  const [q, setQ] = useState("");
  const [category, setCategory] = useState("");
  const [status, setStatus] = useState("");
  const [stock, setStock] = useState("");
  const [page, setPage] = useState(1);
  const search = useDebounced(q.trim());
  const list = useAdminQuery<Paginated<AdminProductRowDTO>>(["products"], "/products", { q: search, category, status, stock, page });
  const categories = useAdminQuery<AdminCategoryDTO[]>(["categories"], "/categories");
  const setActive = useAdminMutation<{ id: string; isActive: boolean }, unknown>(
    ({ id, isActive }) => ({ path: `/products/${id}/active`, method: "PATCH", body: { isActive } }),
    [["products"], ["inventory"]],
  );

  const reset = () => setPage(1);

  const columns: Column<AdminProductRowDTO>[] = [
    {
      key: "product",
      header: "Product",
      cell: (p) => (
        <span className="flex items-center gap-3">
          <span className="relative size-10 shrink-0 overflow-hidden rounded-lg bg-cream-deep">
            {p.image && <Image src={p.image} alt="" fill sizes="40px" className="object-cover" />}
          </span>
          <span className="min-w-0">
            <Link href={`/admin/products/${p.id}`} className="block max-w-[18rem] truncate font-bold text-charcoal hover:underline">
              {p.name}
            </Link>
            <span className="text-xs text-muted">
              {p.brand} · {PET[p.petType]}
              {p.isSample && " · sample"}
            </span>
          </span>
        </span>
      ),
    },
    { key: "category", header: "Category", cell: (p) => <span className="text-muted">{p.category}</span> },
    { key: "price", header: "Price from", align: "right", cell: (p) => formatINR(p.priceFrom) },
    {
      key: "stock",
      header: "Stock",
      align: "right",
      cell: (p) => (
        <span className="inline-flex items-center justify-end gap-2">
          {p.stock}
          {p.stockState !== "ok" && (
            <Badge tone={p.stockState === "out" ? "orange" : "gray"}>{p.stockState === "out" ? "Out" : "Low"}</Badge>
          )}
        </span>
      ),
    },
    { key: "sold", header: "Sold", align: "right", cell: (p) => p.soldCount },
    {
      key: "active",
      header: "On sale",
      cell: (p) => (
        <Toggle
          checked={p.isActive}
          disabled={setActive.isPending}
          label={<span className="sr-only">{p.name} on sale</span>}
          onChange={(isActive) =>
            setActive.mutate(
              { id: p.id, isActive },
              {
                onSuccess: () =>
                  show({
                    title: isActive ? "Now in the store" : "Hidden from the store",
                    description: p.name,
                    icon: "check",
                    duration: 2500,
                  }),
                onError: (err) => show({ title: "Couldn't update", description: err.message, icon: "alert" }),
              },
            )
          }
        />
      ),
    },
  ];

  return (
    <AdminPage
      title="Products"
      description="Everything in the catalogue. Changes show in the store straight away."
      actions={
        <Link href="/admin/products/new" className={btn.primary}>
          <Plus className="size-4" aria-hidden="true" /> New product
        </Link>
      }
    >
      <Panel>
        <div className="mb-4 flex flex-wrap gap-2">
          <label className="relative min-w-[14rem] flex-1">
            <span className="sr-only">Search products</span>
            <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted" aria-hidden="true" />
            <input
              type="search"
              value={q}
              onChange={(e) => {
                setQ(e.target.value);
                reset();
              }}
              placeholder="Name, brand or SKU"
              className={cn(inputCls, "pl-9")}
            />
          </label>
          <select
            aria-label="Category"
            value={category}
            onChange={(e) => (setCategory(e.target.value), reset())}
            className={cn(inputCls, "w-auto")}
          >
            <option value="">All categories</option>
            {categories.data?.map((c) => (
              <option key={c.id} value={c.id}>
                {c.parentId ? `— ${c.name}` : c.name}
              </option>
            ))}
          </select>
          <select
            aria-label="Status"
            value={status}
            onChange={(e) => (setStatus(e.target.value), reset())}
            className={cn(inputCls, "w-auto")}
          >
            <option value="">Any status</option>
            <option value="active">In the store</option>
            <option value="inactive">Hidden</option>
          </select>
          <select aria-label="Stock" value={stock} onChange={(e) => (setStock(e.target.value), reset())} className={cn(inputCls, "w-auto")}>
            <option value="">Any stock</option>
            <option value="low">Low stock</option>
            <option value="out">Out of stock</option>
          </select>
        </div>
        {list.isError ? (
          <LoadError error={list.error} onRetry={() => void list.refetch()} />
        ) : (
          <>
            <DataTable
              caption="Products"
              columns={columns}
              rows={list.data?.items}
              rowKey={(p) => p.id}
              loading={list.isPending}
              dim={list.isPlaceholderData}
              empty={search || category || status || stock ? "No products match these filters." : "No products yet. Add your first one."}
            />
            {list.data && <Pager page={list.data.page} totalPages={list.data.totalPages} total={list.data.total} onPage={setPage} />}
          </>
        )}
      </Panel>
    </AdminPage>
  );
}
