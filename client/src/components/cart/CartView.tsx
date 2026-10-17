"use client";

import { useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { ArrowRight, Loader2, Minus, Plus, Tag, Trash2, X } from "lucide-react";
import { formatINR, type CartDTO, type CartLineDTO } from "@nestama/shared";
import { useAddToCart, useApplyCoupon, useCart, useRemoveCoupon, useUpdateCartLine } from "@/lib/cart-client";
import { useToast } from "@/components/toast/ToastProvider";
import { ButtonLink } from "@/components/ui/Button";
import { EmptyCartIllustration } from "@/components/animations/EmptyCartIllustration";
import { PawIcon, YarnCurl } from "@/components/ui/icons";
import { cn } from "@/lib/cn";

export function CartView() {
  const { data: cart, isLoading, isError, refetch } = useCart();

  if (isLoading) return <CartSkeleton />;
  if (isError || !cart) {
    return (
      <div className="rounded-3xl bg-white p-10 text-center ring-1 ring-line">
        <h2 className="text-2xl font-extrabold">We couldn&apos;t load your cart</h2>
        <p className="mt-2 text-muted">Check your connection and try again.</p>
        <button type="button" onClick={() => refetch()} className="mt-5 h-11 rounded-full bg-forest px-5 font-bold text-cream">
          Try again
        </button>
      </div>
    );
  }
  if (cart.lines.length === 0) return <EmptyCart />;

  return (
    <div className="grid gap-8 lg:grid-cols-[1fr_24rem]">
      <section aria-label="Items in your cart">
        <ul className="divide-y divide-line rounded-3xl bg-white px-4 ring-1 ring-line sm:px-6">
          {cart.lines.map((line) => (
            <CartLine key={line.id} line={line} />
          ))}
        </ul>
        <Link href="/shop" className="mt-5 inline-flex items-center gap-1.5 text-sm font-bold text-orange-ink hover:text-forest">
          <ArrowRight className="size-4 rotate-180" aria-hidden="true" /> Continue shopping
        </Link>
      </section>
      <OrderSummary cart={cart} />
    </div>
  );
}

function EmptyCart() {
  return (
    <div className="rounded-[2rem] bg-white px-6 py-14 text-center ring-1 ring-line">
      <EmptyCartIllustration />
      <h2 className="mt-6 text-3xl font-extrabold">Your cart is waiting for something pawsome!</h2>
      <p className="mx-auto mt-2 max-w-md text-muted">Toys, treats, beds and more — find something your furry friend will love.</p>
      <ButtonLink href="/shop" size="lg" className="mt-7">
        Explore Products <ArrowRight className="size-5" aria-hidden="true" />
      </ButtonLink>
    </div>
  );
}

function CartLine({ line }: { line: CartLineDTO }) {
  const update = useUpdateCartLine();
  const add = useAddToCart();
  const { show } = useToast();
  const href = `/products/${line.slug}`;
  const overStock = line.quantity > line.maxQuantity;
  const soldOut = line.stock === "OUT_OF_STOCK";

  function setQuantity(quantity: number) {
    update.mutate(
      { lineId: line.id, quantity },
      { onError: (err) => show({ title: "Couldn't update quantity", description: err.message, icon: "alert" }) },
    );
  }

  function remove() {
    update.mutate(
      { lineId: line.id, quantity: 0 },
      {
        onSuccess: () =>
          show({
            title: "Removed from your pack",
            description: line.name,
            icon: "check",
            actions: [{ label: "Undo", onClick: () => add.mutate({ variantId: line.variantId, quantity: line.quantity }) }],
          }),
        onError: (err) => show({ title: "Couldn't remove that", description: err.message, icon: "alert" }),
      },
    );
  }

  return (
    <li className={cn("flex gap-4 py-5 transition-opacity", update.isPending && "opacity-60")}>
      {/* A click target for the mouse only: the product name below is the one link for keyboards and screen readers. */}
      <Link
        href={href}
        tabIndex={-1}
        aria-hidden="true"
        className="relative size-24 shrink-0 overflow-hidden rounded-2xl bg-cream-deep sm:size-28"
      >
        {line.image.url && <Image src={line.image.url} alt="" fill sizes="112px" className="object-cover" />}
      </Link>
      <div className="flex min-w-0 flex-1 flex-col">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <p className="text-xs font-semibold text-muted">{line.brand}</p>
            <h3 className="font-bold text-charcoal">
              <Link href={href} className="hover:text-forest hover:underline">
                {line.name}
              </Link>
            </h3>
            {line.variantLabel !== "Standard" && <p className="text-sm text-muted">{line.variantLabel}</p>}
          </div>
          <button
            type="button"
            onClick={remove}
            className="grid size-9 shrink-0 place-items-center rounded-full text-muted hover:bg-cream hover:text-orange-ink"
            aria-label={`Remove ${line.name}`}
          >
            <Trash2 className="size-4" aria-hidden="true" />
          </button>
        </div>

        <div className="mt-auto flex flex-wrap items-end justify-between gap-3 pt-3">
          <div
            className="flex h-10 items-center rounded-full border border-line bg-cream/60"
            role="group"
            aria-label={`Quantity of ${line.name}`}
          >
            <button
              type="button"
              onClick={() => setQuantity(line.quantity - 1)}
              disabled={line.quantity <= 1 || update.isPending}
              className="grid size-10 place-items-center rounded-full text-forest hover:bg-sage disabled:opacity-35"
              aria-label="Decrease quantity"
            >
              <Minus className="size-3.5" aria-hidden="true" />
            </button>
            <output className="w-7 text-center text-sm font-bold tabular-nums" aria-live="polite">
              {line.quantity}
            </output>
            <button
              type="button"
              onClick={() => setQuantity(line.quantity + 1)}
              disabled={line.quantity >= line.maxQuantity || update.isPending}
              className="grid size-10 place-items-center rounded-full text-forest hover:bg-sage disabled:opacity-35"
              aria-label="Increase quantity"
            >
              <Plus className="size-3.5" aria-hidden="true" />
            </button>
          </div>
          <p className="text-right">
            <span className="block text-lg font-extrabold text-charcoal tabular-nums">{formatINR(line.lineTotal)}</span>
            <span className="text-xs text-muted tabular-nums">
              {line.quantity} × {formatINR(line.unitPrice)}
              {line.originalUnitPrice > line.unitPrice && <s className="ml-1">{formatINR(line.originalUnitPrice)}</s>}
            </span>
          </p>
        </div>
        {(overStock || soldOut || line.stock === "LOW_STOCK") && (
          <p className={cn("mt-2 text-xs font-semibold", soldOut || overStock ? "text-orange-ink" : "text-muted")}>
            {soldOut
              ? "This item has sold out — remove it to continue."
              : overStock
                ? `Only ${line.maxQuantity} available — please reduce the quantity.`
                : "Only a few left."}
          </p>
        )}
      </div>
    </li>
  );
}

function OrderSummary({ cart }: { cart: CartDTO }) {
  const s = cart.summary;
  const blocked = cart.lines.some((l) => l.stock === "OUT_OF_STOCK" || l.quantity > l.maxQuantity);
  const progress = Math.min(100, ((s.subtotal - s.couponDiscount) / s.freeShippingThreshold) * 100);

  return (
    <aside aria-labelledby="summary-title" className="h-fit rounded-3xl bg-white p-6 ring-1 ring-line lg:sticky lg:top-40">
      <h2 id="summary-title" className="text-2xl font-extrabold">
        Order summary
      </h2>

      {/* Free-shipping progress — the brand's yarn thread */}
      <div className="mt-4 rounded-2xl bg-cream p-4">
        <p className="flex items-center gap-2 text-sm font-semibold text-forest">
          <PawIcon className="size-4 text-orange" />
          {s.amountToFreeShipping > 0 ? (
            <>You&apos;re {formatINR(s.amountToFreeShipping)} away from free shipping</>
          ) : (
            <>You&apos;ve unlocked free shipping!</>
          )}
        </p>
        <div
          className="relative mt-2.5 h-2 overflow-hidden rounded-full bg-sage"
          role="progressbar"
          aria-valuemin={0}
          aria-valuemax={100}
          aria-valuenow={Math.round(progress)}
          aria-label="Progress to free shipping"
        >
          <span
            className="absolute inset-y-0 left-0 rounded-full bg-[linear-gradient(90deg,var(--color-orange),var(--color-orange-soft))] transition-[width] duration-500 ease-soft"
            style={{ width: `${progress}%` }}
          />
        </div>
      </div>

      <dl className="mt-5 space-y-2.5 text-[15px]">
        <Row label={`Subtotal (${s.itemCount} ${s.itemCount === 1 ? "item" : "items"})`} value={formatINR(s.subtotal)} />
        {s.promoSavings > 0 && (
          <Row label="Deal savings" value={`−${formatINR(s.promoSavings)}`} tone="good" hint="Already included in prices" />
        )}
        {s.couponDiscount > 0 && <Row label={`Coupon ${s.couponCode}`} value={`−${formatINR(s.couponDiscount)}`} tone="good" />}
        <Row label="Shipping" value={s.shipping === 0 ? "Free" : formatINR(s.shipping)} />
        <div className="border-t border-line pt-3">
          <Row label="Total" value={formatINR(s.total)} strong />
          <p className="mt-1 text-right text-xs text-muted">
            Includes {formatINR(s.gstIncluded)} GST ({s.gstRatePercent}%)
          </p>
        </div>
      </dl>

      <CouponForm cart={cart} />

      {blocked && (
        <p className="mt-4 rounded-xl bg-peach/60 p-3 text-sm font-semibold text-orange-ink">
          Please fix the highlighted items before checking out.
        </p>
      )}
      <ButtonLink
        href="/checkout"
        size="lg"
        className={cn("mt-5 w-full", blocked && "pointer-events-none opacity-50")}
        aria-disabled={blocked}
      >
        Checkout securely <ArrowRight className="size-5" aria-hidden="true" />
      </ButtonLink>
      <p className="mt-3 text-center text-xs text-muted">UPI · Cards · Net Banking — demo payment, no real charges</p>
    </aside>
  );
}

function Row({ label, value, tone, strong, hint }: { label: string; value: string; tone?: "good"; strong?: boolean; hint?: string }) {
  return (
    <div className="flex items-baseline justify-between gap-4">
      <dt className={cn(strong ? "text-lg font-extrabold text-forest" : "text-muted")}>
        {label}
        {hint && <span className="block text-xs">{hint}</span>}
      </dt>
      <dd
        className={cn(
          "tabular-nums",
          strong ? "text-xl font-extrabold text-forest" : "font-semibold text-charcoal",
          tone === "good" && "text-forest",
        )}
      >
        {value}
      </dd>
    </div>
  );
}

function CouponForm({ cart }: { cart: CartDTO }) {
  const apply = useApplyCoupon();
  const remove = useRemoveCoupon();
  const [code, setCode] = useState("");
  const [error, setError] = useState<string | null>(null);
  const { summary } = cart;

  if (summary.couponCode) {
    return (
      <div className="mt-5 rounded-2xl border-2 border-dashed border-forest/25 bg-sage/40 p-3.5">
        <div className="flex items-center justify-between gap-3">
          <p className="flex items-center gap-2 text-sm font-bold text-forest">
            <Tag className="size-4" aria-hidden="true" /> {summary.couponCode}
            {summary.couponDiscount > 0 && <span className="font-semibold">— you save {formatINR(summary.couponDiscount)}</span>}
          </p>
          <button
            type="button"
            onClick={() => remove.mutate()}
            disabled={remove.isPending}
            className="grid size-8 place-items-center rounded-full text-forest hover:bg-white"
            aria-label={`Remove coupon ${summary.couponCode}`}
          >
            <X className="size-4" aria-hidden="true" />
          </button>
        </div>
        {summary.couponNotice && (
          <p className="mt-1.5 text-xs font-semibold text-orange-ink" role="status">
            {summary.couponNotice}
          </p>
        )}
      </div>
    );
  }

  return (
    <form
      className="mt-5"
      onSubmit={(e) => {
        e.preventDefault();
        const trimmed = code.trim();
        if (!trimmed) return setError("Enter a coupon code.");
        setError(null);
        apply.mutate(trimmed, {
          onSuccess: () => setCode(""),
          onError: (err) => setError(err.message),
        });
      }}
    >
      <label htmlFor="coupon" className="text-sm font-bold text-forest">
        Have a coupon?
      </label>
      <div className="mt-2 flex gap-2">
        <input
          id="coupon"
          value={code}
          onChange={(e) => {
            setCode(e.target.value.toUpperCase());
            setError(null);
          }}
          placeholder="e.g. NESTAMA20"
          autoComplete="off"
          aria-invalid={Boolean(error)}
          aria-describedby={error ? "coupon-error" : undefined}
          className="h-11 min-w-0 flex-1 rounded-xl border border-line bg-cream px-3 font-semibold tracking-wide uppercase outline-none placeholder:tracking-normal placeholder:normal-case focus:border-forest"
        />
        <button
          type="submit"
          disabled={apply.isPending}
          className="inline-flex h-11 items-center gap-2 rounded-xl bg-forest px-4 text-sm font-bold text-cream hover:bg-forest-700 disabled:opacity-60"
        >
          {apply.isPending && <Loader2 className="size-4 animate-spin" aria-hidden="true" />}
          Apply
        </button>
      </div>
      {error && (
        <p id="coupon-error" role="alert" className="mt-2 text-sm font-semibold text-orange-ink">
          {error}
        </p>
      )}
    </form>
  );
}

function CartSkeleton() {
  return (
    <div className="grid gap-8 lg:grid-cols-[1fr_24rem]" aria-busy="true" aria-label="Loading your cart">
      <div className="space-y-4 rounded-3xl bg-white p-6 ring-1 ring-line">
        {Array.from({ length: 3 }, (_, i) => (
          <div key={i} className="flex gap-4">
            <div className="size-24 skeleton rounded-2xl" />
            <div className="flex-1 space-y-2">
              <div className="h-4 w-1/3 skeleton rounded" />
              <div className="h-5 w-2/3 skeleton rounded" />
              <div className="h-10 w-28 skeleton rounded-full" />
            </div>
          </div>
        ))}
      </div>
      <div className="h-80 skeleton rounded-3xl" />
    </div>
  );
}

export function CartHeading() {
  return (
    <p className="mb-2 inline-flex items-center gap-2 text-xs font-bold tracking-[0.18em] text-orange-ink uppercase">
      <YarnCurl className="h-3 w-8 text-orange" /> Your pack
    </p>
  );
}
