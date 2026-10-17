import { describe, it, expect } from "vitest";
import { formatINR, rupeesToPaise, paiseToRupees, roundToRupee } from "./money";

describe("money", () => {
  it("formats paise as Indian rupees with lakh grouping", () => {
    expect(formatINR(129900)).toBe("₹1,299");
    expect(formatINR(12345600)).toBe("₹1,23,456");
    expect(formatINR(0)).toBe("₹0");
  });

  it("optionally shows paise", () => {
    expect(formatINR(129950, { decimals: true })).toBe("₹1,299.50");
  });

  it("converts between rupees and paise without float drift", () => {
    expect(rupeesToPaise(19.99)).toBe(1999);
    expect(paiseToRupees(1999)).toBe(19.99);
  });

  it("rounds to the nearest whole rupee", () => {
    expect(roundToRupee(110415)).toBe(110400);
    expect(roundToRupee(110450)).toBe(110500);
    expect(roundToRupee(110449)).toBe(110400);
  });
});
