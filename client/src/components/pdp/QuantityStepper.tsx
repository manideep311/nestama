"use client";

import { Minus, Plus } from "lucide-react";
import { cn } from "@/lib/cn";

/** − n + stepper, clamped to 1…max. */
export function QuantityStepper({
  value,
  max,
  disabled = false,
  onChange,
  className,
}: {
  value: number;
  max: number;
  disabled?: boolean;
  onChange: (quantity: number) => void;
  className?: string;
}) {
  return (
    <div className={cn("flex h-13 items-center rounded-full border-2 border-line bg-white", className)} role="group" aria-label="Quantity">
      <button
        type="button"
        onClick={() => onChange(Math.max(1, value - 1))}
        disabled={value <= 1 || disabled}
        className="grid size-12 place-items-center rounded-full text-forest hover:bg-sage disabled:opacity-35"
        aria-label="Decrease quantity"
      >
        <Minus className="size-4" aria-hidden="true" />
      </button>
      <output className="w-8 text-center font-bold tabular-nums" aria-live="polite">
        {value}
      </output>
      <button
        type="button"
        onClick={() => onChange(Math.min(max, value + 1))}
        disabled={value >= max || disabled}
        className="grid size-12 place-items-center rounded-full text-forest hover:bg-sage disabled:opacity-35"
        aria-label="Increase quantity"
      >
        <Plus className="size-4" aria-hidden="true" />
      </button>
    </div>
  );
}
