"use client";

import { useState, type FormEvent } from "react";
import { Pencil, Plus } from "lucide-react";
import {
  PROMOTION_PLACEMENTS,
  PROMOTION_THEMES,
  promotionInputSchema,
  type AdminCouponDTO,
  type AdminPromotionDTO,
  type PromotionInput,
} from "@nestama/shared";
import { errorMessage, useAdminMutation, useAdminQuery } from "@/lib/admin-client";
import { istInputToIso, isoToIstInput } from "@/lib/ist";
import { formatDateTime } from "@/lib/format";
import { useToast } from "@/components/toast/ToastProvider";
import { Modal, useModalTarget } from "@/components/ui/Modal";
import { FormAlert } from "@/components/ui/Field";
import { cn } from "@/lib/cn";
import { AdminPage, btn, ConfirmButton, DataTable, Field, inputCls, LoadError, Panel, ScheduleBadge, Toggle } from "./AdminUI";
import { ImageField, issueMap, ScheduleFields, ScopeFields, type Scope } from "./fields";

type Placement = (typeof PROMOTION_PLACEMENTS)[number];
type Theme = (typeof PROMOTION_THEMES)[number];

export const PLACEMENT_LABEL: Record<Placement, string> = {
  HERO_CARD: "Homepage hero card",
  COUNTDOWN_BANNER: "Countdown banner",
  CAMPAIGN: "Campaign tile",
  NONE: "Prices only",
};
const PLACEMENT_HINT: Record<Placement, string> = {
  HERO_CARD: "The offer card beside the homepage hero.",
  COUNTDOWN_BANNER: "The banner with a live countdown; also used for the hero card if none is set.",
  CAMPAIGN: "One of the campaign tiles on the homepage.",
  NONE: "Not featured anywhere; it just lowers prices.",
};
// Matches the gradients the storefront's campaign tiles use.
const THEME_SWATCH: Record<Theme, string> = {
  peach: "bg-[linear-gradient(135deg,#fff0e2_0%,#ffe3d2_100%)]",
  sage: "bg-[linear-gradient(135deg,#e5efe4_0%,#d6e7d3_100%)]",
  blush: "bg-[linear-gradient(135deg,#ffe8e3_0%,#ffd5cf_100%)]",
  mist: "bg-[linear-gradient(135deg,#e9f2f0_0%,#d9e9e6_100%)]",
  cream: "bg-[linear-gradient(135deg,#fff8ef_0%,#f8eddf_100%)]",
  orange: "bg-[linear-gradient(135deg,#ffe3d2_0%,#ffc9a8_100%)]",
};

interface Draft {
  name: string;
  headline: string;
  subheadline: string;
  discountPercent: string;
  startsAt: string;
  endsAt: string;
  isActive: boolean;
  placement: Placement;
  scope: Scope;
  categoryIds: string[];
  productIds: string[];
  couponId: string;
  imageUrl: string;
  imageAlt: string;
  ctaLabel: string;
  ctaHref: string;
  theme: Theme;
  sortOrder: string;
}

function fromPromotion(p: AdminPromotionDTO | null): Draft {
  // A new promotion defaults to starting now and running a week.
  const now = new Date();
  return {
    name: p?.name ?? "",
    headline: p?.headline ?? "",
    subheadline: p?.subheadline ?? "",
    discountPercent: p ? String(p.discountPercent) : "",
    startsAt: isoToIstInput(p?.startsAt ?? now.toISOString()),
    endsAt: isoToIstInput(p?.endsAt ?? new Date(now.getTime() + 7 * 86_400_000).toISOString()),
    isActive: p?.isActive ?? true,
    placement: p?.placement ?? "NONE",
    scope: p?.scope ?? "ALL",
    categoryIds: p?.categoryIds ?? [],
    productIds: p?.productIds ?? [],
    couponId: p?.couponId ?? "",
    imageUrl: p?.imageUrl ?? "",
    imageAlt: p?.imageAlt ?? "",
    ctaLabel: p?.ctaLabel ?? "Shop now",
    ctaHref: p?.ctaHref ?? "/offers",
    theme: (PROMOTION_THEMES as readonly string[]).includes(p?.theme ?? "") ? (p!.theme as Theme) : "peach",
    sortOrder: String(p?.sortOrder ?? 0),
  };
}

function toInput(d: Draft): PromotionInput {
  return {
    name: d.name,
    headline: d.headline,
    subheadline: d.subheadline,
    discountPercent: Number.parseInt(d.discountPercent, 10) || 0,
    startsAt: istInputToIso(d.startsAt) ?? "",
    endsAt: istInputToIso(d.endsAt) ?? "",
    isActive: d.isActive,
    placement: d.placement,
    scope: d.scope,
    categoryIds: d.scope === "CATEGORIES" ? d.categoryIds : [],
    productIds: d.scope === "PRODUCTS" ? d.productIds : [],
    couponId: d.couponId || null,
    imageUrl: d.imageUrl.trim() || null,
    imageAlt: d.imageUrl.trim() ? d.imageAlt : null,
    ctaLabel: d.ctaLabel,
    ctaHref: d.ctaHref,
    theme: d.theme,
    sortOrder: Number.parseInt(d.sortOrder, 10) || 0,
  };
}

function PromotionForm({ promotion, onDone }: { promotion: AdminPromotionDTO | null; onDone: () => void }) {
  const { show } = useToast();
  const coupons = useAdminQuery<AdminCouponDTO[]>(["coupons"], "/coupons");
  const [d, setD] = useState<Draft>(() => fromPromotion(promotion));
  const [errors, setErrors] = useState<Record<string, string>>({});
  const save = useAdminMutation<PromotionInput, AdminPromotionDTO>(
    (input) =>
      promotion
        ? { path: `/promotions/${promotion.id}`, method: "PUT", body: input }
        : { path: "/promotions", method: "POST", body: input },
    [["promotions"], ["coupons"]],
  );
  const set = (patch: Partial<Draft>) => {
    setD((x) => ({ ...x, ...patch }));
    setErrors((e) => {
      const keys = Object.keys(patch);
      const keep = Object.entries(e).filter(
        ([k]) => !keys.includes(k) && !(k === "scope" && (keys.includes("categoryIds") || keys.includes("productIds"))),
      );
      return keep.length === Object.keys(e).length ? e : Object.fromEntries(keep);
    });
  };

  function onSubmit(e: FormEvent) {
    e.preventDefault();
    const input = toInput(d);
    const parsed = promotionInputSchema.safeParse(input);
    if (!parsed.success) return setErrors(issueMap(parsed.error.issues));
    setErrors({});
    save.mutate(input, {
      onSuccess: (saved) => {
        show({
          title: promotion ? "Promotion saved" : "Promotion created",
          description: `${saved.name} · storefront updated`,
          icon: "check",
          duration: 2500,
        });
        onDone();
      },
    });
  }

  const err = (k: string) => errors[k];
  return (
    <form onSubmit={onSubmit} noValidate className="space-y-5">
      {save.isError && <FormAlert>{errorMessage(save.error)}</FormAlert>}
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Name" hint="For you; shoppers see the headline." error={err("name")}>
          {(p) => <input {...p} value={d.name} onChange={(e) => set({ name: e.target.value })} className={inputCls} maxLength={80} />}
        </Field>
        <Field label="Discount" error={err("discountPercent")}>
          {(p) => (
            <div className="relative">
              <input
                {...p}
                type="number"
                min={1}
                max={90}
                inputMode="numeric"
                value={d.discountPercent}
                onChange={(e) => set({ discountPercent: e.target.value })}
                className={cn(inputCls, "pr-16")}
              />
              <span className="pointer-events-none absolute top-1/2 right-3 -translate-y-1/2 text-sm text-muted">% off</span>
            </div>
          )}
        </Field>
        <Field label="Headline" error={err("headline")} className="sm:col-span-2">
          {(p) => (
            <input {...p} value={d.headline} onChange={(e) => set({ headline: e.target.value })} className={inputCls} maxLength={80} />
          )}
        </Field>
        <Field label="Supporting line" hint="Optional" error={err("subheadline")} className="sm:col-span-2">
          {(p) => (
            <input
              {...p}
              value={d.subheadline}
              onChange={(e) => set({ subheadline: e.target.value })}
              className={inputCls}
              maxLength={160}
            />
          )}
        </Field>
        <ScheduleFields
          startsAt={d.startsAt}
          endsAt={d.endsAt}
          onChange={set}
          errors={{ startsAt: err("startsAt"), endsAt: err("endsAt") }}
        />
      </div>

      <ScopeFields scope={d.scope} categoryIds={d.categoryIds} productIds={d.productIds} onChange={set} error={err("scope")} />

      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Where it shows" hint={PLACEMENT_HINT[d.placement]}>
          {(p) => (
            <select {...p} value={d.placement} onChange={(e) => set({ placement: e.target.value as Placement })} className={inputCls}>
              {PROMOTION_PLACEMENTS.map((pl) => (
                <option key={pl} value={pl}>
                  {PLACEMENT_LABEL[pl]}
                </option>
              ))}
            </select>
          )}
        </Field>
        <Field label="Coupon to mention" hint="Shown on the hero card, and in the announcement bar for the countdown offer.">
          {(p) => (
            <select {...p} value={d.couponId} onChange={(e) => set({ couponId: e.target.value })} className={inputCls}>
              <option value="">None</option>
              {coupons.data?.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.code}
                  {c.status !== "live" ? ` (${c.status})` : ""}
                </option>
              ))}
            </select>
          )}
        </Field>
        <Field label="Button label" error={err("ctaLabel")}>
          {(p) => (
            <input {...p} value={d.ctaLabel} onChange={(e) => set({ ctaLabel: e.target.value })} className={inputCls} maxLength={30} />
          )}
        </Field>
        <Field label="Button link" hint="A page on this site, like /offers or /c/toys" error={err("ctaHref")}>
          {(p) => <input {...p} value={d.ctaHref} onChange={(e) => set({ ctaHref: e.target.value })} className={inputCls} />}
        </Field>
        <ImageField
          label="Image"
          hint="Optional. Upload or paste an https:// link."
          value={d.imageUrl}
          onChange={(imageUrl) => set({ imageUrl })}
          error={err("imageUrl")}
          className="sm:col-span-2"
        />
        {d.imageUrl.trim() && (
          <Field label="Image description" error={err("imageAlt")} className="sm:col-span-2">
            {(p) => (
              <input {...p} value={d.imageAlt} onChange={(e) => set({ imageAlt: e.target.value })} className={inputCls} maxLength={160} />
            )}
          </Field>
        )}
      </div>

      <fieldset>
        <legend className="mb-1.5 text-xs font-bold text-forest">Colour</legend>
        <div className="flex flex-wrap gap-2">
          {PROMOTION_THEMES.map((t) => (
            <label
              key={t}
              className="relative cursor-pointer rounded-full has-focus-visible:outline-2 has-focus-visible:outline-offset-2 has-focus-visible:outline-forest"
            >
              <input type="radio" name="theme" value={t} checked={d.theme === t} onChange={() => set({ theme: t })} className="sr-only" />
              <span
                className={cn(
                  "flex h-9 items-center rounded-full px-3.5 text-xs font-bold text-charcoal capitalize ring-1",
                  THEME_SWATCH[t],
                  d.theme === t ? "ring-2 ring-forest" : "ring-line",
                )}
              >
                {t}
              </span>
            </label>
          ))}
        </div>
      </fieldset>

      <div className="flex flex-wrap items-center justify-between gap-4 border-t border-line pt-4">
        <div className="flex flex-wrap items-center gap-5">
          <Toggle checked={d.isActive} onChange={(isActive) => set({ isActive })} label="Running" />
          <Field label="Order" className="w-24">
            {(p) => (
              <input
                {...p}
                type="number"
                min={0}
                value={d.sortOrder}
                onChange={(e) => set({ sortOrder: e.target.value })}
                className={cn(inputCls, "h-9")}
              />
            )}
          </Field>
        </div>
        <button type="submit" className={btn.primary} disabled={save.isPending}>
          {promotion ? "Save promotion" : "Create promotion"}
        </button>
      </div>
    </form>
  );
}

export function PromotionManager() {
  const { show } = useToast();
  const list = useAdminQuery<AdminPromotionDTO[]>(["promotions"], "/promotions");
  const dialog = useModalTarget<AdminPromotionDTO | "new">();
  const remove = useAdminMutation<string, unknown>((id) => ({ path: `/promotions/${id}`, method: "DELETE" }), [["promotions"]]);

  return (
    <AdminPage
      title="Promotions"
      description="Percentage-off offers. The best live offer sets each product's price; ended offers stop automatically."
      actions={
        <button type="button" onClick={() => dialog.show("new")} className={btn.primary}>
          <Plus className="size-4" aria-hidden="true" /> New promotion
        </button>
      }
    >
      <Panel>
        {list.isError ? (
          <LoadError error={list.error} onRetry={() => void list.refetch()} />
        ) : (
          <DataTable
            caption="Promotions"
            rows={list.data}
            rowKey={(p) => p.id}
            loading={list.isPending}
            empty="No promotions yet."
            columns={[
              {
                key: "name",
                header: "Promotion",
                cell: (p) => (
                  <span className="block max-w-[18rem]">
                    <button
                      type="button"
                      onClick={() => dialog.show(p)}
                      className="block truncate text-left font-bold text-charcoal hover:underline"
                    >
                      {p.name}
                    </button>
                    <span className="block truncate text-xs text-muted">{p.headline}</span>
                  </span>
                ),
              },
              { key: "off", header: "Discount", align: "right", cell: (p) => <span className="font-bold">{p.discountPercent}%</span> },
              {
                key: "when",
                header: "Runs",
                cell: (p) => (
                  <span className="text-xs whitespace-nowrap text-muted">
                    {formatDateTime(p.startsAt)}
                    <br />
                    to {formatDateTime(p.endsAt)}
                  </span>
                ),
              },
              { key: "where", header: "Shown as", cell: (p) => <span className="text-sm">{PLACEMENT_LABEL[p.placement]}</span> },
              {
                key: "coupon",
                header: "Coupon",
                cell: (p) =>
                  p.couponCode ? <span className="font-mono text-xs">{p.couponCode}</span> : <span className="text-muted">—</span>,
              },
              { key: "status", header: "Status", cell: (p) => <ScheduleBadge status={p.status} /> },
              {
                key: "actions",
                header: <span className="sr-only">Actions</span>,
                align: "right",
                cell: (p) => (
                  <span className="inline-flex items-center gap-1">
                    <button type="button" onClick={() => dialog.show(p)} className={btn.ghost} aria-label={`Edit ${p.name}`}>
                      <Pencil className="size-4" aria-hidden="true" />
                    </button>
                    <ConfirmButton
                      label="Delete"
                      confirmLabel="Delete"
                      pending={remove.isPending}
                      onConfirm={() =>
                        remove.mutate(p.id, {
                          onSuccess: () => show({ title: "Promotion deleted", description: p.name, icon: "check", duration: 2500 }),
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
      <Modal open={dialog.open} onClose={dialog.close} title={dialog.target === "new" ? "New promotion" : "Edit promotion"} size="wide">
        <PromotionForm promotion={dialog.target === "new" ? null : dialog.target} onDone={dialog.close} />
      </Modal>
    </AdminPage>
  );
}
