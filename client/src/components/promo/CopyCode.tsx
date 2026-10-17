"use client";

import { useState } from "react";
import { Check, Copy } from "lucide-react";
import { cn } from "@/lib/cn";

/** Coupon code chip with a copy button. */
export function CopyCode({ code, className }: { code: string; className?: string }) {
  const [copied, setCopied] = useState(false);

  async function copy() {
    try {
      await navigator.clipboard.writeText(code);
      setCopied(true);
      setTimeout(() => setCopied(false), 1800);
    } catch {
      // Clipboard blocked: the code is visible on screen to copy manually.
    }
  }

  return (
    <div
      className={cn(
        "flex items-center justify-between gap-3 rounded-2xl border-2 border-dashed border-ember/35 bg-peach/45 py-1.5 pr-1.5 pl-4",
        className,
      )}
    >
      <p className="text-sm text-charcoal">
        Use code: <strong className="font-extrabold tracking-wide text-orange-ink">{code}</strong>
      </p>
      <button
        type="button"
        onClick={copy}
        className="inline-flex h-9 items-center gap-1.5 rounded-xl bg-white px-3 text-xs font-bold text-forest shadow-card transition-colors hover:bg-cream"
      >
        {copied ? <Check className="size-4 text-forest" aria-hidden="true" /> : <Copy className="size-4" aria-hidden="true" />}
        <span aria-live="polite">{copied ? "Copied" : "Copy"}</span>
        <span className="sr-only"> code {code}</span>
      </button>
    </div>
  );
}
