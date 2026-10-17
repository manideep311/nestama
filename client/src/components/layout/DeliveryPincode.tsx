"use client";

import { useEffect, useId, useRef, useState } from "react";
import { MapPin } from "lucide-react";
import { PINCODE_PATTERN, savePincode, usePincode } from "@/lib/pincode";
import { cn } from "@/lib/cn";

/** "Deliver to 500081" selector in the announcement bar. */
export function DeliveryPincode() {
  const pincode = usePincode();
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState("");
  const [error, setError] = useState<string | null>(null);
  const rootRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const panelId = useId();
  const errorId = useId();

  useEffect(() => {
    if (!open) return;
    inputRef.current?.focus();
    const onPointer = (e: PointerEvent) => {
      if (!rootRef.current?.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setOpen(false);
        triggerRef.current?.focus();
      }
    };
    document.addEventListener("pointerdown", onPointer);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("pointerdown", onPointer);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!PINCODE_PATTERN.test(draft)) {
      setError("Enter a valid 6-digit pincode");
      return;
    }
    savePincode(draft);
    setOpen(false);
    triggerRef.current?.focus();
  }

  return (
    <div ref={rootRef} className="relative shrink-0">
      <button
        ref={triggerRef}
        type="button"
        aria-expanded={open}
        aria-controls={panelId}
        onClick={() => {
          setDraft(pincode ?? "");
          setError(null);
          setOpen((o) => !o);
        }}
        className="flex items-center gap-1.5 rounded-full px-2 py-1 font-semibold hover:bg-white/10"
      >
        <MapPin className="size-4 text-orange" aria-hidden="true" />
        <span className="hidden sm:inline">{pincode ? "Deliver to" : "Set delivery pincode"}</span>
        {pincode && <span className="tabular">{pincode}</span>}
        {!pincode && <span className="sm:hidden">Pincode</span>}
      </button>

      {open && (
        <form
          id={panelId}
          onSubmit={submit}
          className="absolute top-full right-0 z-60 mt-2 w-72 rounded-2xl bg-white p-4 text-charcoal shadow-lift ring-1 ring-line"
        >
          <label htmlFor={`${panelId}-input`} className="text-sm font-bold text-forest">
            Where should we deliver?
          </label>
          <p className="mt-0.5 text-xs text-muted">We&apos;ll show delivery estimates for your area.</p>
          <div className="mt-3 flex gap-2">
            <input
              ref={inputRef}
              id={`${panelId}-input`}
              inputMode="numeric"
              autoComplete="postal-code"
              maxLength={6}
              value={draft}
              onChange={(e) => {
                setDraft(e.target.value.replace(/\D/g, ""));
                setError(null);
              }}
              aria-invalid={Boolean(error)}
              aria-describedby={error ? errorId : undefined}
              placeholder="e.g. 500081"
              className={cn(
                "tabular h-10 min-w-0 flex-1 rounded-xl border bg-cream px-3 text-sm outline-none focus:border-forest",
                error ? "border-ember" : "border-line",
              )}
            />
            <button type="submit" className="h-10 rounded-xl bg-forest px-4 text-sm font-bold text-cream hover:bg-forest-700">
              Save
            </button>
          </div>
          {error && (
            <p id={errorId} className="mt-2 text-xs font-semibold text-orange-ink" role="alert">
              {error}
            </p>
          )}
        </form>
      )}
    </div>
  );
}
