"use client";

import { useEffect, useId, useRef, useState, type ReactNode } from "react";
import Link from "next/link";
import { ArrowDownRight, ArrowUpRight, ChevronLeft, ChevronRight, Loader2, Minus } from "lucide-react";
import type { PromotionStatusValue } from "@nestama/shared";
import { cn } from "@/lib/cn";
import { errorMessage } from "@/lib/admin-client";

// The admin is a denser variant of the storefront: same tokens, smaller controls, tight tables.

export function useDebounced<T>(value: T, ms = 250): T {
  const [v, setV] = useState(value);
  useEffect(() => {
    const t = setTimeout(() => setV(value), ms);
    return () => clearTimeout(t);
  }, [value, ms]);
  return v;
}

export function AdminPage({
  title,
  description,
  actions,
  children,
}: {
  title: string;
  description?: ReactNode;
  actions?: ReactNode;
  children: ReactNode;
}) {
  return (
    <div className="mx-auto max-w-7xl">
      <header className="mb-6 flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-extrabold sm:text-3xl">{title}</h1>
          {description && <p className="mt-1 text-sm text-muted">{description}</p>}
        </div>
        {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
      </header>
      {children}
    </div>
  );
}

export function Panel({
  title,
  action,
  children,
  className,
  bodyClassName,
}: {
  title?: ReactNode;
  action?: ReactNode;
  children: ReactNode;
  className?: string;
  bodyClassName?: string;
}) {
  return (
    // min-w-0: as a grid item, a wide table inside should scroll, not stretch the column.
    <section className={cn("min-w-0 rounded-2xl bg-white shadow-card ring-1 ring-line", className)}>
      {(title || action) && (
        <div className="flex items-center justify-between gap-3 border-b border-line px-5 py-3.5">
          {title && <h2 className="text-base font-extrabold">{title}</h2>}
          {action}
        </div>
      )}
      <div className={cn("p-5", bodyClassName)}>{children}</div>
    </section>
  );
}

export interface Column<T> {
  key: string;
  header: ReactNode;
  cell: (row: T) => ReactNode;
  className?: string;
  align?: "left" | "right" | "center";
}

/** Dense table; scrolls sideways on phones instead of squeezing columns. */
export function DataTable<T>({
  columns,
  rows,
  rowKey,
  empty = "Nothing here yet.",
  loading = false,
  dim = false,
  caption,
}: {
  columns: Column<T>[];
  rows: T[] | undefined;
  rowKey: (row: T) => string;
  empty?: ReactNode;
  loading?: boolean;
  /** Refetching: keep the rows, dimmed, rather than flashing a skeleton. */
  dim?: boolean;
  caption?: string;
}) {
  return (
    // relative: absolutely positioned bits inside (e.g. sr-only inputs) stay within the scroll area.
    <div className="relative -mx-5 overflow-x-auto px-5">
      <table className={cn("w-full min-w-[40rem] border-separate border-spacing-0 text-sm transition-opacity", dim && "opacity-60")}>
        {caption && <caption className="sr-only">{caption}</caption>}
        <thead>
          <tr>
            {columns.map((c) => (
              <th
                key={c.key}
                scope="col"
                className={cn(
                  "border-b border-line px-3 pb-2.5 text-xs font-bold tracking-wide whitespace-nowrap text-muted uppercase first:pl-0 last:pr-0",
                  c.align === "right" ? "text-right" : c.align === "center" ? "text-center" : "text-left",
                  c.className,
                )}
              >
                {c.header}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {loading && !rows ? (
            [0, 1, 2, 3, 4].map((i) => (
              <tr key={i}>
                <td colSpan={columns.length} className="py-2">
                  <div className="h-9 skeleton rounded-lg" />
                </td>
              </tr>
            ))
          ) : !rows || rows.length === 0 ? (
            <tr>
              <td colSpan={columns.length} className="py-10 text-center text-muted">
                {empty}
              </td>
            </tr>
          ) : (
            rows.map((row) => (
              <tr key={rowKey(row)} className="group">
                {columns.map((c) => (
                  <td
                    key={c.key}
                    className={cn(
                      "border-b border-line px-3 py-2.5 align-middle group-last:border-0 group-hover:bg-cream/50 first:pl-0 last:pr-0",
                      c.align === "right" ? "text-right tabular-nums" : c.align === "center" ? "text-center" : "text-left",
                      c.className,
                    )}
                  >
                    {c.cell(row)}
                  </td>
                ))}
              </tr>
            ))
          )}
        </tbody>
      </table>
    </div>
  );
}

export function Pager({
  page,
  totalPages,
  total,
  onPage,
}: {
  page: number;
  totalPages: number;
  total?: number;
  onPage: (page: number) => void;
}) {
  if (totalPages <= 1) return total !== undefined ? <p className="mt-4 text-xs text-muted">{total} total</p> : null;
  return (
    <nav aria-label="Pages" className="mt-4 flex items-center justify-between gap-3 text-sm">
      <span className="text-xs text-muted">
        {total !== undefined ? `${total} total · ` : ""}Page {page} of {totalPages}
      </span>
      <span className="flex gap-1.5">
        <button type="button" onClick={() => onPage(page - 1)} disabled={page <= 1} className={iconBtn} aria-label="Previous page">
          <ChevronLeft className="size-4" aria-hidden="true" />
        </button>
        <button type="button" onClick={() => onPage(page + 1)} disabled={page >= totalPages} className={iconBtn} aria-label="Next page">
          <ChevronRight className="size-4" aria-hidden="true" />
        </button>
      </span>
    </nav>
  );
}

const iconBtn =
  "grid size-9 place-items-center rounded-lg text-forest ring-1 ring-line hover:bg-sage disabled:opacity-40 disabled:hover:bg-transparent";

const TONES = {
  green: "bg-sage text-forest",
  forest: "bg-forest text-cream",
  orange: "bg-peach text-orange-ink",
  gray: "bg-charcoal/8 text-charcoal/75",
  blue: "bg-[#E4EEF7] text-[#1D4E79]",
} as const;

export function Badge({ tone = "gray", children, className }: { tone?: keyof typeof TONES; children: ReactNode; className?: string }) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-bold whitespace-nowrap",
        TONES[tone],
        className,
      )}
    >
      {children}
    </span>
  );
}

const STATUS_TONE: Record<PromotionStatusValue, keyof typeof TONES> = { live: "green", scheduled: "blue", paused: "orange", ended: "gray" };
const STATUS_LABEL: Record<PromotionStatusValue, string> = { live: "Live", scheduled: "Scheduled", paused: "Paused", ended: "Ended" };

export function ScheduleBadge({ status }: { status: PromotionStatusValue }) {
  return <Badge tone={STATUS_TONE[status]}>{STATUS_LABEL[status]}</Badge>;
}

/** Headline number with its change versus the previous period (arrow + sign, never colour alone). */
export function KpiTile({
  label,
  value,
  change,
  period,
  goodWhenUp = true,
  href,
}: {
  label: string;
  value: string;
  change: number | null;
  period: string;
  goodWhenUp?: boolean;
  href?: string;
}) {
  const up = (change ?? 0) > 0;
  const flat = change === 0 || change === null;
  const good = flat ? null : up === goodWhenUp;
  const Icon = flat ? Minus : up ? ArrowUpRight : ArrowDownRight;
  const body = (
    <>
      <p className="text-sm font-semibold text-muted">{label}</p>
      <p className="mt-1.5 text-3xl font-extrabold text-charcoal">{value}</p>
      <p
        className={cn(
          "mt-1.5 inline-flex items-center gap-1 text-xs font-bold",
          good === null ? "text-muted" : good ? "text-forest" : "text-orange-ink",
        )}
      >
        <Icon className="size-3.5" aria-hidden="true" />
        {change === null ? "New this period" : `${change > 0 ? "+" : ""}${change}%`}
        <span className="font-semibold text-muted">vs {period}</span>
      </p>
    </>
  );
  const cls = "block rounded-2xl bg-white p-5 shadow-card ring-1 ring-line";
  return href ? (
    <Link href={href} className={cn(cls, "transition-shadow hover:shadow-lift")}>
      {body}
    </Link>
  ) : (
    <div className={cls}>{body}</div>
  );
}

// ───────── Compact form controls ─────────

export const inputCls =
  "h-10 w-full rounded-lg border border-line bg-white px-3 text-sm text-charcoal outline-none placeholder:text-muted/70 focus:border-forest/50 focus:shadow-[0_0_0_3px_rgb(18_61_47/0.08)] aria-[invalid=true]:border-ember disabled:bg-cream";

export function Field({
  label,
  error,
  hint,
  children,
  className,
  id,
}: {
  label: ReactNode;
  error?: string;
  hint?: ReactNode;
  children: (props: { id: string; "aria-invalid"?: boolean; "aria-describedby"?: string }) => ReactNode;
  className?: string;
  id?: string;
}) {
  const auto = useId();
  const fieldId = id ?? auto;
  const describedBy = error ? `${fieldId}-error` : hint ? `${fieldId}-hint` : undefined;
  return (
    <div className={className}>
      <label htmlFor={fieldId} className="mb-1 block text-xs font-bold text-forest">
        {label}
      </label>
      {children({ id: fieldId, "aria-invalid": error ? true : undefined, "aria-describedby": describedBy })}
      {error ? (
        <p id={`${fieldId}-error`} className="mt-1 text-xs font-semibold text-orange-ink">
          {error}
        </p>
      ) : hint ? (
        <p id={`${fieldId}-hint`} className="mt-1 text-xs text-muted">
          {hint}
        </p>
      ) : null}
    </div>
  );
}

/** Rupees in the box, paise in state. Empty stays empty (null) rather than becoming ₹0. */
export function RupeeInput({
  value,
  onChange,
  ...props
}: { value: number | null; onChange: (paise: number | null) => void } & Omit<React.ComponentProps<"input">, "value" | "onChange">) {
  const [text, setText] = useState(value === null ? "" : String(value / 100));
  const [lastValue, setLastValue] = useState(value);
  if (value !== lastValue) {
    setLastValue(value);
    setText(value === null ? "" : String(value / 100));
  }
  return (
    <div className="relative">
      <span className="pointer-events-none absolute top-1/2 left-3 -translate-y-1/2 text-sm text-muted">₹</span>
      <input
        {...props}
        inputMode="decimal"
        value={text}
        onChange={(e) => {
          const t = e.target.value.replace(/[^\d.]/g, "");
          setText(t);
          const n = Number.parseFloat(t);
          const paise = t === "" || Number.isNaN(n) ? null : Math.round(n * 100);
          setLastValue(paise);
          onChange(paise);
        }}
        className={cn(inputCls, "pl-7")}
      />
    </div>
  );
}

export function Toggle({
  checked,
  onChange,
  label,
  disabled,
}: {
  checked: boolean;
  onChange: (v: boolean) => void;
  label: ReactNode;
  disabled?: boolean;
}) {
  return (
    <label
      className={cn(
        "relative inline-flex cursor-pointer items-center gap-2.5 text-sm font-semibold text-charcoal",
        disabled && "cursor-not-allowed opacity-60",
      )}
    >
      <input
        type="checkbox"
        role="switch"
        checked={checked}
        disabled={disabled}
        onChange={(e) => onChange(e.target.checked)}
        className="peer sr-only"
      />
      <span
        aria-hidden="true"
        className="relative h-6 w-10 rounded-full bg-charcoal/20 transition-colors peer-checked:bg-forest peer-focus-visible:outline-2 peer-focus-visible:outline-offset-2 peer-focus-visible:outline-forest after:absolute after:top-0.5 after:left-0.5 after:size-5 after:rounded-full after:bg-white after:shadow after:transition-transform peer-checked:after:translate-x-4"
      />
      {label}
    </label>
  );
}

/**
 * Two-step destructive action: first click asks, second click does it. Asking focuses the safe
 * choice (so a stray Enter can't confirm); dismissing (button or Escape) returns focus to the trigger.
 */
export function ConfirmButton({
  label,
  confirmLabel = "Yes, do it",
  cancelLabel = "Cancel",
  onConfirm,
  pending,
  className,
}: {
  label: ReactNode;
  confirmLabel?: string;
  cancelLabel?: string;
  onConfirm: () => void;
  pending?: boolean;
  className?: string;
}) {
  const [asking, setAsking] = useState(false);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const keepRef = useRef<HTMLButtonElement>(null);
  const restoreFocus = useRef(false);

  useEffect(() => {
    if (asking) keepRef.current?.focus();
    else if (restoreFocus.current) {
      restoreFocus.current = false;
      triggerRef.current?.focus();
    }
  }, [asking]);

  const dismiss = () => {
    restoreFocus.current = true;
    setAsking(false);
  };

  if (!asking) {
    return (
      <button ref={triggerRef} type="button" onClick={() => setAsking(true)} className={cn(btn.ghost, "text-orange-ink", className)}>
        {label}
      </button>
    );
  }
  return (
    <span className="inline-flex items-center gap-1.5" onKeyDown={(e) => e.key === "Escape" && (e.stopPropagation(), dismiss())}>
      <button
        type="button"
        disabled={pending}
        onClick={() => {
          onConfirm();
          setAsking(false);
        }}
        className={btn.danger}
      >
        {pending && <Loader2 className="size-3.5 animate-spin" aria-hidden="true" />}
        {confirmLabel}
      </button>
      <button ref={keepRef} type="button" onClick={dismiss} className={btn.ghost}>
        {cancelLabel}
      </button>
    </span>
  );
}

export const btn = {
  primary:
    "inline-flex h-10 items-center justify-center gap-2 rounded-full bg-ember px-4 text-sm font-bold text-white hover:bg-ember-hover disabled:opacity-50",
  forest:
    "inline-flex h-10 items-center justify-center gap-2 rounded-full bg-forest px-4 text-sm font-bold text-cream hover:bg-forest-700 disabled:opacity-50",
  outline:
    "inline-flex h-10 items-center justify-center gap-2 rounded-full px-4 text-sm font-bold text-forest ring-1 ring-forest/30 hover:bg-sage disabled:opacity-50",
  ghost:
    "inline-flex h-9 items-center justify-center gap-1.5 rounded-full px-3 text-sm font-bold text-forest hover:bg-sage disabled:opacity-50",
  danger:
    "inline-flex h-9 items-center justify-center gap-1.5 rounded-full bg-ember px-3 text-sm font-bold text-white hover:bg-ember-hover disabled:opacity-50",
};

export function LoadError({ error, onRetry }: { error: unknown; onRetry: () => void }) {
  return (
    <div
      role="alert"
      className="flex flex-wrap items-center justify-between gap-3 rounded-2xl bg-peach/70 px-4 py-3 text-sm font-semibold text-orange-ink"
    >
      {errorMessage(error, "We couldn't load this.")}
      <button type="button" onClick={onRetry} className={btn.outline}>
        Try again
      </button>
    </div>
  );
}
