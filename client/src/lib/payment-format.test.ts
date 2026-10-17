import { describe, expect, it } from "vitest";
import { cardBrand, expiryValid, formatCardNumber, formatExpiry, luhnValid, upiValid } from "./payment-format";

describe("card number helpers", () => {
  it("accepts published test numbers and rejects a changed digit", () => {
    expect(luhnValid("4111 1111 1111 1111")).toBe(true);
    expect(luhnValid("5555555555554444")).toBe(true);
    expect(luhnValid("4111 1111 1111 1112")).toBe(false);
    expect(luhnValid("4111")).toBe(false);
    expect(luhnValid("")).toBe(false);
  });

  it("groups digits in fours and drops anything else", () => {
    expect(formatCardNumber("4111111111111111")).toBe("4111 1111 1111 1111");
    expect(formatCardNumber("4111-1111 11ab")).toBe("4111 1111 11");
    expect(formatCardNumber("41111111111111112222")).toBe("4111 1111 1111 1111 222");
  });

  it("names the card network from its prefix", () => {
    expect(cardBrand("4111")).toBe("Visa");
    expect(cardBrand("5555")).toBe("Mastercard");
    expect(cardBrand("6522")).toBe("RuPay");
    expect(cardBrand("9999")).toBeNull();
  });
});

describe("expiry", () => {
  const now = new Date("2026-10-14T10:00:00+05:30");

  it("formats MM/YY as you type", () => {
    expect(formatExpiry("1")).toBe("1");
    expect(formatExpiry("12")).toBe("12/");
    expect(formatExpiry("1228")).toBe("12/28");
    expect(formatExpiry("12/2")).toBe("12/2");
  });

  it("accepts this month and later, rejects the past and bad months", () => {
    expect(expiryValid("10/26", now)).toBe(true);
    expect(expiryValid("01/30", now)).toBe(true);
    expect(expiryValid("09/26", now)).toBe(false);
    expect(expiryValid("13/27", now)).toBe(false);
    expect(expiryValid("00/27", now)).toBe(false);
    expect(expiryValid("1/27", now)).toBe(false);
  });
});

describe("UPI ids", () => {
  it.each(["success@nestapay", "asha.rao-12@okaxis", "9876543210@upi"])("accepts %s", (id) => {
    expect(upiValid(id)).toBe(true);
  });

  it.each(["success", "@nestapay", "a@b", "has space@upi", "x@1bank"])("rejects %s", (id) => {
    expect(upiValid(id)).toBe(false);
  });
});
