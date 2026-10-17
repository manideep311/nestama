"use client";

import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Loader2, MapPin, Truck } from "lucide-react";
import type { DeliveryEstimateDTO } from "@nestama/shared";
import { apiFetch } from "@/lib/cart-client";
import { PINCODE_PATTERN, savePincode, usePincode } from "@/lib/pincode";

const fmt = new Intl.DateTimeFormat("en-IN", { timeZone: "Asia/Kolkata", weekday: "short", day: "numeric", month: "short" });
const day = (ymd: string) => fmt.format(new Date(`${ymd}T12:00:00+05:30`));

/** Delivery promise for the shopper's pincode (shared with the header's "Deliver to" selector). */
export function DeliveryEstimate() {
  const pincode = usePincode();
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState("");
  const [error, setError] = useState<string | null>(null);

  const { data, isFetching, isError } = useQuery({
    queryKey: ["delivery", pincode],
    queryFn: () => apiFetch<DeliveryEstimateDTO>(`/delivery-estimate?pincode=${pincode}`),
    enabled: Boolean(pincode),
    staleTime: 10 * 60_000,
  });

  if (!pincode || editing) {
    return (
      <form
        className="rounded-2xl bg-white p-4 ring-1 ring-line"
        onSubmit={(e) => {
          e.preventDefault();
          if (!PINCODE_PATTERN.test(draft)) return setError("Enter a valid 6-digit pincode");
          savePincode(draft);
          setEditing(false);
        }}
      >
        <label htmlFor="pdp-pincode" className="flex items-center gap-2 text-sm font-bold text-forest">
          <MapPin className="size-4 text-orange" aria-hidden="true" /> Check delivery to your pincode
        </label>
        <div className="mt-2 flex gap-2">
          <input
            id="pdp-pincode"
            inputMode="numeric"
            autoComplete="postal-code"
            maxLength={6}
            value={draft}
            onChange={(e) => {
              setDraft(e.target.value.replace(/\D/g, ""));
              setError(null);
            }}
            aria-invalid={Boolean(error)}
            aria-describedby={error ? "pdp-pincode-error" : undefined}
            placeholder="e.g. 560001"
            className="h-11 min-w-0 flex-1 rounded-xl border border-line bg-cream px-3 tabular-nums outline-none focus:border-forest"
          />
          <button type="submit" className="h-11 rounded-xl bg-forest px-5 text-sm font-bold text-cream hover:bg-forest-700">
            Check
          </button>
        </div>
        {error && (
          <p id="pdp-pincode-error" role="alert" className="mt-2 text-xs font-semibold text-orange-ink">
            {error}
          </p>
        )}
      </form>
    );
  }

  return (
    <div className="flex items-start gap-3 rounded-2xl bg-white p-4 ring-1 ring-line" aria-live="polite">
      <Truck className="mt-0.5 size-5 shrink-0 text-forest" aria-hidden="true" />
      <div className="min-w-0 flex-1 text-sm">
        {isFetching && !data ? (
          <p className="flex items-center gap-2 text-muted">
            <Loader2 className="size-4 animate-spin" aria-hidden="true" /> Checking delivery to {pincode}…
          </p>
        ) : isError || !data ? (
          <p className="text-muted">We couldn&apos;t check delivery just now.</p>
        ) : (
          <p className="text-charcoal">
            Delivery by{" "}
            <strong className="text-forest">
              {day(data.earliest)} – {day(data.latest)}
            </strong>{" "}
            to <span className="tabular-nums">{pincode}</span>
            {data.metro && <span className="ml-1.5 rounded-md bg-sage px-1.5 py-0.5 text-[11px] font-bold text-forest">Express area</span>}
          </p>
        )}
        <p className="mt-0.5 text-xs text-muted">Order before 2 pm for same-day dispatch.</p>
      </div>
      <button
        type="button"
        onClick={() => {
          setDraft(pincode);
          setEditing(true);
        }}
        className="text-sm font-bold text-orange-ink hover:text-forest"
      >
        Change
      </button>
    </div>
  );
}
