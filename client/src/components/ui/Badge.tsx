import type { ReactNode } from "react";
import { cn } from "@/lib/cn";

type Tone = "ember" | "forest" | "sage" | "peach" | "cream";

const tones: Record<Tone, string> = {
  ember: "bg-ember text-white",
  forest: "bg-forest text-cream",
  sage: "bg-sage text-forest",
  peach: "bg-peach text-orange-ink",
  cream: "bg-cream text-forest",
};

export function Badge({ tone = "ember", className, children }: { tone?: Tone; className?: string; children: ReactNode }) {
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full px-2.5 py-1 text-[11px] leading-none font-extrabold tracking-wide uppercase",
        tones[tone],
        className,
      )}
    >
      {children}
    </span>
  );
}
