import { describe, expect, it } from "vitest";
import { istInputToIso, isoToIstInput } from "./ist";

describe("IST datetime-local helpers", () => {
  it("reads a datetime-local value as India time", () => {
    expect(istInputToIso("2026-10-14T18:00")).toBe("2026-10-14T12:30:00.000Z");
    expect(istInputToIso("2026-10-15T00:15")).toBe("2026-10-14T18:45:00.000Z");
  });

  it("shows a stored instant as an India-time input value", () => {
    expect(isoToIstInput("2026-10-14T12:30:00.000Z")).toBe("2026-10-14T18:00");
    expect(isoToIstInput("2026-10-14T18:45:00.000Z")).toBe("2026-10-15T00:15");
  });

  it("round-trips and rejects junk", () => {
    expect(istInputToIso(isoToIstInput("2026-12-31T23:59:00.000Z"))).toBe("2026-12-31T23:59:00.000Z");
    expect(istInputToIso("")).toBeNull();
    expect(istInputToIso("not a date")).toBeNull();
  });
});
