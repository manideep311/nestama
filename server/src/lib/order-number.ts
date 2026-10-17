import { randomBytes, randomInt } from "node:crypto";

/** Digits and capitals without 0/O/1/I, so numbers read back clearly over the phone. */
export const ORDER_NUMBER_ALPHABET = "23456789ABCDEFGHJKLMNPQRSTUVWXYZ";
const BASE62 = "0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz";

/** Human-friendly order number, e.g. `NST-7KQ2MX`. Pass `random` (0 ≤ r < 1) to make it deterministic. */
export function newOrderNumber(random?: () => number): string {
  const n = ORDER_NUMBER_ALPHABET.length;
  let out = "NST-";
  for (let i = 0; i < 6; i++) {
    const index = random ? Math.min(n - 1, Math.floor(random() * n)) : randomInt(n);
    out += ORDER_NUMBER_ALPHABET[index];
  }
  return out;
}

/** Gateway-style ids: `order_…` for a payment order, `pay_…` for an authorised payment. */
export function newGatewayId(prefix: "order" | "pay"): string {
  const bytes = randomBytes(16);
  let id = "";
  for (const b of bytes) id += BASE62[b % 62];
  return `${prefix}_${id}`;
}
