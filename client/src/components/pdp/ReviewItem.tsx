import { BadgeCheck } from "lucide-react";
import type { ReviewDTO } from "@nestama/shared";
import { Rating } from "@/components/ui/Rating";

const dateFmt = new Intl.DateTimeFormat("en-IN", { timeZone: "Asia/Kolkata", day: "numeric", month: "short", year: "numeric" });

export function ReviewItem({ review, own = false }: { review: ReviewDTO; own?: boolean }) {
  return (
    <li className="border-b border-line py-5 last:border-0">
      {own && <p className="mb-2 text-xs font-extrabold tracking-[0.14em] text-orange-ink uppercase">Your review</p>}
      <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
        <Rating value={review.rating} />
        <h3 className="text-base font-bold text-charcoal">{review.title}</h3>
      </div>
      <p className="mt-2 text-[15px] leading-relaxed text-charcoal/90">{review.body}</p>
      <p className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted">
        <span className="font-semibold text-forest">{review.author}</span>
        <time dateTime={review.createdAt}>{dateFmt.format(new Date(review.createdAt))}</time>
        {review.isVerifiedPurchase && (
          <span className="inline-flex items-center gap-1 font-semibold text-forest">
            <BadgeCheck className="size-3.5" aria-hidden="true" /> Verified purchase
          </span>
        )}
        {review.isSample && <span className="rounded bg-cream-deep px-1.5 py-0.5 font-semibold">Sample review</span>}
      </p>
    </li>
  );
}
