import { cn } from "@/lib/cn";

const STAR = "M10 1.6l2.5 5.3 5.8.7-4.3 4 1.1 5.7L10 14.5l-5.1 2.8 1.1-5.7-4.3-4 5.8-.7z";

/** Five stars with fractional fill. Screen readers get a single sentence. */
export function Rating({
  value,
  count,
  size = "sm",
  className,
}: {
  value: number;
  count?: number;
  size?: "sm" | "md";
  className?: string;
}) {
  const pct = Math.max(0, Math.min(100, (value / 5) * 100));
  const px = size === "sm" ? 14 : 18;
  return (
    <span className={cn("inline-flex items-center gap-1.5", className)}>
      <span className="sr-only">
        Rated {value.toFixed(1)} out of 5{count !== undefined ? ` from ${count.toLocaleString("en-IN")} reviews` : ""}
      </span>
      <span className="relative inline-flex" aria-hidden="true">
        <Stars px={px} className="text-forest/15" />
        <span className="absolute inset-0 overflow-hidden" style={{ width: `${pct}%` }}>
          <Stars px={px} className="text-[#F5A524]" />
        </span>
      </span>
      {count !== undefined && (
        <span aria-hidden="true" className={cn("tabular text-muted", size === "sm" ? "text-xs" : "text-sm")}>
          ({count.toLocaleString("en-IN")})
        </span>
      )}
    </span>
  );
}

function Stars({ px, className }: { px: number; className?: string }) {
  return (
    <span className={cn("flex", className)}>
      {Array.from({ length: 5 }, (_, i) => (
        <svg key={i} viewBox="0 0 20 20" width={px} height={px} fill="currentColor" className="shrink-0">
          <path d={STAR} />
        </svg>
      ))}
    </span>
  );
}
