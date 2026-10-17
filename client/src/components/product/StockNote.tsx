import type { StockStatus } from "@nestama/shared";
import { cn } from "@/lib/cn";

/** Short availability line. Silent when stock is healthy, to keep cards calm. */
export function StockNote({ stock, className }: { stock: StockStatus; className?: string }) {
  if (stock === "IN_STOCK") return null;
  return (
    <p className={cn("text-xs font-bold", stock === "LOW_STOCK" ? "text-orange-ink" : "text-muted", className)}>
      {stock === "LOW_STOCK" ? "Only a few left" : "Sold out"}
    </p>
  );
}
