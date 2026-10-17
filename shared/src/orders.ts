import { z } from "./zod";
import type { AddressSnapshot } from "./account";

export const ORDER_STATUSES = [
  "PENDING_PAYMENT",
  "PAYMENT_FAILED",
  "CONFIRMED",
  "PACKED",
  "SHIPPED",
  "OUT_FOR_DELIVERY",
  "DELIVERED",
  "CANCELLED",
] as const;
export type OrderStatusValue = (typeof ORDER_STATUSES)[number];

/** Statuses that mean the order has been paid for. */
export const PAID_STATUSES: readonly OrderStatusValue[] = ["CONFIRMED", "PACKED", "SHIPPED", "OUT_FOR_DELIVERY", "DELIVERED"];

export function isPaid(status: OrderStatusValue): boolean {
  return PAID_STATUSES.includes(status);
}

/** The fulfilment journey shown on the tracking timeline, in order. */
export const ORDER_TRACK_STEPS: readonly OrderStatusValue[] = [
  "PENDING_PAYMENT",
  "CONFIRMED",
  "PACKED",
  "SHIPPED",
  "OUT_FOR_DELIVERY",
  "DELIVERED",
];

export const ORDER_STATUS_LABEL: Record<OrderStatusValue, string> = {
  PENDING_PAYMENT: "Order placed",
  PAYMENT_FAILED: "Payment failed",
  CONFIRMED: "Confirmed",
  PACKED: "Packed",
  SHIPPED: "Shipped",
  OUT_FOR_DELIVERY: "Out for delivery",
  DELIVERED: "Delivered",
  CANCELLED: "Cancelled",
};

export const PAYMENT_METHODS = ["UPI", "CARD", "NETBANKING"] as const;
export type PaymentMethodValue = (typeof PAYMENT_METHODS)[number];
export type PaymentStatusValue = "CREATED" | "CAPTURED" | "FAILED";

/** Minutes an unpaid order holds its stock. */
export const ORDER_PAYMENT_WINDOW_MINUTES = 30;

// Strict objects: anything extra (card numbers, UPI ids…) is rejected, never stored.
export const checkoutSchema = z.strictObject({ addressId: z.string().min(1).max(40) });

export const authorizePaymentSchema = z.strictObject({
  gatewayOrderId: z.string().min(1).max(64),
  method: z.enum(PAYMENT_METHODS),
  outcome: z.enum(["success", "failure"]),
});
export type AuthorizePaymentInput = z.input<typeof authorizePaymentSchema>;

export const verifyPaymentSchema = z.strictObject({
  orderId: z.string().min(1).max(40),
  gatewayOrderId: z.string().min(1).max(64),
  gatewayPaymentId: z.string().min(1).max(64),
  signature: z.string().min(1).max(128),
});
export type VerifyPaymentInput = z.input<typeof verifyPaymentSchema>;

export interface CheckoutOrderDTO {
  orderId: string;
  orderNumber: string;
  gatewayOrderId: string;
  amount: number;
}

export type AuthorizeResultDTO =
  { status: "authorized"; gatewayPaymentId: string; signature: string } | { status: "failed"; reason: string };

export interface OrderLineDTO {
  id: string;
  productSlug: string;
  productName: string;
  variantLabel: string;
  imageUrl: string;
  unitPrice: number;
  originalUnitPrice: number;
  quantity: number;
  lineTotal: number;
}

export interface OrderEventDTO {
  status: OrderStatusValue;
  note: string | null;
  createdAt: string;
}

export interface OrderSummaryDTO {
  id: string;
  number: string;
  status: OrderStatusValue;
  placedAt: string;
  total: number;
  itemCount: number;
  previewImages: string[];
}

export interface OrderPaymentDTO {
  gatewayOrderId: string;
  method: PaymentMethodValue | null;
  status: PaymentStatusValue;
  amount: number;
  failureReason: string | null;
}

export interface OrderDetailDTO extends OrderSummaryDTO {
  items: OrderLineDTO[];
  events: OrderEventDTO[];
  shippingAddress: AddressSnapshot;
  subtotal: number;
  promoDiscount: number;
  couponCode: string | null;
  couponDiscount: number;
  shipping: number;
  gstIncluded: number;
  gstRatePercent: number;
  paidAt: string | null;
  expiresAt: string | null;
  payment: OrderPaymentDTO | null;
  /** True while the order still awaits payment and can be paid. */
  canPay: boolean;
}
