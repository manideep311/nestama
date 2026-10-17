import { describe, expect, it } from "vitest";
import { signPayment, verifyPaymentSignature } from "./signature";

const SECRET = "test-secret-that-is-long-enough-123456";

describe("payment signatures", () => {
  it("signs order|payment ids with HMAC-SHA256 (hex)", () => {
    const sig = signPayment("order_abc", "pay_xyz", SECRET);
    expect(sig).toMatch(/^[0-9a-f]{64}$/);
    expect(signPayment("order_abc", "pay_xyz", SECRET)).toBe(sig);
  });

  it("verifies a genuine signature", () => {
    const sig = signPayment("order_abc", "pay_xyz", SECRET);
    expect(verifyPaymentSignature("order_abc", "pay_xyz", sig, SECRET)).toBe(true);
  });

  it("rejects tampering: other ids, other secret, one changed character", () => {
    const sig = signPayment("order_abc", "pay_xyz", SECRET);
    expect(verifyPaymentSignature("order_abd", "pay_xyz", sig, SECRET)).toBe(false);
    expect(verifyPaymentSignature("order_abc", "pay_xyw", sig, SECRET)).toBe(false);
    expect(verifyPaymentSignature("order_abc", "pay_xyz", sig, SECRET + "x")).toBe(false);
    const flipped = (sig[0] === "a" ? "b" : "a") + sig.slice(1);
    expect(verifyPaymentSignature("order_abc", "pay_xyz", flipped, SECRET)).toBe(false);
  });

  it("never throws on malformed input", () => {
    expect(verifyPaymentSignature("order_abc", "pay_xyz", "", SECRET)).toBe(false);
    expect(verifyPaymentSignature("order_abc", "pay_xyz", "zz", SECRET)).toBe(false);
    expect(verifyPaymentSignature("order_abc", "pay_xyz", "ab".repeat(40), SECRET)).toBe(false);
  });

  it("binds the pair with a separator so ids can't be shifted", () => {
    expect(signPayment("order_a", "bpay", SECRET)).not.toBe(signPayment("order_ab", "pay", SECRET));
  });
});
