import type { OrderStatusValue } from "@nestama/shared";
import { cn } from "@/lib/cn";

const CHIP: Record<OrderStatusValue, { label: string; tone: string }> = {
  PENDING_PAYMENT: { label: "Awaiting payment", tone: "bg-peach text-orange-ink" },
  CONFIRMED: { label: "Confirmed", tone: "bg-sage text-forest" },
  PACKED: { label: "Packed", tone: "bg-sage text-forest" },
  SHIPPED: { label: "Shipped", tone: "bg-sage text-forest" },
  OUT_FOR_DELIVERY: { label: "Out for delivery", tone: "bg-sage text-forest" },
  DELIVERED: { label: "Delivered", tone: "bg-forest text-cream" },
  PAYMENT_FAILED: { label: "Payment failed", tone: "bg-charcoal/8 text-charcoal/75" },
  CANCELLED: { label: "Cancelled", tone: "bg-charcoal/8 text-charcoal/75" },
};

export function StatusChip({ status, className }: { status: OrderStatusValue; className?: string }) {
  const chip = CHIP[status];
  return (
    <span className={cn("inline-flex items-center rounded-full px-3 py-1 text-xs font-extrabold tracking-wide", chip.tone, className)}>
      {chip.label}
    </span>
  );
}
