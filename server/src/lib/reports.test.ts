import { describe, expect, it } from "vitest";
import { bucketRevenue, istDateKey, percentChange } from "./reports";

describe("istDateKey", () => {
  it("uses the India calendar day", () => {
    expect(istDateKey(new Date("2026-10-13T20:00:00Z"))).toBe("2026-10-14"); // 01:30 IST
    expect(istDateKey(new Date("2026-10-13T18:29:59Z"))).toBe("2026-10-13"); // 23:59 IST
  });
});

describe("bucketRevenue", () => {
  const orders = [
    { placedAt: new Date("2026-10-11T05:00:00Z"), total: 100000 },
    { placedAt: new Date("2026-10-11T19:00:00Z"), total: 50000 }, // 00:30 IST on the 12th
    { placedAt: new Date("2026-10-13T08:00:00Z"), total: 25000 },
  ];

  it("fills every day in the range, including empty ones", () => {
    const days = bucketRevenue(orders, { from: new Date("2026-10-10T06:00:00Z"), to: new Date("2026-10-13T06:00:00Z"), by: "day" });
    expect(days).toEqual([
      { date: "2026-10-10", revenue: 0, orders: 0 },
      { date: "2026-10-11", revenue: 100000, orders: 1 },
      { date: "2026-10-12", revenue: 50000, orders: 1 },
      { date: "2026-10-13", revenue: 25000, orders: 1 },
    ]);
  });

  it("groups by IST week starting Monday", () => {
    // 2026-10-11 is a Sunday; 2026-10-12 is a Monday.
    const weeks = bucketRevenue(orders, { from: new Date("2026-10-05T06:00:00Z"), to: new Date("2026-10-14T06:00:00Z"), by: "week" });
    expect(weeks).toEqual([
      { date: "2026-10-05", revenue: 100000, orders: 1 },
      { date: "2026-10-12", revenue: 75000, orders: 2 },
    ]);
  });
});

describe("percentChange", () => {
  it("compares with the previous period", () => {
    expect(percentChange(150, 100)).toBe(50);
    expect(percentChange(50, 200)).toBe(-75);
    expect(percentChange(1, 3)).toBe(-66.7);
  });

  it("has no percentage when there was nothing before", () => {
    expect(percentChange(0, 0)).toBe(0);
    expect(percentChange(10, 0)).toBeNull();
  });
});
