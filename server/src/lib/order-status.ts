import type { OrderStatusValue } from "@nestama/shared";

const FULFILMENT: OrderStatusValue[] = ["CONFIRMED", "PACKED", "SHIPPED", "OUT_FOR_DELIVERY", "DELIVERED"];

const ALLOWED: Record<OrderStatusValue, OrderStatusValue[]> = {
  PENDING_PAYMENT: ["CONFIRMED", "PAYMENT_FAILED", "CANCELLED"],
  CONFIRMED: ["PACKED", "CANCELLED"],
  PACKED: ["SHIPPED", "CANCELLED"],
  SHIPPED: ["OUT_FOR_DELIVERY"],
  OUT_FOR_DELIVERY: ["DELIVERED"],
  DELIVERED: [],
  PAYMENT_FAILED: [],
  CANCELLED: [],
};

/** Whether an order may move from one status to another (payment outcomes and fulfilment). */
export function canTransition(from: OrderStatusValue, to: OrderStatusValue): boolean {
  return ALLOWED[from].includes(to);
}

/** The next fulfilment step for a paid order, or null when there is none. */
export function nextFulfilmentStatus(status: OrderStatusValue): OrderStatusValue | null {
  const i = FULFILMENT.indexOf(status);
  return i >= 0 && i < FULFILMENT.length - 1 ? FULFILMENT[i + 1]! : null;
}
