"use client";

import { useState, type ReactNode } from "react";
import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useQueryClient } from "@tanstack/react-query";
import { Loader2, Lock, MapPin, Plus, ShieldCheck, ShoppingBag } from "lucide-react";
import { formatINR, type AddressDTO, type CartDTO } from "@nestama/shared";
import { ApiRequestError, cartKey, useCart } from "@/lib/cart-client";
import { accountKeys, useAddresses } from "@/lib/account-client";
import { useCreateCheckoutOrder, type PayableOrder } from "@/lib/checkout-client";
import { Breadcrumbs } from "@/components/ui/Breadcrumbs";
import { Button, ButtonLink } from "@/components/ui/Button";
import { FormAlert } from "@/components/ui/Field";
import { Modal } from "@/components/ui/Modal";
import { AddressForm } from "@/components/account/AddressForm";
import { cn } from "@/lib/cn";
import { NestaPayDialog } from "./NestaPayDialog";

function Step({ n, title, action, children }: { n: number; title: string; action?: ReactNode; children: ReactNode }) {
  return (
    <section aria-labelledby={`step-${n}`} className="rounded-3xl bg-white p-5 shadow-card ring-1 ring-line sm:p-7">
      <div className="mb-5 flex items-center justify-between gap-4">
        <h2 id={`step-${n}`} className="flex items-center gap-3 text-xl font-extrabold">
          <span className="grid size-8 place-items-center rounded-full bg-forest text-sm text-cream" aria-hidden="true">
            {n}
          </span>
          {title}
        </h2>
        {action}
      </div>
      {children}
    </section>
  );
}

function AddressChoice({ address, checked, onChange }: { address: AddressDTO; checked: boolean; onChange: () => void }) {
  return (
    <label
      className={cn(
        "relative flex cursor-pointer gap-3 rounded-2xl border-2 p-4 transition-colors has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-offset-2 has-[:focus-visible]:outline-forest",
        checked ? "border-forest bg-sage/40" : "border-line hover:border-forest/40",
      )}
    >
      <input type="radio" name="address" checked={checked} onChange={onChange} className="mt-1 size-4 accent-forest" />
      <span className="text-sm leading-relaxed">
        <span className="flex flex-wrap items-center gap-2 font-extrabold text-charcoal">
          {address.fullName}
          {address.isDefault && <span className="rounded-full bg-sage px-2 py-0.5 text-[11px] font-extrabold text-forest">Default</span>}
        </span>
        <span className="block text-charcoal/85">
          {address.line1}
          {address.line2 && `, ${address.line2}`}, {address.city}, {address.state} {address.pincode}
        </span>
        <span className="block text-muted">Mobile: {address.phone}</span>
      </span>
    </label>
  );
}

function SummaryRow({ label, value, tone }: { label: ReactNode; value: string; tone?: "save" | "strong" }) {
  return (
    <div className={cn("flex items-baseline justify-between gap-4", tone === "strong" && "text-lg font-extrabold text-forest")}>
      <dt className={tone === "strong" ? undefined : "text-muted"}>{label}</dt>
      <dd className={cn("tabular-nums", tone === "save" && "font-semibold text-forest")}>{value}</dd>
    </div>
  );
}

function Summary({ cart }: { cart: CartDTO }) {
  const s = cart.summary;
  return (
    <dl className="space-y-2.5 text-[15px]">
      <SummaryRow label={`Items (${s.itemCount})`} value={formatINR(s.subtotal + s.promoSavings)} />
      {s.promoSavings > 0 && <SummaryRow label="Offer savings" value={`−${formatINR(s.promoSavings)}`} tone="save" />}
      {s.couponDiscount > 0 && <SummaryRow label={`Coupon ${s.couponCode}`} value={`−${formatINR(s.couponDiscount)}`} tone="save" />}
      <SummaryRow label="Shipping" value={s.shipping === 0 ? "Free" : formatINR(s.shipping)} />
      <div className="border-t border-line pt-3">
        <SummaryRow label="Total" value={formatINR(s.total)} tone="strong" />
        <p className="mt-1 text-right text-xs text-muted">
          Includes {formatINR(s.gstIncluded)} GST ({s.gstRatePercent}%)
        </p>
      </div>
    </dl>
  );
}

export function CheckoutView() {
  const router = useRouter();
  const qc = useQueryClient();
  const cart = useCart();
  const addresses = useAddresses();
  const create = useCreateCheckoutOrder();
  const [chosen, setChosen] = useState<string | null>(null);
  const [adding, setAdding] = useState(false);
  const [payOrder, setPayOrder] = useState<PayableOrder | null>(null);
  const [error, setError] = useState<string | null>(null);
  // Set once payment succeeds: the emptied cart must not flash "empty" while we hand off.
  const [paidOrderNumber, setPaidOrderNumber] = useState<string | null>(null);

  const list = addresses.data ?? [];
  const addressId = chosen && list.some((a) => a.id === chosen) ? chosen : (list.find((a) => a.isDefault) ?? list[0])?.id;
  const lines = cart.data?.lines ?? [];
  const short = lines.filter((l) => l.quantity > l.maxQuantity);

  function startPayment() {
    if (!addressId || create.isPending) return;
    setError(null);
    create.mutate(addressId, {
      onSuccess: (order) => setPayOrder(order),
      onError: (err) => {
        if (err instanceof ApiRequestError && ["OUT_OF_STOCK", "CART_CHANGED", "CART_EMPTY"].includes(err.code)) {
          void qc.invalidateQueries({ queryKey: cartKey });
        }
        if (err instanceof ApiRequestError && err.code === "ADDRESS_NOT_FOUND")
          void qc.invalidateQueries({ queryKey: accountKeys.addresses });
        setError(err instanceof ApiRequestError ? err.message : "We couldn't start the payment. Please try again.");
      },
    });
  }

  if (paidOrderNumber) {
    return (
      <Shell>
        <div
          role="status"
          className="flex flex-col items-center gap-3 rounded-3xl bg-white px-6 py-16 text-center shadow-card ring-1 ring-line"
        >
          <Loader2 className="size-9 animate-spin text-forest" aria-hidden="true" />
          <p className="text-lg font-extrabold text-forest">Payment received for order {paidOrderNumber}</p>
          <p className="text-muted">Taking you to your confirmation…</p>
        </div>
      </Shell>
    );
  }

  if (cart.isPending || addresses.isPending) {
    return (
      <Shell>
        <div className="grid gap-8 lg:grid-cols-[1fr_24rem]" aria-busy="true">
          <div className="space-y-6">
            <div className="h-56 skeleton rounded-3xl" />
            <div className="h-72 skeleton rounded-3xl" />
          </div>
          <div className="h-80 skeleton rounded-3xl" />
        </div>
      </Shell>
    );
  }

  if (cart.isError || addresses.isError) {
    return (
      <Shell>
        <FormAlert className="flex flex-wrap items-center justify-between gap-3">
          We couldn&apos;t load your checkout.
          <Button
            size="sm"
            variant="outline"
            onClick={() => {
              void cart.refetch();
              void addresses.refetch();
            }}
          >
            Try again
          </Button>
        </FormAlert>
      </Shell>
    );
  }

  if (lines.length === 0) {
    return (
      <Shell>
        <div className="rounded-3xl border-2 border-dashed border-line bg-white/60 px-6 py-14 text-center">
          <ShoppingBag className="mx-auto mb-4 size-10 text-forest" aria-hidden="true" />
          <h2 className="text-2xl font-extrabold">Your cart is empty</h2>
          <p className="mt-1.5 text-muted">Add a few favourites and come back to check out.</p>
          <ButtonLink href="/shop" className="mt-6">
            Explore products
          </ButtonLink>
        </div>
      </Shell>
    );
  }

  // Not `disabled` while the order is created: a disabled button drops focus, and the payment
  // dialog then has nothing to hand focus back to when it closes.
  const canPay = Boolean(addressId) && short.length === 0;
  const total = cart.data.summary.total;

  return (
    <Shell>
      <div className="grid gap-8 lg:grid-cols-[1fr_24rem]">
        <div className="space-y-6">
          <Step
            n={1}
            title="Delivery address"
            action={
              list.length > 0 && (
                <Button size="sm" variant="ghost" onClick={() => setAdding(true)}>
                  <Plus className="size-4" aria-hidden="true" /> New address
                </Button>
              )
            }
          >
            {list.length === 0 ? (
              <div>
                <p className="mb-5 flex items-center gap-2 text-sm text-muted">
                  <MapPin className="size-4 text-forest" aria-hidden="true" /> Where should we deliver? We&apos;ll save this for next time.
                </p>
                <AddressForm defaultChecked submitLabel="Deliver here" onSaved={(a) => setChosen(a.id)} />
              </div>
            ) : (
              <fieldset>
                <legend className="sr-only">Choose a delivery address</legend>
                <div className="grid gap-3">
                  {list.map((a) => (
                    <AddressChoice key={a.id} address={a} checked={a.id === addressId} onChange={() => setChosen(a.id)} />
                  ))}
                </div>
              </fieldset>
            )}
          </Step>

          <Step
            n={2}
            title="Review your items"
            action={
              <Link href="/cart" className="text-sm font-bold text-orange-ink underline-offset-4 hover:underline">
                Edit cart
              </Link>
            }
          >
            <ul className="divide-y divide-line">
              {lines.map((l) => (
                <li key={l.id} className="flex items-center gap-4 py-3 first:pt-0 last:pb-0">
                  <span className="relative size-16 shrink-0 overflow-hidden rounded-2xl bg-cream-deep">
                    {l.image.url && <Image src={l.image.url} alt="" fill sizes="64px" className="object-cover" />}
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="truncate font-bold text-charcoal">{l.name}</p>
                    <p className="text-sm text-muted">
                      {l.variantLabel} · {l.quantity} × {formatINR(l.unitPrice)}
                    </p>
                    {l.quantity > l.maxQuantity && (
                      <p className="mt-0.5 text-sm font-semibold text-orange-ink">
                        Only {l.maxQuantity} left —{" "}
                        <Link href="/cart" className="underline">
                          update your cart
                        </Link>
                      </p>
                    )}
                  </div>
                  <p className="font-extrabold text-charcoal tabular-nums">{formatINR(l.lineTotal)}</p>
                </li>
              ))}
            </ul>
          </Step>
        </div>

        <aside aria-labelledby="summary-heading" className="lg:sticky lg:top-40 lg:self-start">
          <div className="rounded-3xl bg-white p-6 shadow-card ring-1 ring-line">
            <h2 id="summary-heading" className="mb-4 text-xl font-extrabold">
              Order summary
            </h2>
            <Summary cart={cart.data} />
            {cart.data.summary.couponNotice && (
              <p className="mt-4 rounded-xl bg-peach/60 p-3 text-sm font-semibold text-orange-ink">{cart.data.summary.couponNotice}</p>
            )}
            {error && <FormAlert className="mt-4">{error}</FormAlert>}
            <Button
              size="lg"
              className="mt-5 w-full"
              disabled={!canPay}
              aria-disabled={create.isPending || undefined}
              aria-busy={create.isPending || undefined}
              onClick={startPayment}
            >
              {create.isPending ? (
                <Loader2 className="size-5 animate-spin" aria-hidden="true" />
              ) : (
                <Lock className="size-4" aria-hidden="true" />
              )}
              Pay {formatINR(total)} securely
            </Button>
            {!addressId && <p className="mt-2 text-center text-sm text-muted">Add a delivery address to continue.</p>}
            <p className="mt-3 flex items-center justify-center gap-1.5 text-center text-xs text-muted">
              <ShieldCheck className="size-4 text-forest" aria-hidden="true" /> Demo payment gateway
            </p>
          </div>
        </aside>
      </div>

      <Modal open={adding} onClose={() => setAdding(false)} title="Add a delivery address">
        <AddressForm
          submitLabel="Deliver here"
          onSaved={(a) => {
            setChosen(a.id);
            setAdding(false);
          }}
          onCancel={() => setAdding(false)}
        />
      </Modal>

      <NestaPayDialog
        order={payOrder}
        onClose={() => setPayOrder(null)}
        onPaid={(order) => {
          setPaidOrderNumber(order.number);
          setPayOrder(null);
          router.replace(`/orders/${order.id}/confirmed`);
        }}
        onRetry={() => {
          setPayOrder(null);
          startPayment();
        }}
      />
    </Shell>
  );
}

function Shell({ children }: { children: ReactNode }) {
  return (
    <div className="container-page pt-6 pb-16 md:pt-8">
      <Breadcrumbs items={[{ label: "Home", href: "/" }, { label: "Cart", href: "/cart" }, { label: "Checkout" }]} />
      <h1 className="mt-5 mb-7 text-4xl font-extrabold sm:text-5xl">Checkout</h1>
      {children}
    </div>
  );
}
