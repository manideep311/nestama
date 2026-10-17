import { describe, expect, it } from "vitest";
import { newGatewayId, newOrderNumber, ORDER_NUMBER_ALPHABET } from "./order-number";

describe("order numbers", () => {
  it("formats NST- plus 6 unambiguous characters", () => {
    for (let i = 0; i < 200; i++) {
      const n = newOrderNumber();
      expect(n).toMatch(/^NST-[0-9A-Z]{6}$/);
      expect(n.slice(4)).not.toMatch(/[01OI]/);
    }
  });

  it("uses the injected random source", () => {
    expect(newOrderNumber(() => 0)).toBe(`NST-${ORDER_NUMBER_ALPHABET[0]!.repeat(6)}`);
    expect(newOrderNumber(() => 0.999999)).toBe(`NST-${ORDER_NUMBER_ALPHABET.at(-1)!.repeat(6)}`);
  });

  it("makes prefixed gateway ids", () => {
    expect(newGatewayId("order")).toMatch(/^order_[0-9A-Za-z]{16}$/);
    expect(newGatewayId("pay")).toMatch(/^pay_[0-9A-Za-z]{16}$/);
    expect(newGatewayId("pay")).not.toBe(newGatewayId("pay"));
  });
});
