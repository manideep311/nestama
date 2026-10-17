import type { RevenuePoint } from "@nestama/shared";

const IST_DAY = new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Kolkata", year: "numeric", month: "2-digit", day: "2-digit" });
const DAY_MS = 24 * 3600_000;

/** The India-time calendar day of an instant, as yyyy-mm-dd. */
export function istDateKey(date: Date): string {
  return IST_DAY.format(date);
}

/** A yyyy-mm-dd key as a UTC-midnight Date, for calendar arithmetic. */
function keyToDate(key: string): Date {
  const [y, m, d] = key.split("-").map(Number) as [number, number, number];
  return new Date(Date.UTC(y, m - 1, d));
}

const toKey = (d: Date) => d.toISOString().slice(0, 10);

/** Monday of the week containing this calendar day. */
function weekStart(key: string): string {
  const d = keyToDate(key);
  const offset = (d.getUTCDay() + 6) % 7; // Mon = 0 … Sun = 6
  return toKey(new Date(d.getTime() - offset * DAY_MS));
}

/**
 * Sums order totals into India-time days (or Monday-start weeks) from `from` to `to` inclusive.
 * Every bucket in the range is present, so charts show quiet days as zero rather than gaps.
 */
export function bucketRevenue(
  orders: { placedAt: Date; total: number }[],
  { from, to, by }: { from: Date; to: Date; by: "day" | "week" },
): RevenuePoint[] {
  const bucketOf = (key: string) => (by === "week" ? weekStart(key) : key);
  const buckets = new Map<string, RevenuePoint>();

  const last = bucketOf(istDateKey(to));
  const step = by === "week" ? 7 * DAY_MS : DAY_MS;
  for (let d = keyToDate(bucketOf(istDateKey(from))); toKey(d) <= last; d = new Date(d.getTime() + step)) {
    buckets.set(toKey(d), { date: toKey(d), revenue: 0, orders: 0 });
  }

  for (const o of orders) {
    const bucket = buckets.get(bucketOf(istDateKey(o.placedAt)));
    if (!bucket) continue;
    bucket.revenue += o.total;
    bucket.orders += 1;
  }
  return [...buckets.values()];
}

/** Percent change from `previous` to `current`, to one decimal; null when there's no baseline. */
export function percentChange(current: number, previous: number): number | null {
  if (previous === 0) return current === 0 ? 0 : null;
  return Math.round(((current - previous) / previous) * 1000) / 10;
}
