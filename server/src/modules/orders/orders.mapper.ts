import type { AddressSnapshot, OrderDetailDTO, OrderStatusValue, OrderSummaryDTO, PaymentMethodValue } from "@nestama/shared";
import type { Prisma } from "../../generated/prisma/client";

export const orderSummaryInclude = {
  items: { select: { imageUrl: true, quantity: true } },
} satisfies Prisma.OrderInclude;

export const orderDetailInclude = {
  items: { orderBy: { id: "asc" } },
  events: { orderBy: { createdAt: "asc" } },
  payments: { orderBy: { createdAt: "desc" }, take: 1 },
} satisfies Prisma.OrderInclude;

type SummaryRow = Prisma.OrderGetPayload<{ include: typeof orderSummaryInclude }>;
export type OrderDetailRow = Prisma.OrderGetPayload<{ include: typeof orderDetailInclude }>;

export function toOrderSummaryDTO(order: SummaryRow | OrderDetailRow): OrderSummaryDTO {
  return {
    id: order.id,
    number: order.number,
    status: order.status as OrderStatusValue,
    placedAt: order.placedAt.toISOString(),
    total: order.total,
    itemCount: order.items.reduce((n, i) => n + i.quantity, 0),
    previewImages: order.items.slice(0, 3).map((i) => i.imageUrl),
  };
}

export function toOrderDetailDTO(order: OrderDetailRow, now = new Date()): OrderDetailDTO {
  const payment = order.payments[0] ?? null;
  return {
    ...toOrderSummaryDTO(order),
    items: order.items.map((i) => ({
      id: i.id,
      productSlug: i.productSlug,
      productName: i.productName,
      variantLabel: i.variantLabel,
      imageUrl: i.imageUrl,
      unitPrice: i.unitPrice,
      originalUnitPrice: i.originalUnitPrice,
      quantity: i.quantity,
      lineTotal: i.lineTotal,
    })),
    events: order.events.map((e) => ({ status: e.status as OrderStatusValue, note: e.note, createdAt: e.createdAt.toISOString() })),
    shippingAddress: order.shippingAddress as unknown as AddressSnapshot,
    subtotal: order.subtotal,
    promoDiscount: order.promoDiscount,
    couponCode: order.couponCode,
    couponDiscount: order.couponDiscount,
    shipping: order.shipping,
    gstIncluded: order.gstIncluded,
    gstRatePercent: order.gstRatePercent,
    paidAt: order.paidAt?.toISOString() ?? null,
    expiresAt: order.expiresAt?.toISOString() ?? null,
    payment: payment
      ? {
          gatewayOrderId: payment.gatewayOrderId,
          method: (payment.method as PaymentMethodValue | null) ?? null,
          status: payment.status,
          amount: payment.amount,
          failureReason: payment.failureReason,
        }
      : null,
    canPay: order.status === "PENDING_PAYMENT" && payment?.status === "CREATED" && !!order.expiresAt && order.expiresAt > now,
  };
}
