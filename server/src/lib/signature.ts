import { createHmac, timingSafeEqual } from "node:crypto";

/** NestaPay demo signature, mirroring Razorpay: HMAC-SHA256 over `gatewayOrderId|gatewayPaymentId`, hex. */
export function signPayment(gatewayOrderId: string, gatewayPaymentId: string, secret: string): string {
  return createHmac("sha256", secret).update(`${gatewayOrderId}|${gatewayPaymentId}`).digest("hex");
}

/** Constant-time check; false (never a throw) for malformed or wrong-length signatures. */
export function verifyPaymentSignature(gatewayOrderId: string, gatewayPaymentId: string, signature: string, secret: string): boolean {
  if (!/^[0-9a-f]{64}$/i.test(signature)) return false;
  const expected = Buffer.from(signPayment(gatewayOrderId, gatewayPaymentId, secret), "hex");
  const given = Buffer.from(signature, "hex");
  return given.length === expected.length && timingSafeEqual(given, expected);
}
