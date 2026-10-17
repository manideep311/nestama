"use client";

import { useId } from "react";
import type { VariantDTO } from "@nestama/shared";
import { cn } from "@/lib/cn";

const swatches: Record<string, string> = {
  cream: "#F3E9D2",
  sage: "#B9CDB4",
  blush: "#F2C4C0",
  charcoal: "#3A3F3C",
  red: "#C0392B",
  sand: "#D8C3A0",
};

/** Variant chips as a radio group (colour swatches when the option is a colour); sold-out variants are disabled. */
export function VariantPicker({
  variants,
  value,
  onChange,
  className,
}: {
  variants: VariantDTO[];
  value: string;
  onChange: (variantId: string) => void;
  className?: string;
}) {
  const groupId = useId();
  const current = variants.find((v) => v.id === value) ?? variants[0]!;
  const optionKey = Object.keys(current.options)[0];
  const isColour = optionKey?.toLowerCase().startsWith("colo");

  return (
    <fieldset className={className}>
      <legend className="mb-2.5 text-sm font-bold text-forest">
        {optionKey ?? "Option"}: <span className="font-semibold text-charcoal">{current.label}</span>
      </legend>
      <div className="flex flex-wrap gap-2">
        {variants.map((v) => {
          const disabled = v.stock === "OUT_OF_STOCK";
          const selected = v.id === current.id;
          const swatch = isColour ? swatches[v.label.toLowerCase()] : undefined;
          return (
            <label
              key={v.id}
              className={cn(
                "relative inline-flex h-11 cursor-pointer items-center gap-2 rounded-full border-2 px-4 text-sm font-bold transition-colors has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-offset-2 has-[:focus-visible]:outline-forest",
                selected ? "border-forest bg-forest text-cream" : "border-line bg-white text-forest hover:border-forest/40",
                disabled && "cursor-not-allowed line-through opacity-50",
              )}
            >
              <input
                type="radio"
                name={`${groupId}-variant`}
                value={v.id}
                checked={selected}
                disabled={disabled}
                onChange={() => onChange(v.id)}
                className="sr-only"
              />
              {swatch && <span aria-hidden="true" className="size-4 rounded-full ring-1 ring-black/10" style={{ background: swatch }} />}
              {v.label}
              {disabled && <span className="sr-only"> (sold out)</span>}
            </label>
          );
        })}
      </div>
    </fieldset>
  );
}
