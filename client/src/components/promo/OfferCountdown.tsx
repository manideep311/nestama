"use client";

import { useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { AnimatePresence, useReducedMotion } from "motion/react";
import * as m from "motion/react-m";
import { Clock } from "lucide-react";
import { formatOfferEnd, pad2, type TimeLeft } from "@/lib/countdown";
import { useCountdown } from "@/lib/use-countdown";
import { cn } from "@/lib/cn";

interface Props {
  endsAt: string;
  variant?: "tiles" | "pill";
  className?: string;
}

/**
 * Live countdown to a promotion's real end time. Never resets on refresh (it's computed from
 * `endsAt`), and when it reaches zero it says so and refreshes the page data so the expired
 * offer disappears rather than showing a fake timer.
 */
export function OfferCountdown({ endsAt, variant = "tiles", className }: Props) {
  const left = useCountdown(endsAt);
  const router = useRouter();
  const refreshed = useRef(false);

  useEffect(() => {
    if (left?.expired && !refreshed.current) {
      refreshed.current = true;
      router.refresh();
    }
  }, [left?.expired, router]);

  if (left?.expired) {
    return (
      <p className={cn("text-sm font-bold text-muted", className)} role="status">
        This offer has ended.
      </p>
    );
  }

  return (
    <div className={className}>
      <p className="sr-only">Offer ends {formatOfferEnd(endsAt)}.</p>
      <MinuteAnnouncer left={left} />
      {variant === "tiles" ? <Tiles left={left} /> : <Pill left={left} />}
    </div>
  );
}

/**
 * Polite summary for screen readers. It's built from days/hours/minutes only, so its text —
 * and therefore the announcement — changes at most once a minute. Ticking digits are hidden.
 */
function MinuteAnnouncer({ left }: { left: TimeLeft | null }) {
  const message = left
    ? [
        left.days && `${left.days} ${left.days === 1 ? "day" : "days"}`,
        left.hours && `${left.hours} ${left.hours === 1 ? "hour" : "hours"}`,
        `${left.minutes} ${left.minutes === 1 ? "minute" : "minutes"} left`,
      ]
        .filter(Boolean)
        .join(", ")
    : "";
  return (
    <p className="sr-only" aria-live="polite" aria-atomic="true">
      {message}
    </p>
  );
}

function Tiles({ left }: { left: TimeLeft | null }) {
  const units: [string, number | undefined][] = [
    ["Days", left?.days],
    ["Hours", left?.hours],
    ["Minutes", left?.minutes],
    ["Seconds", left?.seconds],
  ];
  return (
    <ol className="grid grid-cols-4 gap-2" aria-hidden="true">
      {units.map(([label, value]) => (
        <li
          key={label}
          className="flex flex-col items-center rounded-2xl bg-forest px-1 pt-2.5 pb-2 text-cream shadow-[inset_0_-3px_0_rgb(0_0_0/0.18)]"
        >
          <Digits value={value === undefined ? "--" : pad2(value)} className="font-display text-[1.75rem] leading-none font-extrabold" />
          <span className="mt-1 text-[10px] font-semibold tracking-wider text-cream/75 uppercase">{label}</span>
        </li>
      ))}
    </ol>
  );
}

function Pill({ left }: { left: TimeLeft | null }) {
  const text = !left
    ? "--:--:--"
    : `${left.days > 0 ? `${left.days}d ` : ""}${pad2(left.hours)}:${pad2(left.minutes)}:${pad2(left.seconds)}`;
  return (
    <span className="inline-flex items-center gap-2 rounded-full border border-ember/25 bg-white px-4 py-2 text-sm font-bold text-orange-ink shadow-card">
      <Clock className="size-4" aria-hidden="true" />
      <span aria-hidden="true">
        Offer ends in <span className="tabular">{text}</span>
      </span>
    </span>
  );
}

/** Each character slides up when it changes; static under reduced motion. */
function Digits({ value, className }: { value: string; className?: string }) {
  const reduce = useReducedMotion();
  return (
    <span className={cn("tabular relative inline-flex overflow-hidden", className)}>
      {value.split("").map((ch, i) => (
        <span key={i} className="relative inline-block w-[0.62em] text-center">
          {/* Same element either way, so server HTML matches under reduced motion too. */}
          {reduce ? (
            <span className="inline-block">{ch}</span>
          ) : (
            <AnimatePresence mode="popLayout" initial={false}>
              <m.span
                key={ch}
                className="inline-block"
                initial={{ y: "-70%", opacity: 0 }}
                animate={{ y: 0, opacity: 1 }}
                exit={{ y: "70%", opacity: 0 }}
                transition={{ duration: 0.28, ease: [0.2, 0.8, 0.2, 1] }}
              >
                {ch}
              </m.span>
            </AnimatePresence>
          )}
        </span>
      ))}
    </span>
  );
}
