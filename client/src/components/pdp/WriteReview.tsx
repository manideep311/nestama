"use client";

import { useState } from "react";
import dynamic from "next/dynamic";
import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import { PenLine } from "lucide-react";
import type { ReviewDTO } from "@nestama/shared";
import { useSession } from "@/lib/auth-client";
import { apiFetch } from "@/lib/cart-client";
import { Button } from "@/components/ui/Button";
import { Modal } from "@/components/ui/Modal";
import { ReviewItem } from "./ReviewItem";
import { myReviewKey } from "./review-query";

const ReviewForm = dynamic(() => import("./ReviewForm").then((m) => m.ReviewForm), {
  loading: () => <div className="h-80 skeleton rounded-2xl" aria-busy="true" />,
});

/** The signed-in shopper's review of this product, if any. */
export function useMyReview(slug: string) {
  const { data: session } = useSession();
  return useQuery({
    queryKey: myReviewKey(slug),
    queryFn: async () => (await apiFetch<{ review: ReviewDTO | null }>(`/products/${encodeURIComponent(slug)}/reviews/mine`)).review,
    enabled: Boolean(session),
  });
}

/** "Write a review" for signed-in shoppers, a sign-in prompt for guests. */
export function WriteReview({ slug }: { slug: string }) {
  const { data: session, isPending } = useSession();
  const mine = useMyReview(slug);
  const [open, setOpen] = useState(false);

  if (isPending) return <div className="mt-5 h-11" aria-hidden="true" />;

  if (!session) {
    return (
      <p className="mt-5 text-sm text-muted">
        <Link
          href={`/login?next=${encodeURIComponent(`/products/${slug}#reviews`)}`}
          className="font-bold text-forest underline-offset-4 hover:underline"
        >
          Sign in
        </Link>{" "}
        to write a review.
      </p>
    );
  }

  const existing = mine.data ?? null;
  return (
    <>
      <Button variant="forest" className="mt-5 w-full" onClick={() => setOpen(true)} disabled={mine.isPending}>
        <PenLine className="size-4" aria-hidden="true" /> {existing ? "Edit your review" : "Write a review"}
      </Button>
      <Modal open={open} onClose={() => setOpen(false)} title={existing ? "Edit your review" : "Write a review"}>
        <ReviewForm slug={slug} existing={existing} onDone={() => setOpen(false)} />
      </Modal>
    </>
  );
}

/**
 * The server-rendered first page, with the shopper's own review pinned on top (labelled) and not
 * repeated further down.
 */
export function ReviewList({ slug, items, children }: { slug: string; items: ReviewDTO[]; children?: React.ReactNode }) {
  const mine = useMyReview(slug);
  const own = mine.data ?? null;
  const rest = own ? items.filter((r) => r.id !== own.id) : items;

  if (!own && rest.length === 0) return <p className="rounded-3xl bg-white p-6 text-muted ring-1 ring-line">No written reviews yet.</p>;

  return (
    <ul className="rounded-3xl bg-white px-6 ring-1 ring-line">
      {own && <ReviewItem review={own} own />}
      {rest.map((r) => (
        <ReviewItem key={r.id} review={r} />
      ))}
      {children}
    </ul>
  );
}
