import { describe, expect, it } from "vitest";
import { canTransition, nextFulfilmentStatus } from "./order-status";

describe("order status transitions", () => {
  it("allows the payment outcomes from PENDING_PAYMENT", () => {
    expect(canTransition("PENDING_PAYMENT", "CONFIRMED")).toBe(true);
    expect(canTransition("PENDING_PAYMENT", "PAYMENT_FAILED")).toBe(true);
    expect(canTransition("PENDING_PAYMENT", "CANCELLED")).toBe(true);
  });

  it("walks fulfilment one step at a time", () => {
    expect(canTransition("CONFIRMED", "PACKED")).toBe(true);
    expect(canTransition("PACKED", "SHIPPED")).toBe(true);
    expect(canTransition("SHIPPED", "OUT_FOR_DELIVERY")).toBe(true);
    expect(canTransition("OUT_FOR_DELIVERY", "DELIVERED")).toBe(true);
    expect(canTransition("CONFIRMED", "DELIVERED")).toBe(false);
  });

  it("lets paid orders be cancelled only before they ship", () => {
    expect(canTransition("CONFIRMED", "CANCELLED")).toBe(true);
    expect(canTransition("PACKED", "CANCELLED")).toBe(true);
    expect(canTransition("SHIPPED", "CANCELLED")).toBe(false);
  });

  it("treats final states as final", () => {
    for (const to of ["CONFIRMED", "PACKED", "CANCELLED"] as const) {
      expect(canTransition("DELIVERED", to)).toBe(false);
      expect(canTransition("CANCELLED", to)).toBe(false);
      expect(canTransition("PAYMENT_FAILED", to)).toBe(false);
    }
  });

  it("names the next fulfilment step", () => {
    expect(nextFulfilmentStatus("CONFIRMED")).toBe("PACKED");
    expect(nextFulfilmentStatus("OUT_FOR_DELIVERY")).toBe("DELIVERED");
    expect(nextFulfilmentStatus("DELIVERED")).toBeNull();
    expect(nextFulfilmentStatus("PENDING_PAYMENT")).toBeNull();
  });
});
