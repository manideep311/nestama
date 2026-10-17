"use client";

import { useState } from "react";
import { Loader2 } from "lucide-react";
import type { ReviewDTO, ReviewListDTO } from "@nestama/shared";
import { apiFetch } from "@/lib/cart-client";
import { ReviewItem } from "./ReviewItem";

/** "Show more reviews" — appends further pages under the server-rendered first page. */
export function MoreReviews({ slug, totalPages }: { slug: string; totalPages: number }) {
  const [page, setPage] = useState(1);
  const [items, setItems] = useState<ReviewDTO[]>([]);
  const [state, setState] = useState<"idle" | "loading" | "error">("idle");

  if (totalPages <= 1) return null;

  async function loadMore() {
    setState("loading");
    try {
      const next = await apiFetch<ReviewListDTO>(`/products/${encodeURIComponent(slug)}/reviews?page=${page + 1}`);
      setItems((list) => [...list, ...next.items]);
      setPage(next.page);
      setState("idle");
    } catch {
      setState("error");
    }
  }

  return (
    <>
      {items.map((r) => (
        <ReviewItem key={r.id} review={r} />
      ))}
      {page < totalPages && (
        <li className="py-5 text-center">
          <button
            type="button"
            onClick={loadMore}
            disabled={state === "loading"}
            className="inline-flex h-11 items-center gap-2 rounded-full border-2 border-forest/80 px-5 text-sm font-bold text-forest hover:bg-forest hover:text-cream disabled:opacity-60"
          >
            {state === "loading" && <Loader2 className="size-4 animate-spin" aria-hidden="true" />}
            Show more reviews
          </button>
          {state === "error" && <p className="mt-2 text-sm text-orange-ink">Couldn&apos;t load more reviews. Try again.</p>}
        </li>
      )}
    </>
  );
}
