"use client";

import { useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { Download } from "lucide-react";
import {
  formatINR,
  REPORT_RANGES,
  type AdminOrderRowDTO,
  type AdminOverviewDTO,
  type ReportRange,
  type SalesReportDTO,
} from "@nestama/shared";
import { useAdminQuery } from "@/lib/admin-client";
import { formatDateTime } from "@/lib/format";
import { StatusChip } from "@/components/orders/StatusChip";
import { cn } from "@/lib/cn";
import { AdminPage, Badge, btn, DataTable, KpiTile, LoadError, Panel, type Column } from "./AdminUI";
import { CategoryBars, ChartTable, formatCompactINR, RevenueChart, tableDate } from "./charts";

export const orderColumns: Column<AdminOrderRowDTO>[] = [
  {
    key: "number",
    header: "Order",
    cell: (o) => (
      <Link href={`/admin/orders/${o.id}`} className="font-bold text-forest hover:underline">
        {o.number}
      </Link>
    ),
  },
  { key: "customer", header: "Customer", cell: (o) => <span className="block max-w-[14rem] truncate">{o.customer.name}</span> },
  { key: "placed", header: "Placed", cell: (o) => <span className="whitespace-nowrap text-muted">{formatDateTime(o.placedAt)}</span> },
  { key: "status", header: "Status", cell: (o) => <StatusChip status={o.status} /> },
  { key: "total", header: "Total", align: "right", cell: (o) => <span className="font-bold">{formatINR(o.total)}</span> },
];

function TopProducts({ items }: { items: AdminOverviewDTO["topProducts"] }) {
  if (items.length === 0) return <p className="py-6 text-center text-sm text-muted">No sales in this period yet.</p>;
  return (
    <ol className="space-y-3">
      {items.map((p, i) => (
        <li key={p.productId} className="flex items-center gap-3">
          <span className="w-4 text-xs font-bold text-muted">{i + 1}</span>
          <span className="relative size-10 shrink-0 overflow-hidden rounded-lg bg-cream-deep">
            {p.image && <Image src={p.image} alt="" fill sizes="40px" className="object-cover" />}
          </span>
          <span className="min-w-0 flex-1">
            <Link href={`/products/${p.slug}`} className="block truncate text-sm font-bold text-charcoal hover:underline">
              {p.name}
            </Link>
            <span className="text-xs text-muted">{p.quantity} sold</span>
          </span>
          <span className="text-sm font-bold">{formatINR(p.revenue)}</span>
        </li>
      ))}
    </ol>
  );
}

export function Dashboard() {
  const overview = useAdminQuery<AdminOverviewDTO>(["overview"], "/stats/overview");
  if (overview.isError)
    return (
      <AdminPage title="Dashboard">
        <LoadError error={overview.error} onRetry={() => void overview.refetch()} />
      </AdminPage>
    );
  const d = overview.data;

  return (
    <AdminPage title="Dashboard" description="The last 30 days at a glance. Revenue counts paid orders, by the day they were paid (IST).">
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        {d ? (
          <>
            <KpiTile
              label="Revenue"
              value={formatINR(d.kpis.revenue.value)}
              change={d.kpis.revenue.change}
              period="previous 30 days"
              href="/admin/reports"
            />
            <KpiTile
              label="Paid orders"
              value={d.kpis.orders.value.toLocaleString("en-IN")}
              change={d.kpis.orders.change}
              period="previous 30 days"
              href="/admin/orders"
            />
            <KpiTile label="Average order value" value={formatINR(d.kpis.aov.value)} change={d.kpis.aov.change} period="previous 30 days" />
            <KpiTile
              label="New customers"
              value={d.kpis.customers.value.toLocaleString("en-IN")}
              change={d.kpis.customers.change}
              period="previous 30 days"
              href="/admin/customers"
            />
          </>
        ) : (
          [0, 1, 2, 3].map((i) => <div key={i} className="h-[7.75rem] skeleton rounded-2xl" />)
        )}
      </div>

      <Panel
        title="Revenue · last 30 days"
        className="mt-6"
        action={
          <Link href="/admin/reports" className="text-xs font-bold text-orange-ink hover:underline">
            Full report
          </Link>
        }
      >
        {d ? (
          <>
            <RevenueChart data={d.revenueByDay} />
            <ChartTable
              caption="Revenue by day, last 30 days"
              head={["Day", "Revenue", "Orders"]}
              rows={d.revenueByDay.map((p) => [tableDate(p.date), formatINR(p.revenue), p.orders])}
            />
          </>
        ) : (
          <div className="h-[260px] skeleton rounded-xl" />
        )}
      </Panel>

      <div className="mt-6 grid gap-6 lg:grid-cols-2">
        <Panel title="Top products · 30 days">
          {d ? <TopProducts items={d.topProducts} /> : <div className="h-48 skeleton rounded-xl" />}
        </Panel>
        <Panel
          title="Low stock"
          action={
            <Link href="/admin/inventory?low=1" className="text-xs font-bold text-orange-ink hover:underline">
              Manage inventory
            </Link>
          }
        >
          {d ? (
            d.lowStock.length === 0 ? (
              <p className="py-6 text-center text-sm text-muted">Everything is well stocked.</p>
            ) : (
              <ul className="divide-y divide-line">
                {d.lowStock.map((v) => (
                  <li key={v.variantId} className="flex items-center justify-between gap-3 py-2.5 text-sm">
                    <span className="min-w-0">
                      <span className="block truncate font-bold">{v.productName}</span>
                      <span className="text-xs text-muted">
                        {v.label} · {v.sku}
                      </span>
                    </span>
                    <Badge tone={v.stock === 0 ? "orange" : "gray"}>{v.stock === 0 ? "Sold out" : `${v.stock} left`}</Badge>
                  </li>
                ))}
              </ul>
            )
          ) : (
            <div className="h-48 skeleton rounded-xl" />
          )}
        </Panel>
      </div>

      <Panel
        title="Recent orders"
        className="mt-6"
        action={
          <Link href="/admin/orders" className="text-xs font-bold text-orange-ink hover:underline">
            All orders
          </Link>
        }
      >
        <DataTable
          columns={orderColumns}
          rows={d?.recentOrders}
          rowKey={(o) => o.id}
          loading={!d}
          empty="No orders yet."
          caption="Recent orders"
        />
      </Panel>
    </AdminPage>
  );
}

const RANGE_LABEL: Record<ReportRange, string> = { "7d": "7 days", "30d": "30 days", "90d": "90 days", "365d": "12 months" };

export function Reports() {
  const [range, setRange] = useState<ReportRange>("30d");
  const report = useAdminQuery<SalesReportDTO>(["report"], "/reports/sales", { range });
  const r = report.data;

  return (
    <AdminPage
      title="Reports"
      description="Paid orders only, grouped by the day (or week) they were paid in India time."
      actions={
        <a href="/api/v1/admin/reports/orders.csv" download className={btn.outline}>
          <Download className="size-4" aria-hidden="true" /> Orders CSV
        </a>
      }
    >
      {/* One filter row above everything it scopes. */}
      <div role="radiogroup" aria-label="Date range" className="mb-5 inline-flex rounded-full bg-white p-1 ring-1 ring-line">
        {REPORT_RANGES.map((value) => (
          <button
            key={value}
            type="button"
            role="radio"
            aria-checked={range === value}
            onClick={() => setRange(value)}
            className={cn(
              "h-8 rounded-full px-3.5 text-xs font-bold transition-colors",
              range === value ? "bg-forest text-cream" : "text-forest hover:bg-sage",
            )}
          >
            {RANGE_LABEL[value]}
          </button>
        ))}
      </div>

      {report.isError ? (
        <LoadError error={report.error} onRetry={() => void report.refetch()} />
      ) : (
        <div className={cn("transition-opacity", report.isPlaceholderData && "opacity-60")} aria-busy={report.isFetching || undefined}>
          <div className="grid gap-3 sm:grid-cols-3">
            {[
              ["Revenue", r ? formatINR(r.totals.revenue) : "–"],
              ["Paid orders", r ? r.totals.orders.toLocaleString("en-IN") : "–"],
              ["Average order value", r ? formatINR(r.totals.aov) : "–"],
            ].map(([label, value]) => (
              <div key={label} className="rounded-2xl bg-white p-5 shadow-card ring-1 ring-line">
                <p className="text-sm font-semibold text-muted">{label}</p>
                <p className="mt-1.5 text-3xl font-extrabold text-charcoal">{value}</p>
              </div>
            ))}
          </div>

          <Panel title={`Revenue by ${r?.by ?? "day"} · ${RANGE_LABEL[range]}`} className="mt-6">
            {r ? (
              <>
                <RevenueChart data={r.buckets} by={r.by} />
                <ChartTable
                  caption={`Revenue by ${r.by}`}
                  head={[r.by === "week" ? "Week of" : "Day", "Revenue", "Orders"]}
                  rows={r.buckets.map((p) => [tableDate(p.date), formatINR(p.revenue), p.orders])}
                />
              </>
            ) : (
              <div className="h-[260px] skeleton rounded-xl" />
            )}
          </Panel>

          <div className="mt-6 grid gap-6 lg:grid-cols-2">
            <Panel title="Revenue by category">
              {!r ? (
                <div className="h-48 skeleton rounded-xl" />
              ) : r.byCategory.length === 0 ? (
                <p className="py-6 text-center text-sm text-muted">No sales in this period.</p>
              ) : (
                <>
                  <CategoryBars data={r.byCategory} />
                  <ChartTable
                    caption="Revenue by category"
                    head={["Category", "Revenue", "Units"]}
                    rows={r.byCategory.map((c) => [c.category, formatINR(c.revenue), c.quantity])}
                  />
                </>
              )}
            </Panel>
            <Panel title="Top products">
              {!r ? (
                <div className="h-48 skeleton rounded-xl" />
              ) : (
                <DataTable
                  caption="Top products"
                  rows={r.topProducts}
                  rowKey={(p) => p.productId}
                  empty="No sales in this period."
                  columns={[
                    {
                      key: "name",
                      header: "Product",
                      cell: (p) => <span className="block max-w-[16rem] truncate font-semibold">{p.name}</span>,
                    },
                    { key: "qty", header: "Units", align: "right", cell: (p) => p.quantity },
                    {
                      key: "rev",
                      header: "Revenue",
                      align: "right",
                      cell: (p) => <span className="font-bold">{formatCompactINR(p.revenue)}</span>,
                    },
                  ]}
                />
              )}
            </Panel>
          </div>
        </div>
      )}
    </AdminPage>
  );
}
