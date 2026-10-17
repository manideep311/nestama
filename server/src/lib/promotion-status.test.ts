import { describe, expect, it } from "vitest";
import { promotionStatus } from "./promotion-status";

describe("promotionStatus", () => {
  const window = { startsAt: new Date("2026-10-10T00:00:00Z"), endsAt: new Date("2026-10-20T00:00:00Z") };

  it("is scheduled, live, then ended", () => {
    expect(promotionStatus({ ...window, isActive: true }, new Date("2026-10-09T23:59:59Z"))).toBe("scheduled");
    expect(promotionStatus({ ...window, isActive: true }, new Date("2026-10-10T00:00:00Z"))).toBe("live");
    expect(promotionStatus({ ...window, isActive: true }, new Date("2026-10-20T00:00:00Z"))).toBe("ended");
  });

  it("reports paused when switched off, unless it has already ended", () => {
    expect(promotionStatus({ ...window, isActive: false }, new Date("2026-10-15T00:00:00Z"))).toBe("paused");
    expect(promotionStatus({ ...window, isActive: false }, new Date("2026-10-25T00:00:00Z"))).toBe("ended");
  });
});
