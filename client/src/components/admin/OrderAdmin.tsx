"use client";

import { useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { ArrowRight, Search } from "lucide-react";
import {
  formatINR,
  isPaid,
  ORDER_STATUS_LABEL,
  ORDER_STATUSES,
  type AdminOrderDetailDTO,
  type AdminOrderRowDTO,
  type OrderStatusValue,
  type Paginated,
} from "@nestama/shared";
import { errorMessage, useAdminMutation, useAdminQuery } from "@/lib/admin-client";
import { formatDateTime } from "@/lib/format";
import { useToast } from "@/components/toast/ToastProvider";
import { StatusChip } from "@/components/orders/StatusChip";
import { Timeline, Totals } from "@/components/orders/OrderViews";
import { cn } from "@/lib/cn";
import { AdminPage, btn, ConfirmButton, DataTable, Field, inputCls, LoadError, Pager, Panel, useDebounced, type Column } from "./AdminUI";
import { orderColumns } from "./Dashboard";

const itemsColumn: Column<AdminOrderRowDTO> = { key: "items", header: "Items", align: "right", cell: (o) => o.itemCount };

export function OrderList() {
  const [q, setQ] = useState("");
  const [status, setStatus] = useState("");
  const [page, setPage] = useState(1);
  const search = useDebounced(q.trim());
  const list = useAdminQuery<Paginated<AdminOrderRowDTO>>(["orders"], "/orders", { q: search, status, page });

  return (
    <AdminPage title="Orders" description="Every order, newest first. Open one to move it along or cancel it.">
      <Panel>
        <div className="mb-4 flex flex-wrap gap-2">
          <label className="relative min-w-[14rem] flex-1">
            <span className="sr-only">Search orders</span>
            <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted" aria-hidden="true" />
            <input
              type="search"
              value={q}
              onChange={(e) => {
                setQ(e.target.value);
                setPage(1);
              }}
              placeholder="Order number, name or email"
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
            <option value="">Any status</option>
            {ORDER_STATUSES.map((s) => (
              <option key={s} value={s}>
                {ORDER_STATUS_LABEL[s]}
              </option>
            ))}
          </select>
        </div>
        {list.isError ? (
          <LoadError error={list.error} onRetry={() => void list.refetch()} />
        ) : (
          <>
            <DataTable
              caption="Orders"
              columns={[...orderColumns.slice(0, 4), itemsColumn, ...orderColumns.slice(4)]}
              rows={list.data?.items}
              rowKey={(o) => o.id}
              loading={list.isPending}
              dim={list.isPlaceholderData}
              empty={search || status ? "No orders match these filters." : "No orders yet."}
            />
            {list.data && <Pager page={list.data.page} totalPages={list.data.totalPages} total={list.data.total} onPage={setPage} />}
          </>
        )}
      </Panel>
    </AdminPage>
  );
}

const METHOD_LABEL = { UPI: "UPI", CARD: "Card", NETBANKING: "Net banking" } as const;
const PAYMENT_LABEL = { CREATED: "Awaiting payment", CAPTURED: "Paid", FAILED: "Failed" } as const;

function Detail({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex justify-between gap-4 py-1.5 text-sm">
      <dt className="text-muted">{label}</dt>
      <dd className="text-right font-semibold break-all">{children}</dd>
    </div>
  );
}

function Fulfilment({ order }: { order: AdminOrderDetailDTO }) {
  const { show } = useToast();
  const [note, setNote] = useState("");
  const update = useAdminMutation<{ status: OrderStatusValue; note?: string }, AdminOrderDetailDTO>(
    (body) => ({ path: `/orders/${order.id}/status`, method: "PATCH", body }),
    [["order"], ["orders"], ["overview"], ["report"], ["inventory"], ["products"], ["customer"]],
  );
  const move = (status: OrderStatusValue) =>
    update.mutate(
      { status, note: note.trim() || undefined },
      {
        onSuccess: (o) => {
          setNote("");
          show({
            title: `${o.number}: ${ORDER_STATUS_LABEL[o.status]}`,
            description: "The customer's tracking page shows this now.",
            icon: "check",
            duration: 3000,
          });
        },
        onError: (e) => show({ title: "Couldn't update the order", description: errorMessage(e), icon: "alert" }),
      },
    );

  if (!order.nextStatus && !order.canCancel) {
    return (
      <p className="text-sm text-muted">{order.status === "DELIVERED" ? "Delivered. Nothing left to do." : "This order is closed."}</p>
    );
  }
  return (
    <div className="space-y-3">
      <Field label="Note for the timeline" hint="Optional, e.g. a courier tracking number.">
        {(p) => <input {...p} value={note} onChange={(e) => setNote(e.target.value)} className={inputCls} maxLength={200} />}
      </Field>
      {order.nextStatus && (
        <button type="button" onClick={() => move(order.nextStatus!)} disabled={update.isPending} className={cn(btn.forest, "w-full")}>
          Mark as {ORDER_STATUS_LABEL[order.nextStatus].toLowerCase()} <ArrowRight className="size-4" aria-hidden="true" />
        </button>
      )}
      {order.canCancel && (
        <div className="rounded-xl bg-cream p-3 text-xs text-muted">
          <p className="mb-2">
            {isPaid(order.status)
              ? "Cancelling puts the stock back, frees the coupon and records a refund (demo: no money moves)."
              : "Cancelling releases the reserved stock. The customer can't pay for it afterwards."}
          </p>
          <ConfirmButton
            label="Cancel order"
            confirmLabel="Yes, cancel it"
            cancelLabel="Keep order"
            pending={update.isPending}
            onConfirm={() => move("CANCELLED")}
          />
        </div>
      )}
    </div>
  );
}

export function OrderDetail({ id }: { id: string }) {
  const order = useAdminQuery<AdminOrderDetailDTO>(["order", id], `/orders/${id}`);
  if (order.isError) {
    return (
      <AdminPage title="Order">
        <LoadError error={order.error} onRetry={() => void order.refetch()} />
      </AdminPage>
    );
  }
  const o = order.data;
  if (!o) return <div className="h-[32rem] skeleton rounded-2xl" aria-busy="true" />;
  const a = o.shippingAddress;

  return (
    <AdminPage
      title={o.number}
      description={
        <span className="inline-flex flex-wrap items-center gap-2">
          <StatusChip status={o.status} /> Placed {formatDateTime(o.placedAt)} · {o.itemCount} {o.itemCount === 1 ? "item" : "items"}
        </span>
      }
      actions={
        <Link href="/admin/orders" className={btn.ghost}>
          All orders
        </Link>
      }
    >
      <div className="grid gap-6 xl:grid-cols-[1fr_22rem]">
        <div className="space-y-6">
          <Panel title="Items">
            <ul className="divide-y divide-line">
              {o.items.map((i) => (
                <li key={i.id} className="flex items-center gap-3 py-3 first:pt-0">
                  <span className="relative size-14 shrink-0 overflow-hidden rounded-xl bg-cream-deep">
                    {i.imageUrl && <Image src={i.imageUrl} alt="" fill sizes="56px" className="object-cover" />}
                  </span>
                  <span className="min-w-0 flex-1 text-sm">
                    <Link
                      href={`/products/${i.productSlug}`}
                      target="_blank"
                      className="block truncate font-bold text-charcoal hover:underline"
                    >
                      {i.productName}
                    </Link>
                    <span className="text-muted">
                      {i.variantLabel} · {i.quantity} × {formatINR(i.unitPrice)}
                      {i.originalUnitPrice > i.unitPrice && <s className="ml-1.5">{formatINR(i.originalUnitPrice)}</s>}
                    </span>
                  </span>
                  <span className="text-sm font-bold tabular-nums">{formatINR(i.lineTotal)}</span>
                </li>
              ))}
            </ul>
            <div className="mt-4 border-t border-line pt-4">
              <Totals order={o} />
            </div>
          </Panel>
          <Panel title="Progress">
            <Timeline order={o} />
            {o.events.some((e) => e.note) && (
              <>
                <h3 className="mt-6 mb-2 text-xs font-bold tracking-wide text-muted uppercase">Notes</h3>
                <ul className="space-y-1.5 text-sm">
                  {o.events
                    .filter((e) => e.note)
                    .map((e, i) => (
                      <li key={i}>
                        <span className="font-semibold">{ORDER_STATUS_LABEL[e.status]}</span> · {formatDateTime(e.createdAt)}: {e.note}
                      </li>
                    ))}
                </ul>
              </>
            )}
          </Panel>
        </div>

        <aside className="space-y-6">
          <Panel title="Fulfilment">
            <Fulfilment order={o} />
          </Panel>
          <Panel title="Customer">
            <dl>
              <Detail label="Name">
                <Link href={`/admin/customers/${o.customer.id}`} className="text-forest hover:underline">
                  {o.customer.name}
                </Link>
              </Detail>
              <Detail label="Email">
                <a href={`mailto:${o.customer.email}`} className="text-forest hover:underline">
                  {o.customer.email}
                </a>
              </Detail>
              {o.customer.phone && <Detail label="Phone">{o.customer.phone}</Detail>}
            </dl>
          </Panel>
          <Panel title="Ship to">
            <address className="text-sm leading-relaxed not-italic">
              <span className="font-bold">{a.fullName}</span>
              <br />
              {a.line1}
              {a.line2 && (
                <>
                  <br />
                  {a.line2}
                </>
              )}
              {a.landmark && (
                <>
                  <br />
                  Near {a.landmark}
                </>
              )}
              <br />
              {a.city}, {a.state} {a.pincode}
              <br />
              <span className="text-muted">{a.phone}</span>
            </address>
          </Panel>
          <Panel title="Payment">
            {o.payment ? (
              <dl>
                <Detail label="Status">{PAYMENT_LABEL[o.payment.status]}</Detail>
                <Detail label="Method">{o.payment.method ? METHOD_LABEL[o.payment.method] : "—"}</Detail>
                <Detail label="Amount">{formatINR(o.payment.amount)}</Detail>
                {o.paidAt && <Detail label="Paid">{formatDateTime(o.paidAt)}</Detail>}
                <Detail label="Gateway ref">
                  <span className="font-mono text-xs">{o.payment.gatewayOrderId}</span>
                </Detail>
                {o.payment.failureReason && <Detail label="Reason">{o.payment.failureReason}</Detail>}
              </dl>
            ) : (
              <p className="text-sm text-muted">No payment started.</p>
            )}
            <p className="mt-2 text-xs text-muted">NestaPay demo: no real money moves.</p>
          </Panel>
        </aside>
      </div>
    </AdminPage>
  );
}
