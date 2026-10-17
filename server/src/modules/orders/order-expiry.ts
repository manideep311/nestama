import { prisma } from "../../lib/prisma";
import type { Prisma } from "../../generated/prisma/client";

type Tx = Prisma.TransactionClient;

/**
 * Closes an unpaid order and returns its reserved stock. The status change is conditional
 * (only from PENDING_PAYMENT), so stock is released at most once even under concurrent calls.
 * Returns false when the order was no longer awaiting payment.
 */
export async function closeUnpaidOrder(
  tx: Tx,
  orderId: string,
  status: "CANCELLED" | "PAYMENT_FAILED",
  note: string,
  failureReason = note,
): Promise<boolean> {
  const { count } = await tx.order.updateMany({ where: { id: orderId, status: "PENDING_PAYMENT" }, data: { status, expiresAt: null } });
  if (count === 0) return false;

  const items = await tx.orderItem.findMany({ where: { orderId }, select: { variantId: true, quantity: true } });
  for (const item of items) {
    if (item.variantId) await tx.productVariant.update({ where: { id: item.variantId }, data: { stock: { increment: item.quantity } } });
  }
  await tx.payment.updateMany({ where: { orderId, status: "CREATED" }, data: { status: "FAILED", failureReason } });
  await tx.orderEvent.create({ data: { orderId, status, note } });
  return true;
}

const EXPIRED_NOTE = "Payment window expired — items returned to stock";

/** Cancels unpaid orders whose 30-minute window has passed. Returns how many were closed. */
export async function expireStaleOrders(now = new Date()): Promise<number> {
  const stale = await prisma.order.findMany({
    where: { status: "PENDING_PAYMENT", expiresAt: { lt: now } },
    select: { id: true },
    take: 200,
  });
  let closed = 0;
  for (const { id } of stale) {
    if (await prisma.$transaction((tx) => closeUnpaidOrder(tx, id, "CANCELLED", EXPIRED_NOTE, "EXPIRED"))) closed++;
  }
  return closed;
}

/** Lazy check used when an order is read or paid: closes it if its window has passed. */
export async function expireIfStale(order: { id: string; status: string; expiresAt: Date | null }, now = new Date()): Promise<boolean> {
  if (order.status !== "PENDING_PAYMENT" || !order.expiresAt || order.expiresAt > now) return false;
  return prisma.$transaction((tx) => closeUnpaidOrder(tx, order.id, "CANCELLED", EXPIRED_NOTE, "EXPIRED"));
}
