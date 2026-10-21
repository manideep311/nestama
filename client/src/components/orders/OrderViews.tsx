"use client";

import { useState, type ReactNode } from "react";
import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { AlertTriangle, ArrowRight, Check, Clock, PackageCheck, Truck } from "lucide-react";
import {
  formatINR,
  isPaid,
  ORDER_STATUS_LABEL,
  ORDER_TRACK_STEPS,
  type DeliveryEstimateDTO,
  type OrderDetailDTO,
  type OrderStatusValue,
} from "@nestama/shared";
import { accountKeys, useOrder } from "@/lib/account-client";
import { apiFetch, ApiRequestError } from "@/lib/cart-client";
import { formatDate, formatDateTime, formatTime } from "@/lib/format";
import { Button, ButtonLink } from "@/components/ui/Button";
import { FormAlert } from "@/components/ui/Field";
import { NestaPayDialog } from "@/components/checkout/NestaPayDialog";
import { OrderSuccessAnimation } from "@/components/animations/OrderSuccessAnimation";
import { cn } from "@/lib/cn";
import { StatusChip } from "./StatusChip";

const METHOD_LABEL = { UPI: "UPI", CARD: "Card", NETBANKING: "Netbanking" } as const;

function OrderSkeleton() {
  return (
    <div className="container-page space-y-5 py-10" aria-busy="true">
      <div className="h-10 w-72 skeleton rounded-2xl" />
      <div className="h-64 skeleton rounded-3xl" />
      <div className="h-48 skeleton rounded-3xl" />
    </div>
  );
}

function OrderMissing({ error, onRetry }: { error: unknown; onRetry: () => void }) {
  const notFound = error instanceof ApiRequestError && error.status === 404;
  return (
    <div className="container-page py-16 text-center">
      <h1 className="text-3xl font-extrabold">{notFound ? "We couldn’t find that order" : "We couldn’t load this order"}</h1>
      <p className="mt-2 text-muted">{notFound ? "It may belong to a different account." : "Check your connection and try again."}</p>
      <div className="mt-6 flex justify-center gap-3">
        {!notFound && <Button onClick={onRetry}>Try again</Button>}
        <ButtonLink href="/account/orders" variant={notFound ? "primary" : "outline"}>
          Your orders
        </ButtonLink>
      </div>
    </div>
  );
}

/** Reopens NestaPay for an order still awaiting payment (same gateway order, same reservation). */
function CompletePayment({ order, children }: { order: OrderDetailDTO; children?: ReactNode }) {
  const router = useRouter();
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  if (!order.canPay || !order.payment) return null;
  return (
    <>
      <Button size="lg" onClick={() => setOpen(true)}>
        {children ?? `Complete payment · ${formatINR(order.total)}`}
      </Button>
      <NestaPayDialog
        order={
          open ? { orderId: order.id, orderNumber: order.number, gatewayOrderId: order.payment.gatewayOrderId, amount: order.total } : null
        }
        onClose={() => setOpen(false)}
        onPaid={(paid) => {
          setOpen(false);
          qc.setQueryData(accountKeys.order(paid.id), paid);
          router.replace(`/orders/${paid.id}/confirmed`);
        }}
        onRetry={() => {
          setOpen(false);
          router.push("/checkout");
        }}
      />
    </>
  );
}

function useDeliveryEstimate(pincode: string | undefined, enabled: boolean) {
  return useQuery({
    queryKey: ["delivery-estimate", pincode],
    queryFn: () => apiFetch<DeliveryEstimateDTO>(`/delivery-estimate?pincode=${pincode}`),
    enabled: Boolean(pincode) && enabled,
    staleTime: 10 * 60_000,
  });
}

/* ───────── /orders/[id]/confirmed ───────── */

export function OrderConfirmed({ id }: { id: string }) {
  const order = useOrder(id);
  const paid = order.data ? isPaid(order.data.status) : false;
  const estimate = useDeliveryEstimate(order.data?.shippingAddress.pincode, paid);

  if (order.isPending) return <OrderSkeleton />;
  if (order.isError) return <OrderMissing error={order.error} onRetry={() => void order.refetch()} />;
  const o = order.data;

  if (paid) {
    return (
      <div className="container-page py-10 text-center md:py-16">
        <OrderSuccessAnimation />
        <p className="mt-4 text-sm font-bold tracking-[0.16em] text-orange-ink uppercase">Order {o.number} confirmed</p>
        <h1 className="mx-auto mt-2 max-w-xl text-4xl font-extrabold sm:text-5xl">Woohoo! Your order is on its way!</h1>
        <p className="mx-auto mt-3 max-w-lg text-muted">
          We’ve received your payment of <strong className="text-charcoal">{formatINR(o.total)}</strong>.{" "}
          {estimate.data
            ? `Expected between ${formatDate(estimate.data.earliest)} and ${formatDate(estimate.data.latest)}.`
            : "We’ll start packing right away."}
        </p>
        <div className="mt-8 flex flex-wrap justify-center gap-3">
          <ButtonLink href={`/orders/${o.id}`} variant="forest" size="lg">
            Track your order <ArrowRight className="size-5" aria-hidden="true" />
          </ButtonLink>
          <ButtonLink href="/shop" variant="outline" size="lg">
            Continue shopping
          </ButtonLink>
        </div>
        <OrderBrief order={o} className="mx-auto mt-12 max-w-xl text-left" />
      </div>
    );
  }

  // Not paid: say exactly what state the order is in — never celebrate.
  const pending = o.status === "PENDING_PAYMENT";
  return (
    <div className="container-page py-12 md:py-16">
      <div className="mx-auto max-w-xl rounded-[2rem] bg-white p-7 text-center shadow-card ring-1 ring-line sm:p-10">
        <span
          className={cn(
            "mx-auto mb-4 grid size-14 place-items-center rounded-full",
            pending ? "bg-sage text-forest" : "bg-peach text-orange-ink",
          )}
        >
          {pending ? <Clock className="size-7" aria-hidden="true" /> : <AlertTriangle className="size-7" aria-hidden="true" />}
        </span>
        <h1 className="text-3xl font-extrabold">
          {pending && o.canPay
            ? "Your order is waiting for payment"
            : o.status === "PAYMENT_FAILED"
              ? "Payment didn’t go through"
              : "This order was cancelled"}
        </h1>
        <p className="mt-2 text-muted">
          {pending && o.canPay && o.expiresAt
            ? `We’re holding your items until ${formatTime(o.expiresAt)}. Complete the payment to confirm order ${o.number}.`
            : (o.payment?.failureReason && o.payment.failureReason !== "EXPIRED" ? `${o.payment.failureReason} ` : "") +
              "Nothing was charged. Your cart still has your items, so you can check out again."}
        </p>
        <div className="mt-7 flex flex-wrap justify-center gap-3">
          {pending && o.canPay ? (
            <CompletePayment order={o} />
          ) : (
            <ButtonLink href="/checkout" size="lg">
              Return to checkout
            </ButtonLink>
          )}
          <ButtonLink href={`/orders/${o.id}`} variant="outline" size="lg">
            Order details
          </ButtonLink>
        </div>
      </div>
    </div>
  );
}

function OrderBrief({ order, className }: { order: OrderDetailDTO; className?: string }) {
  return (
    <div className={cn("rounded-3xl bg-white p-5 shadow-card ring-1 ring-line", className)}>
      <ul className="divide-y divide-line">
        {order.items.map((i) => (
          <li key={i.id} className="flex items-center gap-3 py-2.5 first:pt-0 last:pb-0">
            <span className="relative size-12 shrink-0 overflow-hidden rounded-xl bg-cream-deep">
              {i.imageUrl && <Image src={i.imageUrl} alt="" fill sizes="48px" className="object-cover" />}
            </span>
            <span className="min-w-0 flex-1 text-sm">
              <span className="block truncate font-bold text-charcoal">{i.productName}</span>
              <span className="text-muted">
                {i.variantLabel} · Qty {i.quantity}
              </span>
            </span>
            <span className="text-sm font-bold tabular-nums">{formatINR(i.lineTotal)}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

/* ───────── /orders/[id] ───────── */

export function Timeline({ order }: { order: OrderDetailDTO }) {
  const eventAt = new Map<OrderStatusValue, string>();
  for (const e of order.events) eventAt.set(e.status, e.createdAt);

  // A cancelled or failed order shows what happened instead of the delivery journey.
  if (order.status === "CANCELLED" || order.status === "PAYMENT_FAILED") {
    return (
      <ol className="space-y-4">
        {order.events.map((e, i) => (
          <li key={`${e.status}-${i}`} className="flex gap-3">
            <span
              className={cn(
                "mt-0.5 grid size-7 shrink-0 place-items-center rounded-full",
                i === order.events.length - 1 ? "bg-peach text-orange-ink" : "bg-forest text-cream",
              )}
            >
              {i === order.events.length - 1 ? (
                <AlertTriangle className="size-4" aria-hidden="true" />
              ) : (
                <Check className="size-4" aria-hidden="true" />
              )}
            </span>
            <span>
              <span className="block font-bold text-charcoal">{ORDER_STATUS_LABEL[e.status]}</span>
              <span className="block text-sm text-muted">
                {formatDateTime(e.createdAt)}
                {e.note && ` · ${e.note}`}
              </span>
            </span>
          </li>
        ))}
      </ol>
    );
  }

  const currentIndex = ORDER_TRACK_STEPS.indexOf(order.status);
  return (
    <ol className="relative">
      {ORDER_TRACK_STEPS.map((step, i) => {
        const done = i <= currentIndex;
        const current = i === currentIndex;
        const at = eventAt.get(step);
        return (
          <li key={step} className="relative flex gap-4 pb-6 last:pb-0" aria-current={current ? "step" : undefined}>
            {i < ORDER_TRACK_STEPS.length - 1 && (
              <span
                className={cn("absolute top-8 left-[0.9rem] h-[calc(100%-2rem)] w-0.5", i < currentIndex ? "bg-forest" : "bg-line")}
                aria-hidden="true"
              />
            )}
            <span
              className={cn(
                "relative grid size-8 shrink-0 place-items-center rounded-full",
                done ? "bg-forest text-cream" : "bg-white text-muted ring-2 ring-line",
                current && "ring-4 ring-sage",
              )}
            >
              {done ? <Check className="size-4" aria-hidden="true" /> : <span className="size-2 rounded-full bg-line" />}
            </span>
            <span className="pt-1">
              <span className={cn("block font-bold", done ? "text-charcoal" : "text-muted")}>
                {step === "PENDING_PAYMENT" ? "Order placed" : ORDER_STATUS_LABEL[step]}
                <span className="sr-only">{done ? " — done" : " — not yet"}</span>
              </span>
              {at && <span className="block text-sm text-muted">{formatDateTime(at)}</span>}
            </span>
          </li>
        );
      })}
    </ol>
  );
}

export function Totals({ order }: { order: OrderDetailDTO }) {
  const row = (label: ReactNode, value: string, tone?: "save" | "strong") => (
    <div
      className={cn("flex justify-between gap-4", tone === "strong" && "border-t border-line pt-2.5 text-lg font-extrabold text-forest")}
    >
      <dt className={tone === "strong" ? undefined : "text-muted"}>{label}</dt>
      <dd className={cn("tabular-nums", tone === "save" && "font-semibold text-forest")}>{value}</dd>
    </div>
  );
  return (
    <dl className="space-y-2 text-[15px]">
      {row("Items", formatINR(order.subtotal + order.promoDiscount))}
      {order.promoDiscount > 0 && row("Offer savings", `−${formatINR(order.promoDiscount)}`, "save")}
      {order.couponDiscount > 0 && row(`Coupon ${order.couponCode}`, `−${formatINR(order.couponDiscount)}`, "save")}
      {row("Shipping", order.shipping === 0 ? "Free" : formatINR(order.shipping))}
      {row("Total", formatINR(order.total), "strong")}
      <p className="text-right text-xs text-muted">
        Includes {formatINR(order.gstIncluded)} GST ({order.gstRatePercent}%)
      </p>
    </dl>
  );
}

export function OrderTracking({ id }: { id: string }) {
  const order = useOrder(id);
  if (order.isPending) return <OrderSkeleton />;
  if (order.isError) return <OrderMissing error={order.error} onRetry={() => void order.refetch()} />;
  const o = order.data;
  const a = o.shippingAddress;

  return (
    <div className="container-page pt-6 pb-16 md:pt-8">
      <nav aria-label="Breadcrumb" className="text-sm text-muted">
        <Link href="/account/orders" className="font-semibold text-forest hover:underline">
          Your orders
        </Link>{" "}
        / {o.number}
      </nav>
      <header className="mt-4 mb-8 flex flex-wrap items-center gap-x-4 gap-y-2">
        <h1 className="text-4xl font-extrabold sm:text-5xl">Order {o.number}</h1>
        <StatusChip status={o.status} className="text-sm" />
        <p className="w-full text-muted">Placed {formatDateTime(o.placedAt)}</p>
      </header>

      {o.status === "PENDING_PAYMENT" && o.canPay && (
        <FormAlert className="mb-6 flex flex-wrap items-center justify-between gap-3">
          This order is waiting for payment{o.expiresAt ? ` — items held until ${formatTime(o.expiresAt)}` : ""}.
          <CompletePayment order={o}>Complete payment</CompletePayment>
        </FormAlert>
      )}

      <div className="grid gap-6 lg:grid-cols-[1fr_22rem]">
        <div className="space-y-6">
          <section aria-labelledby="track-heading" className="rounded-3xl bg-white p-6 shadow-card ring-1 ring-line sm:p-8">
            <h2 id="track-heading" className="mb-6 flex items-center gap-2 text-xl font-extrabold">
              <Truck className="size-5 text-forest" aria-hidden="true" /> Tracking
            </h2>
            <Timeline order={o} />
          </section>

          <section aria-labelledby="items-heading" className="rounded-3xl bg-white p-6 shadow-card ring-1 ring-line sm:p-8">
            <h2 id="items-heading" className="mb-4 flex items-center gap-2 text-xl font-extrabold">
              <PackageCheck className="size-5 text-forest" aria-hidden="true" /> Items
            </h2>
            <ul className="divide-y divide-line">
              {o.items.map((i) => (
                <li key={i.id} className="flex items-center gap-4 py-3 first:pt-0 last:pb-0">
                  <span className="relative size-16 shrink-0 overflow-hidden rounded-2xl bg-cream-deep">
                    {i.imageUrl && <Image src={i.imageUrl} alt="" fill sizes="64px" className="object-cover" />}
                  </span>
                  <div className="min-w-0 flex-1">
                    <Link href={`/products/${i.productSlug}`} className="block truncate font-bold text-charcoal hover:underline">
                      {i.productName}
                    </Link>
                    <p className="text-sm text-muted">
                      {i.variantLabel} · {i.quantity} × {formatINR(i.unitPrice)}
                      {i.originalUnitPrice > i.unitPrice && <s className="ml-1.5">{formatINR(i.originalUnitPrice)}</s>}
                    </p>
                  </div>
                  <p className="font-extrabold tabular-nums">{formatINR(i.lineTotal)}</p>
                </li>
              ))}
            </ul>
          </section>
        </div>

        <aside className="space-y-6">
          <section aria-labelledby="totals-heading" className="rounded-3xl bg-white p-6 shadow-card ring-1 ring-line">
            <h2 id="totals-heading" className="mb-4 text-xl font-extrabold">
              Payment
            </h2>
            <Totals order={o} />
            {o.payment && (
              <p className="mt-4 rounded-2xl bg-cream px-4 py-3 text-sm text-charcoal/85">
                {o.payment.status === "CAPTURED"
                  ? `Paid by ${o.payment.method ? METHOD_LABEL[o.payment.method] : "NestaPay"}${o.paidAt ? ` on ${formatDate(o.paidAt)}` : ""}`
                  : o.payment.status === "FAILED"
                    ? "Payment not completed — nothing was charged."
                    : "Awaiting payment."}
              </p>
            )}
          </section>
          <section aria-labelledby="address-heading" className="rounded-3xl bg-white p-6 shadow-card ring-1 ring-line">
            <h2 id="address-heading" className="mb-3 text-xl font-extrabold">
              Delivering to
            </h2>
            <address className="text-sm leading-relaxed text-charcoal/85 not-italic">
              <span className="font-bold text-charcoal">{a.fullName}</span>
              <br />
              {a.line1}
              {a.line2 && `, ${a.line2}`}
              <br />
              {a.landmark && (
                <>
                  Near {a.landmark}
                  <br />
                </>
              )}
              {a.city}, {a.state} {a.pincode}
              <br />
              <span className="text-muted">Mobile: {a.phone}</span>
            </address>
          </section>
        </aside>
      </div>
    </div>
  );
}
