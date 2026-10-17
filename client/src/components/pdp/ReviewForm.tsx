"use client";

import { useState, type FormEvent } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Loader2 } from "lucide-react";
import { firstFieldErrors, reviewInputSchema, type ReviewDTO } from "@nestama/shared";
import { apiFetch, ApiRequestError } from "@/lib/cart-client";
import { useToast } from "@/components/toast/ToastProvider";
import { Button } from "@/components/ui/Button";
import { FormAlert, TextField } from "@/components/ui/Field";
import { StarInput } from "./StarInput";
import { myReviewKey } from "./review-query";

// Loaded only when the review dialog opens (see WriteReview), so its validation schema — and Zod with
// it — stays out of the product page's initial JavaScript.
export function ReviewForm({ slug, existing, onDone }: { slug: string; existing: ReviewDTO | null; onDone: () => void }) {
  const qc = useQueryClient();
  const { show } = useToast();
  const [rating, setRating] = useState(existing?.rating ?? 0);
  const [title, setTitle] = useState(existing?.title ?? "");
  const [body, setBody] = useState(existing?.body ?? "");
  const [errors, setErrors] = useState<Record<string, string | undefined>>({});
  const save = useMutation({
    mutationFn: (input: { rating: number; title: string; body: string }) =>
      apiFetch<ReviewDTO>(`/products/${encodeURIComponent(slug)}/reviews`, { method: "POST", body: JSON.stringify(input) }),
    onSuccess: (review) => {
      qc.setQueryData(myReviewKey(slug), review);
      show({ title: existing ? "Review updated" : "Thanks! Your review is live", icon: "check", duration: 3000 });
      onDone();
    },
  });

  function onSubmit(e: FormEvent) {
    e.preventDefault();
    const parsed = reviewInputSchema.safeParse({ rating, title, body });
    if (!parsed.success) {
      setErrors(firstFieldErrors(parsed.error));
      return;
    }
    setErrors({});
    save.mutate(parsed.data);
  }

  return (
    <form onSubmit={onSubmit} noValidate className="space-y-4">
      {save.isError && (
        <FormAlert>
          {save.error instanceof ApiRequestError ? save.error.message : "We couldn't post your review. Please try again."}
        </FormAlert>
      )}
      <StarInput value={rating} onChange={setRating} error={errors.rating} />
      <TextField
        label="Headline"
        value={title}
        onChange={(e) => setTitle(e.target.value)}
        maxLength={80}
        error={errors.title}
        placeholder="Sum it up in a few words"
      />
      <div>
        <label htmlFor="review-body" className="mb-1.5 block text-sm font-bold text-forest">
          Your review
        </label>
        <textarea
          id="review-body"
          value={body}
          onChange={(e) => setBody(e.target.value)}
          maxLength={1000}
          rows={5}
          aria-invalid={errors.body ? true : undefined}
          aria-describedby="review-body-help"
          placeholder="How did your pet get on with it? Fit, quality, anything other pet parents should know."
          className="w-full rounded-xl border border-line bg-white px-4 py-3 text-[15px] text-charcoal outline-none placeholder:text-muted/70 focus:border-forest/50 focus:shadow-[0_0_0_4px_rgb(18_61_47/0.08)] aria-[invalid=true]:border-ember"
        />
        <p id="review-body-help" className="mt-1.5 flex justify-between gap-3 text-xs">
          <span className={errors.body ? "text-sm font-semibold text-orange-ink" : "text-muted"}>
            {errors.body ?? "At least 10 characters."}
          </span>
          <span className="text-muted tabular-nums">{body.length}/1000</span>
        </p>
      </div>
      <Button type="submit" size="lg" disabled={save.isPending} aria-busy={save.isPending || undefined}>
        {save.isPending && <Loader2 className="size-5 animate-spin" aria-hidden="true" />}
        {existing ? "Update review" : "Post review"}
      </Button>
    </form>
  );
}
