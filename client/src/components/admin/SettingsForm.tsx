"use client";

import { useState, type FormEvent, type ReactNode } from "react";
import { settingsInputSchema, type AdminSettingsDTO, type SettingsInput } from "@nestama/shared";
import { errorMessage, useAdminMutation, useAdminQuery } from "@/lib/admin-client";
import { formatDateTime } from "@/lib/format";
import { useToast } from "@/components/toast/ToastProvider";
import { FormAlert } from "@/components/ui/Field";
import { cn } from "@/lib/cn";
import { AdminPage, btn, Field, inputCls, LoadError, Panel, RupeeInput } from "./AdminUI";
import { ImageField, issueMap } from "./fields";

interface Draft extends Omit<
  AdminSettingsDTO,
  "updatedAt" | "popularSearches" | "freeShippingThreshold" | "flatShippingFee" | "gstRatePercent"
> {
  freeShippingThreshold: number | null;
  flatShippingFee: number | null;
  gstRatePercent: string;
  popularSearches: string;
}

const fromSettings = (s: AdminSettingsDTO): Draft => ({
  announcementText: s.announcementText,
  freeShippingThreshold: s.freeShippingThreshold,
  flatShippingFee: s.flatShippingFee,
  gstRatePercent: String(s.gstRatePercent),
  heroHeadline: s.heroHeadline,
  heroSubcopy: s.heroSubcopy,
  heroImageUrl: s.heroImageUrl,
  heroImageAlt: s.heroImageAlt,
  popularSearches: s.popularSearches.join(", "),
  supportEmail: s.supportEmail,
  supportPhone: s.supportPhone,
});

const toInput = (d: Draft): SettingsInput => ({
  ...d,
  freeShippingThreshold: d.freeShippingThreshold ?? -1,
  flatShippingFee: d.flatShippingFee ?? -1,
  gstRatePercent: d.gstRatePercent.trim() === "" ? -1 : Number(d.gstRatePercent),
  popularSearches: d.popularSearches
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean),
});

function Section({ title, description, children }: { title: string; description?: string; children: ReactNode }) {
  return (
    <Panel
      title={
        <span>
          {title}
          {description && <span className="mt-0.5 block text-xs font-normal text-muted">{description}</span>}
        </span>
      }
    >
      <div className="grid gap-4 sm:grid-cols-2">{children}</div>
    </Panel>
  );
}

function Form({ settings }: { settings: AdminSettingsDTO }) {
  const { show } = useToast();
  const [d, setD] = useState<Draft>(() => fromSettings(settings));
  const [errors, setErrors] = useState<Record<string, string>>({});
  const save = useAdminMutation<SettingsInput, AdminSettingsDTO>((body) => ({ path: "/settings", method: "PUT", body }), [["settings"]]);
  const set = <K extends keyof Draft>(k: K, v: Draft[K]) => {
    setD((x) => ({ ...x, [k]: v }));
    setErrors((e) =>
      e[k] || Object.keys(e).some((p) => p.startsWith(`${k}.`))
        ? Object.fromEntries(Object.entries(e).filter(([p]) => p !== k && !p.startsWith(`${k}.`)))
        : e,
    );
  };
  const err = (k: string) => errors[k] ?? Object.entries(errors).find(([p]) => p.startsWith(`${k}.`))?.[1];

  function onSubmit(e: FormEvent) {
    e.preventDefault();
    const input = toInput(d);
    const parsed = settingsInputSchema.safeParse(input);
    if (!parsed.success) return setErrors(issueMap(parsed.error.issues));
    setErrors({});
    save.mutate(input, {
      onSuccess: () =>
        show({ title: "Settings saved", description: "The storefront shows the changes now.", icon: "check", duration: 2500 }),
    });
  }

  const lastSaved = save.data?.updatedAt ?? settings.updatedAt;
  return (
    <form onSubmit={onSubmit} noValidate className="space-y-6">
      {save.isError && <FormAlert>{errorMessage(save.error)}</FormAlert>}
      {Object.keys(errors).length > 0 && <FormAlert>Check the highlighted fields.</FormAlert>}

      <Section title="Announcement" description="The first message in the green bar at the top of every page.">
        <Field
          label="Message"
          hint={`Leave blank to show only the shipping and offer messages. ${d.announcementText.length}/160`}
          error={err("announcementText")}
          className="sm:col-span-2"
        >
          {(p) => (
            <input
              {...p}
              value={d.announcementText}
              onChange={(e) => set("announcementText", e.target.value)}
              className={inputCls}
              maxLength={160}
            />
          )}
        </Field>
      </Section>

      <Section title="Shipping & tax" description="Applies to new carts and checkouts straight away.">
        <Field label="Free shipping from" hint="Cart total after offers." error={err("freeShippingThreshold")}>
          {(p) => <RupeeInput {...p} value={d.freeShippingThreshold} onChange={(v) => set("freeShippingThreshold", v)} />}
        </Field>
        <Field label="Shipping fee below that" error={err("flatShippingFee")}>
          {(p) => <RupeeInput {...p} value={d.flatShippingFee} onChange={(v) => set("flatShippingFee", v)} />}
        </Field>
        <Field label="GST rate" hint="Prices already include it; receipts show the share." error={err("gstRatePercent")}>
          {(p) => (
            <div className="relative">
              <input
                {...p}
                type="number"
                min={0}
                max={28}
                inputMode="numeric"
                value={d.gstRatePercent}
                onChange={(e) => set("gstRatePercent", e.target.value)}
                className={cn(inputCls, "pr-8")}
              />
              <span className="pointer-events-none absolute top-1/2 right-3 -translate-y-1/2 text-sm text-muted">%</span>
            </div>
          )}
        </Field>
      </Section>

      <Section title="Homepage hero">
        <Field label="Headline" error={err("heroHeadline")} className="sm:col-span-2">
          {(p) => (
            <input
              {...p}
              value={d.heroHeadline}
              onChange={(e) => set("heroHeadline", e.target.value)}
              className={inputCls}
              maxLength={80}
            />
          )}
        </Field>
        <Field label="Supporting copy" error={err("heroSubcopy")} className="sm:col-span-2">
          {(p) => (
            <textarea
              {...p}
              rows={2}
              value={d.heroSubcopy}
              onChange={(e) => set("heroSubcopy", e.target.value)}
              className={cn(inputCls, "h-auto py-2")}
              maxLength={240}
            />
          )}
        </Field>
        <ImageField
          label="Image"
          value={d.heroImageUrl}
          onChange={(v) => set("heroImageUrl", v)}
          error={err("heroImageUrl")}
          className="sm:col-span-2"
        />
        <Field label="Image description" error={err("heroImageAlt")} className="sm:col-span-2">
          {(p) => (
            <input
              {...p}
              value={d.heroImageAlt}
              onChange={(e) => set("heroImageAlt", e.target.value)}
              className={inputCls}
              maxLength={160}
            />
          )}
        </Field>
      </Section>

      <Section title="Search">
        <Field
          label="Popular searches"
          hint="Up to 8, comma separated. Shown when the search box opens."
          error={err("popularSearches")}
          className="sm:col-span-2"
        >
          {(p) => <input {...p} value={d.popularSearches} onChange={(e) => set("popularSearches", e.target.value)} className={inputCls} />}
        </Field>
      </Section>

      <Section title="Support contacts" description="Shown in the store footer.">
        <Field label="Email" error={err("supportEmail")}>
          {(p) => (
            <input {...p} type="email" value={d.supportEmail} onChange={(e) => set("supportEmail", e.target.value)} className={inputCls} />
          )}
        </Field>
        <Field label="Phone" error={err("supportPhone")}>
          {(p) => (
            <input {...p} type="tel" value={d.supportPhone} onChange={(e) => set("supportPhone", e.target.value)} className={inputCls} />
          )}
        </Field>
      </Section>

      <div className="sticky bottom-0 z-10 -mx-1 flex flex-wrap items-center justify-between gap-3 rounded-2xl bg-cream/95 px-1 py-3 backdrop-blur">
        <p className="text-xs text-muted">Last saved {formatDateTime(lastSaved)}</p>
        <button type="submit" className={btn.primary} disabled={save.isPending}>
          Save settings
        </button>
      </div>
    </form>
  );
}

export function SettingsForm() {
  const settings = useAdminQuery<AdminSettingsDTO>(["settings"], "/settings");
  return (
    <AdminPage title="Settings" description="Store-wide copy, shipping and contact details.">
      {settings.isError ? (
        <LoadError error={settings.error} onRetry={() => void settings.refetch()} />
      ) : settings.data ? (
        <Form settings={settings.data} />
      ) : (
        <div className="h-[36rem] skeleton rounded-2xl" aria-busy="true" />
      )}
    </AdminPage>
  );
}
