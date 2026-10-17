// Format-only checks for the NestaPay demo. Nothing typed into the payment form ever leaves the
// browser — these only decide whether the "Pay" button may proceed.

const digits = (s: string) => s.replace(/\D/g, "");

/** Luhn checksum for 12–19 digit card numbers (spaces/dashes ignored). */
export function luhnValid(input: string): boolean {
  const d = digits(input);
  if (d.length < 12 || d.length > 19) return false;
  let sum = 0;
  for (let i = 0; i < d.length; i++) {
    let n = Number(d[d.length - 1 - i]);
    if (i % 2 === 1) {
      n *= 2;
      if (n > 9) n -= 9;
    }
    sum += n;
  }
  return sum % 10 === 0;
}

/** "4111111111111111" → "4111 1111 1111 1111" (at most 19 digits). */
export function formatCardNumber(input: string): string {
  return digits(input)
    .slice(0, 19)
    .replace(/(\d{4})(?=\d)/g, "$1 ");
}

export function cardBrand(input: string): "Visa" | "Mastercard" | "RuPay" | null {
  const d = digits(input);
  if (/^4/.test(d)) return "Visa";
  if (/^(5[1-5]|2(2[2-9]|[3-6]\d|7[01]|720))/.test(d)) return "Mastercard";
  if (/^(60|65|81|82|508)/.test(d)) return "RuPay";
  return null;
}

/** Builds MM/YY as digits are typed: "12" → "12/", "1228" → "12/28". */
export function formatExpiry(input: string): string {
  const d = digits(input).slice(0, 4);
  if (d.length < 2) return d;
  if (d.length === 2) return `${d}/`;
  return `${d.slice(0, 2)}/${d.slice(2)}`;
}

/** A real month, this month or later. */
export function expiryValid(input: string, now = new Date()): boolean {
  const m = /^(0[1-9]|1[0-2])\/(\d{2})$/.exec(input.trim());
  if (!m) return false;
  const month = Number(m[1]);
  const year = 2000 + Number(m[2]);
  return year > now.getFullYear() || (year === now.getFullYear() && month >= now.getMonth() + 1);
}

/** handle@bank — a UPI virtual payment address. */
export function upiValid(input: string): boolean {
  return /^[a-z0-9._-]{2,256}@[a-z][a-z0-9]{1,63}$/i.test(input.trim());
}
