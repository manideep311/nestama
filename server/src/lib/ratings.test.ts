import { describe, it, expect } from "vitest";
import { distributionFromAverage } from "./ratings";

const mean = (d: Record<number, number>) => {
  const total = Object.values(d).reduce((a, b) => a + b, 0);
  return Object.entries(d).reduce((s, [k, v]) => s + Number(k) * v, 0) / total;
};

describe("distributionFromAverage", () => {
  it.each([
    [4.8, 486],
    [4.3, 59],
    [3.9, 12],
    [4.6, 7],
  ])("sums to the count and matches the average %s closely", (avg, count) => {
    const d = distributionFromAverage(avg, count);
    expect(Object.values(d).reduce((a, b) => a + b, 0)).toBe(count);
    expect(Math.abs(mean(d) - avg)).toBeLessThan(0.15);
    expect(d[5]).toBeGreaterThanOrEqual(d[1]);
  });

  it("returns zeros when there are no ratings", () => {
    expect(distributionFromAverage(0, 0)).toEqual({ 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 });
  });
});
