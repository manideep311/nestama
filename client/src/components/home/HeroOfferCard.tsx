import { ArrowRight, Sparkles } from "lucide-react";
import { formatINR, type PromotionDTO } from "@nestama/shared";
import { ButtonLink } from "@/components/ui/Button";
import { PawIcon } from "@/components/ui/icons";
import { OfferCountdown } from "@/components/promo/OfferCountdown";
import { CopyCode } from "@/components/promo/CopyCode";

/** White offer card beside the hero photo: real promotion, live countdown, coupon. */
export function HeroOfferCard({ promotion, freeShippingThreshold }: { promotion: PromotionDTO | null; freeShippingThreshold: number }) {
  if (!promotion) {
    // No live offer: keep the slot useful instead of inventing a deal.
    return (
      <aside
        aria-label="Shopping perks"
        className="relative mx-auto w-full max-w-md rounded-[2rem] bg-white p-6 shadow-lift ring-1 ring-line lg:max-w-none"
      >
        <p className="font-display text-3xl font-extrabold text-forest">New season, new favourites</p>
        <p className="mt-2 text-muted">Free shipping on orders above {formatINR(freeShippingThreshold)}.</p>
        <ButtonLink href="/shop?sort=newest" className="mt-5 w-full">
          See new arrivals <ArrowRight className="size-4" aria-hidden="true" />
        </ButtonLink>
      </aside>
    );
  }

  return (
    <aside
      aria-labelledby="hero-offer-title"
      className="relative mx-auto w-full max-w-md overflow-hidden rounded-[2rem] bg-white p-6 shadow-lift ring-1 ring-line sm:p-7 lg:max-w-none"
    >
      <PawIcon className="absolute -top-3 -right-3 size-20 rotate-12 text-peach" />
      <div className="relative">
        <span className="inline-flex items-center gap-1.5 rounded-full bg-ember px-3 py-1.5 text-[11px] font-extrabold tracking-[0.14em] text-white uppercase">
          <Sparkles className="size-3.5" aria-hidden="true" /> Special offer
        </span>

        <h2 id="hero-offer-title" className="mt-4 leading-none">
          <span className="block text-sm font-extrabold tracking-[0.2em] text-orange-ink uppercase">Up to</span>
          <span className="block font-display text-[3.6rem] font-extrabold tracking-[-0.04em] text-ember">
            {promotion.discountPercent}% off
          </span>
          <span className="sr-only"> — {promotion.name}</span>
        </h2>
        <p className="mt-2 text-[15px] text-charcoal/85">{promotion.subheadline}</p>

        <OfferCountdown endsAt={promotion.endsAt} className="mt-5" />

        {promotion.coupon && (
          <>
            <CopyCode code={promotion.coupon.code} className="mt-4" />
            <p className="mt-1.5 text-xs text-muted">Extra {promotion.coupon.label} at checkout on eligible orders.</p>
          </>
        )}

        <ButtonLink href={promotion.ctaHref} size="lg" className="mt-5 w-full">
          {promotion.ctaLabel} <ArrowRight className="size-5" aria-hidden="true" />
        </ButtonLink>
      </div>
    </aside>
  );
}
