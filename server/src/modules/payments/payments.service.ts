import type { AuthorizeResultDTO, OrderDetailDTO, PaymentMethodValue } from "@nestama/shared";
import { env } from "../../config/env";
import { prisma } from "../../lib/prisma";
import { AppError } from "../../lib/errors";
import { newGatewayId } from "../../lib/order-number";
import { signPayment, verifyPaymentSignature } from "../../lib/signature";
import { getOrder } from "../account/account.service";
import { closeUnpaidOrder, expireIfStale } from "../orders/order-expiry";

const FAILURE_REASONS: Record<PaymentMethodValue, string> = {
  UPI: "The UPI request was declined (simulated failure).",
  CARD: "The card was declined by the issuing bank (simulated failure).",
  NETBANKING: "The bank couldn't complete the payment (simulated failure).",
};

const METHOD_LABEL: Record<PaymentMethodValue, string> = { UPI: "UPI", CARD: "card", NETBANKING: "netbanking" };

const notFound = () => new AppError("PAYMENT_NOT_FOUND", 404, "We couldn't find that payment.");
const expired = () =>
  new AppError(
    "ORDER_EXPIRED",
    409,
    "This order's payment window has closed and its items were returned to stock. Please check out again.",
  );
const closed = () => new AppError("PAYMENT_CLOSED", 409, "This payment can no longer be completed. Please check out again.");

async function ownedPayment(userId: string, gatewayOrderId: string) {
  const payment = await prisma.payment.findUnique({ where: { gatewayOrderId }, include: { order: { include: { items: true } } } });
  if (!payment || payment.order.userId !== userId) throw notFound();
  return payment;
}

/**
 * Stands in for the gateway's own servers (spec §7 step 3). On success it issues a payment id and
 * the HMAC signature the client hands back for verification; on a simulated failure the order is
 * closed and its stock released immediately. No card/UPI details ever reach this endpoint.
 */
export async function authorizeDemoPayment(
  userId: string,
  input: { gatewayOrderId: string; method: PaymentMethodValue; outcome: "success" | "failure" },
): Promise<AuthorizeResultDTO> {
  const payment = await ownedPayment(userId, input.gatewayOrderId);
  if (await expireIfStale(payment.order)) throw expired();
  if (payment.order.status !== "PENDING_PAYMENT" || payment.status !== "CREATED") throw closed();

  if (input.outcome === "failure") {
    const reason = FAILURE_REASONS[input.method];
    await prisma.$transaction(async (tx) => {
      await tx.payment.update({ where: { id: payment.id }, data: { method: input.method } });
      await closeUnpaidOrder(tx, payment.orderId, "PAYMENT_FAILED", `Payment failed: ${reason}`, reason);
    });
    return { status: "failed", reason };
  }

  const gatewayPaymentId = newGatewayId("pay");
  await prisma.payment.update({ where: { id: payment.id }, data: { method: input.method, gatewayPaymentId } });
  return {
    status: "authorized",
    gatewayPaymentId,
    signature: signPayment(input.gatewayOrderId, gatewayPaymentId, env.DEMO_GATEWAY_SECRET),
  };
}

/**
 * Verifies the gateway signature and settles the order (spec §7 step 4) in one transaction:
 * payment captured, order confirmed, coupon redemption recorded, sold counts updated and the
 * purchased lines removed from the cart. Repeating a successful verify returns the same order.
 */
export async function verifyPayment(
  userId: string,
  input: { orderId: string; gatewayOrderId: string; gatewayPaymentId: string; signature: string },
  now = new Date(),
): Promise<OrderDetailDTO> {
  const payment = await ownedPayment(userId, input.gatewayOrderId);
  if (payment.orderId !== input.orderId) throw notFound();

  const signatureOk =
    verifyPaymentSignature(input.gatewayOrderId, input.gatewayPaymentId, input.signature, env.DEMO_GATEWAY_SECRET) &&
    payment.gatewayPaymentId === input.gatewayPaymentId;
  if (!signatureOk) throw new AppError("SIGNATURE_INVALID", 400, "We couldn't verify this payment. No money has been taken.");

  if (payment.status === "CAPTURED") return getOrder(userId, payment.orderId);
  if (await expireIfStale(payment.order, now)) throw expired();
  if (payment.status !== "CREATED" || payment.order.status !== "PENDING_PAYMENT") throw closed();
  if (payment.amount !== payment.order.total)
    throw new AppError("AMOUNT_MISMATCH", 409, "The payment amount doesn't match the order. Please check out again.");

  const order = payment.order;
  try {
    await settle();
  } catch (err) {
    if (!(err instanceof CouponExhausted)) throw err;
    // Another payment took the coupon's last use first: nothing was captured, so close the order
    // and return its stock rather than leave it waiting for a payment that can't succeed.
    const note = `${order.couponCode} ran out before this payment completed`;
    await prisma.$transaction((tx) => closeUnpaidOrder(tx, order.id, "PAYMENT_FAILED", note, "Coupon limit reached"));
    throw new AppError(
      "COUPON_EXHAUSTED",
      409,
      `${order.couponCode} has just run out, so this order was cancelled before any payment was taken. Please check out again.`,
    );
  }
  return getOrder(userId, order.id);

  async function settle() {
    await prisma.$transaction(async (tx) => {
      const captured = await tx.payment.updateMany({
        where: { id: payment.id, status: "CREATED", gatewayPaymentId: input.gatewayPaymentId },
        data: { status: "CAPTURED" },
      });
      if (captured.count === 0) return; // a concurrent verify already settled it
      const confirmed = await tx.order.updateMany({
        where: { id: order.id, status: "PENDING_PAYMENT" },
        data: { status: "CONFIRMED", paidAt: now, expiresAt: null },
      });
      if (confirmed.count === 0) throw expired(); // rolls the capture back

      const method = (payment.method ?? "UPI") as PaymentMethodValue;
      await tx.orderEvent.create({
        data: { orderId: order.id, status: "CONFIRMED", note: `Payment received via ${METHOD_LABEL[method]}`, createdAt: now },
      });

      if (order.couponCode) {
        const coupon = await tx.coupon.findUnique({ where: { code: order.couponCode }, select: { id: true } });
        if (coupon) {
          // Claim a use only while one is left. Under concurrent payments Postgres re-checks this
          // condition once the row lock is free, so the limit can't be overshot.
          const claimed = await tx.coupon.updateMany({
            where: { id: coupon.id, OR: [{ usageLimit: null }, { usedCount: { lt: prisma.coupon.fields.usageLimit } }] },
            data: { usedCount: { increment: 1 } },
          });
          if (claimed.count === 0) throw new CouponExhausted(); // rolls back the capture
          await tx.couponRedemption.create({ data: { couponId: coupon.id, userId, orderId: order.id } });
        }
      }

      const soldByProduct = new Map<string, number>();
      for (const item of order.items)
        if (item.productId) soldByProduct.set(item.productId, (soldByProduct.get(item.productId) ?? 0) + item.quantity);
      for (const [productId, quantity] of soldByProduct)
        await tx.product.update({ where: { id: productId }, data: { soldCount: { increment: quantity } } });

      const cart = await tx.cart.findUnique({ where: { userId }, select: { id: true } });
      if (cart) {
        const purchased = order.items.map((i) => i.variantId).filter((id): id is string => Boolean(id));
        await tx.cartItem.deleteMany({ where: { cartId: cart.id, variantId: { in: purchased } } });
        await tx.cart.update({ where: { id: cart.id }, data: { couponCode: null } });
      }
    });
  }
}

/** Thrown inside the settle transaction when the coupon has no uses left (rolls the capture back). */
class CouponExhausted extends Error {}
