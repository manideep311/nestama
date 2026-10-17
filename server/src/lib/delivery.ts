import type { DeliveryEstimateDTO } from "@nestama/shared";

// Simple, honest delivery promise for the demo: metro hubs 2–3 days, elsewhere 4–6 days,
// no Sunday deliveries, orders after 2 pm IST dispatch the next day.

const PINCODE = /^[1-9][0-9]{5}$/;
/** Delhi, Mumbai, Bengaluru, Chennai, Kolkata, Hyderabad. */
const METRO_PREFIXES = new Set(["11", "40", "56", "60", "70", "50"]);
const IST_OFFSET_MS = 330 * 60 * 1000;
const CUTOFF_HOUR_IST = 14;

/** A calendar date in IST, as a UTC-midnight Date for easy day arithmetic. */
function istDate(d: Date): Date {
  const shifted = new Date(d.getTime() + IST_OFFSET_MS);
  return new Date(Date.UTC(shifted.getUTCFullYear(), shifted.getUTCMonth(), shifted.getUTCDate()));
}

function addDeliveryDays(start: Date, days: number): Date {
  const d = new Date(start);
  let added = 0;
  while (added < days) {
    d.setUTCDate(d.getUTCDate() + 1);
    if (d.getUTCDay() !== 0) added++; // Sundays don't count
  }
  return d;
}

const ymd = (d: Date) => d.toISOString().slice(0, 10);

export function estimateDelivery(pincode: string, now: Date): DeliveryEstimateDTO | null {
  if (!PINCODE.test(pincode)) return null;
  const metro = METRO_PREFIXES.has(pincode.slice(0, 2));
  const [minDays, maxDays] = metro ? [2, 3] : [4, 6];

  const istHour = new Date(now.getTime() + IST_OFFSET_MS).getUTCHours();
  const dispatch = istDate(now);
  if (istHour >= CUTOFF_HOUR_IST) dispatch.setUTCDate(dispatch.getUTCDate() + 1);

  return {
    pincode,
    metro,
    minDays,
    maxDays,
    earliest: ymd(addDeliveryDays(dispatch, minDays)),
    latest: ymd(addDeliveryDays(dispatch, maxDays)),
  };
}
