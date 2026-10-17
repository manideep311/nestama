import Image from "next/image";
import Link from "next/link";
import { ChevronRight } from "lucide-react";
import { formatINR, type OrderSummaryDTO } from "@nestama/shared";
import { StatusChip } from "@/components/orders/StatusChip";
import { formatDate } from "@/lib/format";

/** One order in a list: number, date, status, a few product thumbnails and the total. */
export function OrderCard({ order }: { order: OrderSummaryDTO }) {
  return (
    <Link
      href={`/orders/${order.id}`}
      className="group flex items-center gap-4 rounded-3xl bg-white p-4 shadow-card ring-1 ring-line transition-shadow hover:shadow-lift sm:p-5"
    >
      <div className="flex shrink-0 -space-x-3">
        {order.previewImages.map((src, i) => (
          <span key={`${src}-${i}`} className="relative size-14 overflow-hidden rounded-2xl bg-cream-deep ring-4 ring-white">
            {src && <Image src={src} alt="" fill sizes="56px" className="object-cover" />}
          </span>
        ))}
      </div>
      <div className="min-w-0 flex-1">
        <p className="flex flex-wrap items-center gap-x-3 gap-y-1">
          <span className="font-extrabold text-charcoal">{order.number}</span>
          <StatusChip status={order.status} />
        </p>
        <p className="mt-1 text-sm text-muted">
          {formatDate(order.placedAt)} · {order.itemCount} {order.itemCount === 1 ? "item" : "items"}
        </p>
      </div>
      <p className="text-right font-extrabold text-charcoal tabular-nums">{formatINR(order.total)}</p>
      <ChevronRight className="size-5 shrink-0 text-forest/40 transition-transform group-hover:translate-x-0.5" aria-hidden="true" />
    </Link>
  );
}

export function OrderCardSkeleton() {
  return <div className="h-[5.75rem] skeleton rounded-3xl" aria-hidden="true" />;
}
