"use client";

import { useEffect, useRef, useState } from "react";
import { timeLeft, type TimeLeft } from "./countdown";

// Offer timers count down to a real, server-configured `endsAt`. Visitors' clocks can be wrong,
// so we estimate the offset from the API's `Date` header once per page load and correct for it.

let offsetPromise: Promise<number> | null = null;

function serverClockOffset(): Promise<number> {
  offsetPromise ??= fetch("/api/v1/health", { cache: "no-store" })
    .then((res) => {
      const header = res.headers.get("date");
      // The header has 1-second resolution; +500 ms centres the estimate.
      return header ? Date.parse(header) + 500 - Date.now() : 0;
    })
    .catch(() => 0);
  return offsetPromise;
}

/**
 * Remaining time until `endsAt`, ticking each second. Returns null until mounted so the
 * server render and first client render match (no hydration mismatch, no fake numbers).
 */
export function useCountdown(endsAt: string): TimeLeft | null {
  const [left, setLeft] = useState<TimeLeft | null>(null);
  const offset = useRef(0);

  useEffect(() => {
    const end = Date.parse(endsAt);
    let alive = true;
    let timer: ReturnType<typeof setTimeout> | undefined;

    const tick = () => {
      const now = Date.now() + offset.current;
      const next = timeLeft(end, now);
      setLeft(next);
      if (!next.expired && alive) timer = setTimeout(tick, 1000 - (now % 1000) + 10);
    };

    serverClockOffset().then((o) => {
      // Ignore sub-2s differences — that's within the header's own precision.
      if (alive && Math.abs(o) > 2000) {
        offset.current = o;
        clearTimeout(timer);
        tick();
      }
    });
    tick();

    return () => {
      alive = false;
      clearTimeout(timer);
    };
  }, [endsAt]);

  return left;
}
