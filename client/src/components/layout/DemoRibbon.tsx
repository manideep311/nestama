"use client";

import { X } from "lucide-react";

const KEY = "nst_demo_ribbon_dismissed";

/**
 * Thin notice that this is a portfolio demo. Visible by default in the server HTML;
 * `ribbonPreference` (inlined in <head>) hides it before first paint if it was dismissed.
 */
export function DemoRibbon() {
  return (
    <div className="demo-ribbon bg-charcoal text-[12.5px] text-cream/90">
      <div className="container-page flex min-h-8 items-center justify-center gap-3 py-1 text-center">
        <p>
          <span className="font-bold text-peach">Portfolio demo</span> — sample products, and the checkout uses a simulated payment. No real
          orders or charges.
        </p>
        <button
          type="button"
          onClick={() => {
            try {
              localStorage.setItem(KEY, "1");
            } catch {
              // Storage unavailable — hide for this page view only.
            }
            document.documentElement.dataset.ribbon = "hidden";
          }}
          className="grid size-7 shrink-0 place-items-center rounded-full hover:bg-white/10"
        >
          <X className="size-4" aria-hidden="true" />
          <span className="sr-only">Dismiss demo notice</span>
        </button>
      </div>
    </div>
  );
}

/** Runs before paint (inline in <head>) so a dismissed ribbon never flashes. */
export const ribbonPreference = `try{if(localStorage.getItem("${KEY}")==="1")document.documentElement.dataset.ribbon="hidden"}catch(e){}`;
