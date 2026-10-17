"use client";

import { useState } from "react";
import Link from "next/link";
import { Search, Star } from "lucide-react";
import type { AdminReviewRowDTO, Paginated } from "@nestama/shared";
import { errorMessage, useAdminMutation, useAdminQuery } from "@/lib/admin-client";
import { formatDate } from "@/lib/format";
import { useToast } from "@/components/toast/ToastProvider";
import { cn } from "@/lib/cn";
import { AdminPage, Badge, btn, DataTable, inputCls, LoadError, Pager, Panel, useDebounced } from "./AdminUI";

function Stars({ rating }: { rating: number }) {
  return (
    <span className="inline-flex items-center gap-0.5" role="img" aria-label={`${rating} out of 5`}>
      {[1, 2, 3, 4, 5].map((i) => (
        <Star key={i} className={cn("size-3.5", i <= rating ? "fill-orange text-orange" : "text-line")} aria-hidden="true" />
      ))}
    </span>
  );
}

export function ReviewModeration() {
  const { show } = useToast();
  const [q, setQ] = useState("");
  const [status, setStatus] = useState("");
  const [page, setPage] = useState(1);
  const search = useDebounced(q.trim());
  const list = useAdminQuery<Paginated<AdminReviewRowDTO>>(["reviews"], "/reviews", { q: search, status, page });
  const moderate = useAdminMutation<{ id: string; status: "PUBLISHED" | "HIDDEN" }, AdminReviewRowDTO>(
    ({ id, status: next }) => ({ path: `/reviews/${id}/status`, method: "PATCH", body: { status: next } }),
    [["reviews"], ["customer"]],
  );

  return (
    <AdminPage title="Reviews" description="Hidden reviews disappear from the product page and stop counting towards its rating.">
      <Panel>
        <div className="mb-4 flex flex-wrap gap-2">
          <label className="relative min-w-[14rem] flex-1">
            <span className="sr-only">Search reviews</span>
            <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted" aria-hidden="true" />
            <input
              type="search"
              value={q}
              onChange={(e) => {
                setQ(e.target.value);
                setPage(1);
              }}
              placeholder="Product, reviewer or words in the review"
              className={cn(inputCls, "pl-9")}
            />
          </label>
          <select
            aria-label="Status"
            value={status}
            onChange={(e) => {
              setStatus(e.target.value);
              setPage(1);
            }}
            className={cn(inputCls, "w-auto")}
          >
            <option value="">All reviews</option>
            <option value="PUBLISHED">Published</option>
            <option value="HIDDEN">Hidden</option>
          </select>
        </div>
        {list.isError ? (
          <LoadError error={list.error} onRetry={() => void list.refetch()} />
        ) : (
          <>
            <DataTable
              caption="Reviews"
              rows={list.data?.items}
              rowKey={(r) => r.id}
              loading={list.isPending}
              dim={list.isPlaceholderData}
              empty={search || status ? "No reviews match these filters." : "No reviews yet."}
              columns={[
                {
                  key: "review",
                  header: "Review",
                  cell: (r) => (
                    <span className={cn("block max-w-md", r.status === "HIDDEN" && "opacity-60")}>
                      <Stars rating={r.rating} />
                      <span className="mt-1 block font-bold text-charcoal">{r.title}</span>
                      <span className="line-clamp-2 text-sm text-muted">{r.body}</span>
                    </span>
                  ),
                },
                {
                  key: "product",
                  header: "Product",
                  cell: (r) => (
                    <Link
                      href={`/products/${r.product.slug}`}
                      target="_blank"
                      className="block max-w-[12rem] truncate text-sm font-semibold text-forest hover:underline"
                    >
                      {r.product.name}
                    </Link>
                  ),
                },
                {
                  key: "author",
                  header: "By",
                  cell: (r) => (
                    <span className="block max-w-[12rem] text-sm">
                      <span className="block truncate font-semibold">{r.author}</span>
                      <span className="flex flex-wrap gap-1 pt-0.5">
                        {r.isVerifiedPurchase && <Badge tone="green">Verified</Badge>}
                        {r.isSample && <Badge>Sample</Badge>}
                      </span>
                    </span>
                  ),
                },
                {
                  key: "date",
                  header: "Date",
                  cell: (r) => <span className="whitespace-nowrap text-muted">{formatDate(r.createdAt)}</span>,
                },
                {
                  key: "status",
                  header: "Status",
                  cell: (r) => (r.status === "PUBLISHED" ? <Badge tone="green">Published</Badge> : <Badge tone="orange">Hidden</Badge>),
                },
                {
                  key: "action",
                  header: <span className="sr-only">Action</span>,
                  align: "right",
                  cell: (r) => {
                    const next = r.status === "PUBLISHED" ? "HIDDEN" : "PUBLISHED";
                    return (
                      <button
                        type="button"
                        disabled={moderate.isPending}
                        className={cn(btn.ghost, next === "HIDDEN" && "text-orange-ink")}
                        aria-label={`${next === "HIDDEN" ? "Hide" : "Publish"} review "${r.title}" by ${r.author}`}
                        onClick={() =>
                          moderate.mutate(
                            { id: r.id, status: next },
                            {
                              onSuccess: () =>
                                show({
                                  title: next === "HIDDEN" ? "Review hidden" : "Review published",
                                  description: r.product.name,
                                  icon: "check",
                                  duration: 2500,
                                }),
                              onError: (e) => show({ title: "Couldn't update the review", description: errorMessage(e), icon: "alert" }),
                            },
                          )
                        }
                      >
                        {next === "HIDDEN" ? "Hide" : "Publish"}
                      </button>
                    );
                  },
                },
              ]}
            />
            {list.data && <Pager page={list.data.page} totalPages={list.data.totalPages} total={list.data.total} onPage={setPage} />}
          </>
        )}
      </Panel>
    </AdminPage>
  );
}
