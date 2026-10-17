import { describe, it, expect } from "vitest";
import { timeLeft, formatOfferEnd, pad2 } from "./countdown";

const at = (iso: string) => Date.parse(iso);

describe("timeLeft", () => {
  it("splits the remaining time into days, hours, minutes and seconds", () => {
    const t = timeLeft(at("2026-10-13T19:00:00Z"), at("2026-10-10T16:23:35Z"));
    expect(t).toEqual({ total: expect.any(Number), days: 3, hours: 2, minutes: 36, seconds: 25, expired: false });
  });

  it("never goes negative and flags expiry", () => {
    const t = timeLeft(at("2026-10-10T16:00:00Z"), at("2026-10-10T16:00:05Z"));
    expect(t).toMatchObject({ total: 0, days: 0, hours: 0, minutes: 0, seconds: 0, expired: true });
  });

  it("rounds partial seconds down so the display never overstates time left", () => {
    expect(timeLeft(at("2026-10-10T16:00:10Z"), at("2026-10-10T16:00:00.400Z")).seconds).toBe(9);
  });
});

describe("formatting", () => {
  it("pads to two digits", () => {
    expect(pad2(4)).toBe("04");
    expect(pad2(14)).toBe("14");
  });

  it("formats the end time in India Standard Time for every visitor", () => {
    expect(formatOfferEnd("2026-10-13T13:30:00Z")).toBe("Tue, 13 Oct, 7:00 pm IST");
  });
});
