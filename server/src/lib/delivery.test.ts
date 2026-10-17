import { describe, it, expect } from "vitest";
import { estimateDelivery } from "./delivery";

// IST = UTC+5:30. 2026-10-09 is a Friday.
const ist = (isoLocal: string) => new Date(`${isoLocal}+05:30`);

describe("estimateDelivery", () => {
  it("gives metro pincodes 2–3 delivery days, skipping Sundays", () => {
    const e = estimateDelivery("500081", ist("2026-10-10T10:00:00")); // Saturday morning
    expect(e).toMatchObject({ pincode: "500081", metro: true, minDays: 2, maxDays: 3, earliest: "2026-10-13", latest: "2026-10-14" });
  });

  it("gives other valid pincodes 4–6 days", () => {
    const e = estimateDelivery("682001", ist("2026-10-10T10:00:00"));
    expect(e).toMatchObject({ metro: false, minDays: 4, maxDays: 6, earliest: "2026-10-15", latest: "2026-10-17" });
  });

  it("dispatches the next day for orders after the 2 pm IST cutoff", () => {
    expect(estimateDelivery("110001", ist("2026-10-09T10:00:00"))?.earliest).toBe("2026-10-12"); // Fri → Sat(1), Mon(2)
    expect(estimateDelivery("110001", ist("2026-10-09T16:00:00"))?.earliest).toBe("2026-10-13"); // after cutoff: from Sat
  });

  it("rejects malformed pincodes", () => {
    expect(estimateDelivery("012345", new Date())).toBeNull();
    expect(estimateDelivery("12345", new Date())).toBeNull();
    expect(estimateDelivery("abcdef", new Date())).toBeNull();
  });
});
