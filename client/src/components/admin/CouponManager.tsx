"use client";

import { useState, type FormEvent } from "react";
import { Pencil, Plus } from "lucide-react";
import { COUPON_TYPES, couponInputSchema, formatINR, type AdminCouponDTO, type CouponInput } from "@nestama/shared";
import { errorMessage, useAdminMutation, useAdminQuery } from "@/lib/admin-client";
import { istInputToIso, isoToIstInput } from "@/lib/ist";
import { formatDateTime } from "@/lib/format";
import { useToast } from "@/components/toast/ToastProvider";
import { Modal, useModalTarget } from "@/components/ui/Modal";
import { FormAlert } from "@/components/ui/Field";
import { cn } from "@/lib/cn";
import { AdminPage, btn, ConfirmButton, DataTable, Field, inputCls, LoadError, Panel, RupeeInput, ScheduleBadge, Toggle } from "./AdminUI";
import { issueMap, ScheduleFields, ScopeFields, type Scope } from "./fields";

type CouponType = (typeof COUPON_TYPES)[number];

/** "20% off, up to ₹200" / "₹150 off". */
export function couponSummary(c: Pick<AdminCouponDTO, "type" | "value" | "maxDiscount">): string {
  if (c.type === "FIXED") return `${formatINR(c.value)} off`;
  return `${c.value}% off${c.maxDiscount ? `, up to ${formatINR(c.maxDiscount)}` : ""}`;
}

interface Draft {
  code: string;
  description: string;
  type: CouponType;
  percent: string;
  amount: number | null;
  minOrder: number | null;
  maxDiscount: number | null;
  startsAt: string;
  endsAt: string;
  usageLimit: string;
  perUserLimit: string;
  scope: Scope;
  categoryIds: string[];
  productIds: string[];
  isActive: boolean;
}

function fromCoupon(c: AdminCouponDTO | null): Draft {
  const now = new Date();
  return {
    code: c?.code ?? "",
    description: c?.description ?? "",
    type: c?.type ?? "PERCENT",
    percent: c?.type === "PERCENT" ? String(c.value) : "",
    amount: c?.type === "FIXED" ? c.value : null,
    minOrder: c?.minOrder ?? 0,
    maxDiscount: c?.maxDiscount ?? null,
    startsAt: isoToIstInput(c?.startsAt ?? now.toISOString()),
    endsAt: isoToIstInput(c?.endsAt ?? new Date(now.getTime() + 30 * 86_400_000).toISOString()),
    usageLimit: c?.usageLimit ? String(c.usageLimit) : "",
    perUserLimit: c?.perUserLimit ? String(c.perUserLimit) : "",
    scope: c?.scope ?? "ALL",
    categoryIds: c?.categoryIds ?? [],
    productIds: c?.productIds ?? [],
    isActive: c?.isActive ?? true,
  };
}

const optionalInt = (v: string) => (v.trim() ? Number.parseInt(v, 10) || 0 : null);

function toInput(d: Draft): CouponInput {
  return {
    code: d.code,
    description: d.description,
    type: d.type,
    value: d.type === "PERCENT" ? Number.parseInt(d.percent, 10) || 0 : (d.amount ?? 0),
    minOrder: d.minOrder ?? 0,
    maxDiscount: d.type === "PERCENT" ? d.maxDiscount : null,
    startsAt: istInputToIso(d.startsAt) ?? "",
    endsAt: istInputToIso(d.endsAt) ?? "",
    usageLimit: optionalInt(d.usageLimit),
    perUserLimit: optionalInt(d.perUserLimit),
    scope: d.scope,
    categoryIds: d.scope === "CATEGORIES" ? d.categoryIds : [],
    productIds: d.scope === "PRODUCTS" ? d.productIds : [],
    isActive: d.isActive,
  };
}

function CouponForm({ coupon, onDone }: { coupon: AdminCouponDTO | null; onDone: () => void }) {
  const { show } = useToast();
  const [d, setD] = useState<Draft>(() => fromCoupon(coupon));
  const [errors, setErrors] = useState<Record<string, string>>({});
  const save = useAdminMutation<CouponInput, AdminCouponDTO>(
    (input) => (coupon ? { path: `/coupons/${coupon.id}`, method: "PUT", body: input } : { path: "/coupons", method: "POST", body: input }),
    [["coupons"], ["promotions"]],
  );
  const set = (patch: Partial<Draft>) => {
    setD((x) => ({ ...x, ...patch }));
    // The amount fields share the "value" message; the scope message covers its pickers.
    const touched = Object.keys(patch).flatMap((k) =>
      k === "percent" || k === "amount" || k === "type" ? ["value", k] : k === "categoryIds" || k === "productIds" ? ["scope", k] : [k],
    );
    setErrors((e) => {
      const keep = Object.entries(e).filter(([k]) => !touched.includes(k));
      return keep.length === Object.keys(e).length ? e : Object.fromEntries(keep);
    });
  };

  function onSubmit(e: FormEvent) {
    e.preventDefault();
    const input = toInput(d);
    const parsed = couponInputSchema.safeParse(input);
    if (!parsed.success) return setErrors(issueMap(parsed.error.issues));
    setErrors({});
    save.mutate(input, {
      onSuccess: (saved) => {
        show({ title: coupon ? "Coupon saved" : "Coupon created", description: saved.code, icon: "check", duration: 2500 });
        onDone();
      },
    });
  }

  const err = (k: string) => errors[k];
  return (
    <form onSubmit={onSubmit} noValidate className="space-y-5">
      {save.isError && <FormAlert>{errorMessage(save.error)}</FormAlert>}
      {coupon && coupon.usedCount > 0 && (
        <p className="rounded-xl bg-sage/60 px-4 py-3 text-sm text-forest">
          Used {coupon.usedCount} {coupon.usedCount === 1 ? "time" : "times"}. Changes apply to future orders only.
        </p>
      )}
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Code" hint="4–20 letters or numbers. Shoppers type this at checkout." error={err("code")}>
          {(p) => (
            <input
              {...p}
              value={d.code}
              onChange={(e) => set({ code: e.target.value.toUpperCase().replace(/\s+/g, "") })}
              className={cn(inputCls, "font-mono tracking-wider")}
              maxLength={20}
            />
          )}
        </Field>
        <Field label="Description" hint="Optional, for you." error={err("description")}>
          {(p) => (
            <input
              {...p}
              value={d.description}
              onChange={(e) => set({ description: e.target.value })}
              className={inputCls}
              maxLength={160}
            />
          )}
        </Field>
      </div>

      <fieldset className="grid gap-4 sm:grid-cols-2">
        <legend className="sr-only">Discount</legend>
        <div className="sm:col-span-2" role="radiogroup" aria-label="Discount type">
          <span className="mb-1 block text-xs font-bold text-forest" aria-hidden="true">
            Discount type
          </span>
          <div className="flex gap-2">
            {(
              [
                ["PERCENT", "Percent off"],
                ["FIXED", "Fixed amount off"],
              ] as const
            ).map(([t, label]) => (
              <label
                key={t}
                className={cn(
                  "relative flex h-9 cursor-pointer items-center rounded-full px-3.5 text-sm font-semibold ring-1 has-focus-visible:outline-2 has-focus-visible:outline-forest",
                  d.type === t ? "bg-forest text-cream ring-forest" : "bg-white text-forest ring-line hover:bg-sage",
                )}
              >
                <input type="radio" name="coupon-type" checked={d.type === t} onChange={() => set({ type: t })} className="sr-only" />
                {label}
              </label>
            ))}
          </div>
        </div>
        {d.type === "PERCENT" ? (
          <>
            <Field label="Percent off" error={err("value")}>
              {(p) => (
                <div className="relative">
                  <input
                    {...p}
                    type="number"
                    min={1}
                    max={90}
                    inputMode="numeric"
                    value={d.percent}
                    onChange={(e) => set({ percent: e.target.value })}
                    className={cn(inputCls, "pr-8")}
                  />
                  <span className="pointer-events-none absolute top-1/2 right-3 -translate-y-1/2 text-sm text-muted">%</span>
                </div>
              )}
            </Field>
            <Field label="Cap the discount at" hint="Optional" error={err("maxDiscount")}>
              {(p) => <RupeeInput {...p} value={d.maxDiscount} onChange={(maxDiscount) => set({ maxDiscount })} />}
            </Field>
          </>
        ) : (
          <Field label="Amount off" error={err("value")}>
            {(p) => <RupeeInput {...p} value={d.amount} onChange={(amount) => set({ amount })} />}
          </Field>
        )}
        <Field label="Minimum order" hint="Cart total before the coupon. ₹0 for none." error={err("minOrder")}>
          {(p) => <RupeeInput {...p} value={d.minOrder} onChange={(minOrder) => set({ minOrder })} />}
        </Field>
      </fieldset>

      <div className="grid gap-4 sm:grid-cols-2">
        <ScheduleFields
          startsAt={d.startsAt}
          endsAt={d.endsAt}
          onChange={set}
          errors={{ startsAt: err("startsAt"), endsAt: err("endsAt") }}
        />
        <Field label="Total uses" hint="Optional limit across all shoppers." error={err("usageLimit")}>
          {(p) => (
            <input
              {...p}
              type="number"
              min={1}
              inputMode="numeric"
              value={d.usageLimit}
              onChange={(e) => set({ usageLimit: e.target.value })}
              className={inputCls}
              placeholder="Unlimited"
            />
          )}
        </Field>
        <Field label="Uses per customer" hint="Optional" error={err("perUserLimit")}>
          {(p) => (
            <input
              {...p}
              type="number"
              min={1}
              inputMode="numeric"
              value={d.perUserLimit}
              onChange={(e) => set({ perUserLimit: e.target.value })}
              className={inputCls}
              placeholder="Unlimited"
            />
          )}
        </Field>
      </div>

      <ScopeFields scope={d.scope} categoryIds={d.categoryIds} productIds={d.productIds} onChange={set} error={err("scope")} />

      <div className="flex flex-wrap items-center justify-between gap-4 border-t border-line pt-4">
        <Toggle checked={d.isActive} onChange={(isActive) => set({ isActive })} label="Accepting this code" />
        <button type="submit" className={btn.primary} disabled={save.isPending}>
          {coupon ? "Save coupon" : "Create coupon"}
        </button>
      </div>
    </form>
  );
}

export function CouponManager() {
  const { show } = useToast();
  const list = useAdminQuery<AdminCouponDTO[]>(["coupons"], "/coupons");
  const dialog = useModalTarget<AdminCouponDTO | "new">();
  const remove = useAdminMutation<string, unknown>((id) => ({ path: `/coupons/${id}`, method: "DELETE" }), [["coupons"], ["promotions"]]);

  return (
    <AdminPage
      title="Coupons"
      description="Codes shoppers enter at checkout. They stack on top of promotion prices."
      actions={
        <button type="button" onClick={() => dialog.show("new")} className={btn.primary}>
          <Plus className="size-4" aria-hidden="true" /> New coupon
        </button>
      }
    >
      <Panel>
        {list.isError ? (
          <LoadError error={list.error} onRetry={() => void list.refetch()} />
        ) : (
          <DataTable
            caption="Coupons"
            rows={list.data}
            rowKey={(c) => c.id}
            loading={list.isPending}
            empty="No coupons yet."
            columns={[
              {
                key: "code",
                header: "Code",
                cell: (c) => (
                  <span className="block max-w-[16rem]">
                    <button
                      type="button"
                      onClick={() => dialog.show(c)}
                      className="font-mono font-bold tracking-wider text-charcoal hover:underline"
                    >
                      {c.code}
                    </button>
                    {c.description && <span className="block truncate text-xs text-muted">{c.description}</span>}
                  </span>
                ),
              },
              { key: "deal", header: "Discount", cell: (c) => <span className="whitespace-nowrap">{couponSummary(c)}</span> },
              {
                key: "min",
                header: "Min. order",
                align: "right",
                cell: (c) => (c.minOrder ? formatINR(c.minOrder) : <span className="text-muted">—</span>),
              },
              {
                key: "used",
                header: "Used",
                align: "right",
                cell: (c) => (
                  <span className="tabular-nums">
                    {c.usedCount}
                    {c.usageLimit ? <span className="text-muted"> / {c.usageLimit}</span> : null}
                  </span>
                ),
              },
              {
                key: "when",
                header: "Valid",
                cell: (c) => (
                  <span className="text-xs whitespace-nowrap text-muted">
                    {formatDateTime(c.startsAt)}
                    <br />
                    to {formatDateTime(c.endsAt)}
                  </span>
                ),
              },
              { key: "status", header: "Status", cell: (c) => <ScheduleBadge status={c.status} /> },
              {
                key: "actions",
                header: <span className="sr-only">Actions</span>,
                align: "right",
                cell: (c) => (
                  <span className="inline-flex items-center gap-1">
                    <button type="button" onClick={() => dialog.show(c)} className={btn.ghost} aria-label={`Edit ${c.code}`}>
                      <Pencil className="size-4" aria-hidden="true" />
                    </button>
                    {c.usedCount === 0 && (
                      <ConfirmButton
                        label="Delete"
                        confirmLabel="Delete"
                        pending={remove.isPending}
                        onConfirm={() =>
                          remove.mutate(c.id, {
                            onSuccess: () => show({ title: "Coupon deleted", description: c.code, icon: "check", duration: 2500 }),
                            onError: (e) => show({ title: "Couldn't delete", description: errorMessage(e), icon: "alert" }),
                          })
                        }
                      />
                    )}
                  </span>
                ),
              },
            ]}
          />
        )}
        <p className="mt-3 text-xs text-muted">
          A coupon that has been used can&apos;t be deleted, so past orders keep their record. Switch it off instead.
        </p>
      </Panel>
      <Modal open={dialog.open} onClose={dialog.close} title={dialog.target === "new" ? "New coupon" : "Edit coupon"} size="wide">
        <CouponForm coupon={dialog.target === "new" ? null : dialog.target} onDone={dialog.close} />
      </Modal>
    </AdminPage>
  );
}
