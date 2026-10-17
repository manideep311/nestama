"use client";

import { useId, useState } from "react";
import { Star } from "lucide-react";
import { cn } from "@/lib/cn";

const LABELS = ["Not for us", "Could be better", "It's okay", "Really good", "Loved it"];

/** 1–5 star rating as a native radio group (arrow keys move between stars). */
export function StarInput({ value, onChange, error }: { value: number; onChange: (rating: number) => void; error?: string }) {
  const name = useId();
  const [hover, setHover] = useState(0);
  const shown = hover || value;

  return (
    <fieldset aria-describedby={error ? `${name}-error` : undefined}>
      <legend className="mb-1.5 text-sm font-bold text-forest">Your rating</legend>
      <div className="flex items-center gap-3">
        <div className="flex" onMouseLeave={() => setHover(0)}>
          {[1, 2, 3, 4, 5].map((n) => (
            <label
              key={n}
              className="cursor-pointer rounded-lg p-0.5 has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-forest"
              onMouseEnter={() => setHover(n)}
            >
              <input type="radio" name={name} value={n} checked={value === n} onChange={() => onChange(n)} className="sr-only" />
              <Star
                className={cn("size-8 transition-colors", n <= shown ? "fill-[#F5A524] text-[#F5A524]" : "text-line")}
                aria-hidden="true"
              />
              <span className="sr-only">
                {n} {n === 1 ? "star" : "stars"} — {LABELS[n - 1]}
              </span>
            </label>
          ))}
        </div>
        <span className="text-sm font-semibold text-muted" aria-hidden="true">
          {shown ? LABELS[shown - 1] : "Tap to rate"}
        </span>
      </div>
      {error && (
        <p id={`${name}-error`} className="mt-1.5 text-sm font-semibold text-orange-ink">
          {error}
        </p>
      )}
    </fieldset>
  );
}
