import { ORDER_PAYMENT_WINDOW_MINUTES, type AddressSnapshot, type CheckoutOrderDTO } from "@nestama/shared";
import { prisma } from "../../lib/prisma";
import { AppError } from "../../lib/errors";
import { newGatewayId, newOrderNumber } from "../../lib/order-number";
import type { Prisma } from "../../generated/prisma/client";
import { loadUserCart, priceCart } from "../cart/cart.service";
import { closeUnpaidOrder } from "../orders/order-expiry";

type Tx = Prisma.TransactionClient;

async function uniqueOrderNumber(tx: Tx): Promise<string> {
  for (let attempt = 0; attempt < 5; attempt++) {
    const number = newOrderNumber();
    if (!(await tx.order.findUnique({ where: { number }, select: { id: true } }))) return number;
  }
  throw new AppError("ORDER_NUMBER_EXHAUSTED", 500, "Couldn't create an order number. Please try again.");
}

/**
 * Turns the signed-in user's cart into an order awaiting payment (spec §7 step 1):
 * re-prices everything on the server, reserves stock with conditional decrements, snapshots the
 * address and lines, and opens a NestaPay demo payment. Older unpaid orders are cancelled first
 * so a shopper never holds two reservations.
 */
export async function createCheckoutOrder(userId: string, addressId: string, now = new Date()): Promise<CheckoutOrderDTO> {
  const address = await prisma.address.findFirst({ where: { id: addressId, userId } });
  if (!address) throw new AppError("ADDRESS_NOT_FOUND", 404, "Choose a delivery address to continue.");

  const cart = await loadUserCart(userId);
  if (!cart || cart.items.length === 0) throw new AppError("CART_EMPTY", 422, "Your cart is empty.");

  const { dto, coupon } = await priceCart(cart, { userId, now });
  if (dto.summary.couponCode && coupon && !coupon.ok) {
    throw new AppError("CART_CHANGED", 409, coupon.message, { couponNotice: coupon.message });
  }
  const unavailable = dto.lines.filter((l) => l.quantity > l.maxQuantity);
  if (unavailable.length > 0) {
    throw new AppError("OUT_OF_STOCK", 409, "Some items in your cart are no longer available in that quantity.", {
      lines: unavailable.map((l) => ({ variantId: l.variantId, name: l.name, available: l.maxQuantity })),
    });
  }

  const snapshot: AddressSnapshot = {
    fullName: address.fullName,
    phone: address.phone,
    line1: address.line1,
    line2: address.line2,
    landmark: address.landmark,
    city: address.city,
    state: address.state,
    pincode: address.pincode,
  };
  const { summary } = dto;
  const couponApplied = Boolean(coupon?.ok && summary.couponDiscount > 0);

  return prisma.$transaction(async (tx) => {
    const pending = await tx.order.findMany({ where: { userId, status: "PENDING_PAYMENT" }, select: { id: true } });
    for (const p of pending) await closeUnpaidOrder(tx, p.id, "CANCELLED", "Replaced by a newer checkout");

    const short: { variantId: string; name: string }[] = [];
    for (const line of dto.lines) {
      const { count } = await tx.productVariant.updateMany({
        where: { id: line.variantId, stock: { gte: line.quantity }, product: { isActive: true } },
        data: { stock: { decrement: line.quantity } },
      });
      if (count === 0) short.push({ variantId: line.variantId, name: line.name });
    }
    if (short.length > 0) {
      // Throwing rolls back every reservation (and the cancellations above).
      throw new AppError("OUT_OF_STOCK", 409, "Some items just sold out. Please review your cart.", { lines: short });
    }

    const order = await tx.order.create({
      data: {
        number: await uniqueOrderNumber(tx),
        userId,
        shippingAddress: snapshot as unknown as Prisma.InputJsonValue,
        subtotal: summary.subtotal,
        promoDiscount: summary.promoSavings,
        couponCode: couponApplied ? summary.couponCode : null,
        couponDiscount: couponApplied ? summary.couponDiscount : 0,
        shipping: summary.shipping,
        total: summary.total,
        gstIncluded: summary.gstIncluded,
        gstRatePercent: summary.gstRatePercent,
        placedAt: now,
        expiresAt: new Date(now.getTime() + ORDER_PAYMENT_WINDOW_MINUTES * 60_000),
        items: {
          create: dto.lines.map((l) => ({
            productId: l.productId,
            variantId: l.variantId,
            productName: l.name,
            productSlug: l.slug,
            variantLabel: l.variantLabel,
            imageUrl: l.image.url,
            unitPrice: l.unitPrice,
            originalUnitPrice: l.originalUnitPrice,
            quantity: l.quantity,
            lineTotal: l.lineTotal,
          })),
        },
        events: { create: { status: "PENDING_PAYMENT", note: "Order placed — awaiting payment", createdAt: now } },
      },
      select: { id: true, number: true, total: true },
    });

    const gatewayOrderId = newGatewayId("order");
    await tx.payment.create({ data: { orderId: order.id, gatewayOrderId, amount: order.total } });
    return { orderId: order.id, orderNumber: order.number, gatewayOrderId, amount: order.total };
  });
}
