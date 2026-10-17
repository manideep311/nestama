import { Star } from "lucide-react";
import type { ReviewListDTO } from "@nestama/shared";
import { Rating } from "@/components/ui/Rating";
import { MoreReviews } from "./MoreReviews";
import { ReviewList, WriteReview } from "./WriteReview";

/** Ratings summary + first page of reviews (server-rendered); more pages load on demand. */
export function Reviews({ slug, data }: { slug: string; data: ReviewListDTO }) {
  const { summary } = data;
  const max = Math.max(1, ...Object.values(summary.distribution));
  return (
    <section id="reviews" aria-labelledby="reviews-title" className="scroll-mt-40">
      <h2 id="reviews-title" className="text-3xl font-extrabold">
        Ratings &amp; reviews
      </h2>
      <div className="mt-6 grid gap-8 lg:grid-cols-[18rem_1fr]">
        <div className="rounded-3xl bg-white p-6 ring-1 ring-line">
          <p className="font-display text-5xl font-extrabold text-forest tabular-nums">{summary.average.toFixed(1)}</p>
          <Rating value={summary.average} size="md" className="mt-2" />
          <p className="mt-1 text-sm text-muted">Based on {summary.count.toLocaleString("en-IN")} ratings</p>
          <ul className="mt-5 space-y-2" aria-label="Rating breakdown">
            {([5, 4, 3, 2, 1] as const).map((stars) => {
              const n = summary.distribution[stars];
              return (
                <li key={stars} className="flex items-center gap-2 text-sm">
                  <span className="inline-flex w-7 items-center gap-0.5 font-semibold text-forest tabular-nums">
                    {stars}
                    <Star className="size-3 fill-[#F5A524] text-[#F5A524]" aria-hidden="true" />
                  </span>
                  <span className="h-2 flex-1 overflow-hidden rounded-full bg-sage" aria-hidden="true">
                    <span className="block h-full rounded-full bg-[#F5A524]" style={{ width: `${(n / max) * 100}%` }} />
                  </span>
                  <span className="w-10 text-right text-xs text-muted tabular-nums">
                    {n.toLocaleString("en-IN")}
                    <span className="sr-only"> ratings with {stars} stars</span>
                  </span>
                </li>
              );
            })}
          </ul>
          <WriteReview slug={slug} />
        </div>

        <div>
          <ReviewList slug={slug} items={data.items}>
            <MoreReviews slug={slug} totalPages={data.totalPages} />
          </ReviewList>
        </div>
      </div>
    </section>
  );
}
