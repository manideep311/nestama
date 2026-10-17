// All money in NESTAMA is stored and computed as integer paise.
// These helpers convert and format at the edges only.

const inrWhole = new Intl.NumberFormat("en-IN", {
  style: "currency",
  currency: "INR",
  minimumFractionDigits: 0,
  maximumFractionDigits: 0,
});

const inrDecimal = new Intl.NumberFormat("en-IN", {
  style: "currency",
  currency: "INR",
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

export function formatINR(paise: number, opts: { decimals?: boolean } = {}): string {
  const formatter = opts.decimals ? inrDecimal : inrWhole;
  // Some ICU builds insert a (narrow) no-break space after the symbol; normalise it away.
  return formatter.format(paise / 100).replace(/[  \s]/g, "");
}

export const rupeesToPaise = (rupees: number): number => Math.round(rupees * 100);

export const paiseToRupees = (paise: number): number => paise / 100;

export const roundToRupee = (paise: number): number => Math.round(paise / 100) * 100;
