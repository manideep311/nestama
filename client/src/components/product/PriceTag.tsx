import { formatINR, type PriceDTO } from "@nestama/shared";
import { cn } from "@/lib/cn";

/** Sale price, struck reference price and (optionally) the discount chip. One sentence for screen readers. */
export function PriceTag({
  pricing,
  size = "md",
  showBadge = false,
  className,
}: {
  pricing: PriceDTO;
  size?: "sm" | "md" | "lg";
  showBadge?: boolean;
  className?: string;
}) {
  const { salePrice, referencePrice, discountPercent } = pricing;
  const spoken = `Price ${formatINR(salePrice)}${referencePrice ? `, was ${formatINR(referencePrice)}, ${discountPercent}% off` : ""}`;

  return (
    <p className={cn("flex flex-wrap items-baseline gap-x-2 gap-y-0.5", className)}>
      <span className="sr-only">{spoken}</span>
      <span
        aria-hidden="true"
        className={cn(
          "tabular font-extrabold tracking-tight text-charcoal",
          size === "sm" && "text-base",
          size === "md" && "text-lg",
          size === "lg" && "font-display text-3xl text-forest",
        )}
      >
        {formatINR(salePrice)}
      </span>
      {referencePrice !== null && (
        <span aria-hidden="true" className={cn("tabular text-muted line-through", size === "lg" ? "text-lg" : "text-sm")}>
          {formatINR(referencePrice)}
        </span>
      )}
      {showBadge && discountPercent > 0 && (
        <span aria-hidden="true" className="rounded-md bg-peach px-1.5 py-0.5 text-xs font-extrabold text-orange-ink">
          {discountPercent}% OFF
        </span>
      )}
    </p>
  );
}
