import { describe, expect, it } from "vitest";
import { addressInputSchema, INDIAN_STATES, profileUpdateSchema, reviewInputSchema, wishlistSyncSchema } from "./account";
import { authorizePaymentSchema, checkoutSchema, isPaid, verifyPaymentSchema } from "./orders";

const address = {
  fullName: "Asha Rao",
  phone: "9876543210",
  line1: "12 Lake View Road",
  city: "Hyderabad",
  state: "Telangana",
  pincode: "500081",
};

describe("addressInputSchema", () => {
  it("accepts a valid Indian address and trims fields", () => {
    const parsed = addressInputSchema.parse({ ...address, fullName: "  Asha Rao  ", line2: "  " });
    expect(parsed.fullName).toBe("Asha Rao");
    expect(parsed.line2).toBeUndefined();
    expect(parsed.isDefault).toBe(false);
  });

  it.each(["987654321", "5876543210", "98765432101", "98765 43210x"])("rejects phone %s", (phone) => {
    expect(addressInputSchema.safeParse({ ...address, phone }).success).toBe(false);
  });

  it("accepts a phone with spaces or a +91 prefix, normalised to 10 digits", () => {
    expect(addressInputSchema.parse({ ...address, phone: "+91 98765 43210" }).phone).toBe("9876543210");
  });

  it.each(["050008", "50008", "5000811", "50A081"])("rejects pincode %s", (pincode) => {
    expect(addressInputSchema.safeParse({ ...address, pincode }).success).toBe(false);
  });

  it("rejects an unknown state", () => {
    expect(addressInputSchema.safeParse({ ...address, state: "Atlantis" }).success).toBe(false);
  });

  it("lists all 36 states and union territories", () => {
    expect(INDIAN_STATES).toHaveLength(36);
    expect(new Set(INDIAN_STATES).size).toBe(36);
  });
});

describe("profile, review and wishlist schemas", () => {
  it("validates a profile update with an optional phone", () => {
    expect(profileUpdateSchema.parse({ name: " Asha " })).toEqual({ name: "Asha" });
    expect(profileUpdateSchema.safeParse({ name: "A" }).success).toBe(false);
  });

  it("requires an integer rating 1–5 and a meaningful body", () => {
    expect(reviewInputSchema.safeParse({ rating: 5, title: "Great", body: "Lovely harness, fits well." }).success).toBe(true);
    expect(reviewInputSchema.safeParse({ rating: 4.5, title: "Great", body: "Lovely harness, fits well." }).success).toBe(false);
    expect(reviewInputSchema.safeParse({ rating: 6, title: "Great", body: "Lovely harness, fits well." }).success).toBe(false);
    expect(reviewInputSchema.safeParse({ rating: 5, title: "Great", body: "Short" }).success).toBe(false);
  });

  it("caps wishlist sync at 200 ids and de-duplicates", () => {
    expect(wishlistSyncSchema.parse({ productIds: ["a", "b", "a"] }).productIds).toEqual(["a", "b"]);
    expect(wishlistSyncSchema.safeParse({ productIds: Array.from({ length: 201 }, (_, i) => `p${i}`) }).success).toBe(false);
  });
});

describe("checkout and payment schemas", () => {
  it("rejects unknown fields so card data can never ride along", () => {
    expect(checkoutSchema.safeParse({ addressId: "a1" }).success).toBe(true);
    expect(authorizePaymentSchema.safeParse({ gatewayOrderId: "order_x", method: "CARD", outcome: "success" }).success).toBe(true);
    expect(
      authorizePaymentSchema.safeParse({ gatewayOrderId: "order_x", method: "CARD", outcome: "success", cardNumber: "4111" }).success,
    ).toBe(false);
    expect(authorizePaymentSchema.safeParse({ gatewayOrderId: "order_x", method: "CASH", outcome: "success" }).success).toBe(false);
  });

  it("requires every verify field", () => {
    const ok = { orderId: "o1", gatewayOrderId: "order_x", gatewayPaymentId: "pay_y", signature: "ab12" };
    expect(verifyPaymentSchema.safeParse(ok).success).toBe(true);
    expect(verifyPaymentSchema.safeParse({ ...ok, signature: "" }).success).toBe(false);
  });

  it("treats confirmed and later statuses as paid", () => {
    expect(isPaid("CONFIRMED")).toBe(true);
    expect(isPaid("DELIVERED")).toBe(true);
    expect(isPaid("PENDING_PAYMENT")).toBe(false);
    expect(isPaid("PAYMENT_FAILED")).toBe(false);
    expect(isPaid("CANCELLED")).toBe(false);
  });
});
