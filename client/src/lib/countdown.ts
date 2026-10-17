// Pure countdown helpers (no React), shared by every offer timer.

export interface TimeLeft {
  total: number;
  days: number;
  hours: number;
  minutes: number;
  seconds: number;
  expired: boolean;
}

const SECOND = 1000;
const MINUTE = 60 * SECOND;
const HOUR = 60 * MINUTE;
const DAY = 24 * HOUR;

export function timeLeft(endsAtMs: number, nowMs: number): TimeLeft {
  const total = Math.max(0, endsAtMs - nowMs);
  // Whole seconds only, rounded down, so we never claim more time than remains.
  const s = Math.floor(total / SECOND) * SECOND;
  return {
    total,
    days: Math.floor(s / DAY),
    hours: Math.floor((s % DAY) / HOUR),
    minutes: Math.floor((s % HOUR) / MINUTE),
    seconds: Math.floor((s % MINUTE) / SECOND),
    expired: total <= 0,
  };
}

export const pad2 = (n: number): string => String(n).padStart(2, "0");

const istFormatter = new Intl.DateTimeFormat("en-IN", {
  timeZone: "Asia/Kolkata",
  weekday: "short",
  day: "numeric",
  month: "short",
  hour: "numeric",
  minute: "2-digit",
  hour12: true,
});

/** Deterministic on server and client (fixed locale + time zone), so it never causes hydration mismatches. */
export function formatOfferEnd(iso: string): string {
  const parts = Object.fromEntries(istFormatter.formatToParts(new Date(iso)).map((p) => [p.type, p.value]));
  return `${parts.weekday}, ${parts.day} ${parts.month}, ${parts.hour}:${parts.minute} ${String(parts.dayPeriod).toLowerCase()} IST`;
}
