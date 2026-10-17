import { Suspense } from "react";
import type { Metadata } from "next";
import { Flame } from "lucide-react";
import { getActivePromotions } from "@/lib/catalog";
import { PageTransition } from "@/components/layout/PageTransition";
import { ListingResults } from "@/components/listing/ListingResults";
import { ListingSkeleton } from "@/components/listing/ListingSkeleton";
import { Breadcrumbs } from "@/components/ui/Breadcrumbs";
import { OfferCountdown } from "@/components/promo/OfferCountdown";
import { CopyCode } from "@/components/promo/CopyCode";
import { WaggingDogMascot } from "@/components/animations/WaggingDogMascot";

export const metadata: Metadata = {
  title: "Offers & deals",
  description: "Live NESTAMA deals on toys, beds, grooming, wellness and more — with real end dates.",
};

async function DealBanner() {
  const promotions = await getActivePromotions().catch(() => []);
  const deal = promotions.find((p) => p.placement === "COUNTDOWN_BANNER");
  if (!deal) return null;
  return (
    <section
      aria-labelledby="deal-title"
      className="relative mb-10 overflow-hidden rounded-[2rem] bg-[linear-gradient(120deg,#ff7a4d_0%,#ffb58f_55%,#ffe3d2_100%)] px-6 py-8 sm:px-10"
    >
      <div className="grid items-center gap-6 md:grid-cols-[1fr_auto]">
        <div>
          <p className="inline-flex items-center gap-1.5 rounded-full bg-white/90 px-3 py-1 text-xs font-extrabold tracking-[0.14em] text-orange-ink uppercase">
            <Flame className="size-3.5" aria-hidden="true" /> Limited time
          </p>
          <h1 id="deal-title" className="mt-3 text-4xl font-extrabold text-forest sm:text-5xl">
            {deal.name}: up to {deal.discountPercent}% off
          </h1>
          <p className="mt-2 max-w-xl text-forest/85">{deal.subheadline}</p>
          {deal.coupon && <CopyCode code={deal.coupon.code} className="mt-5 max-w-sm bg-white/80" />}
        </div>
        <div className="flex items-end gap-4">
          <div className="w-72 rounded-3xl bg-white/85 p-4 shadow-card">
            <p className="mb-2 text-xs font-bold tracking-wider text-forest uppercase">Ends in</p>
            <OfferCountdown endsAt={deal.endsAt} />
          </div>
          <WaggingDogMascot play={0} size="md" className="hidden lg:block" />
        </div>
      </div>
    </section>
  );
}

export default function OffersPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  return (
    <PageTransition>
      <div className="container-page pt-6 pb-4 md:pt-8">
        <Breadcrumbs items={[{ label: "Home", href: "/" }, { label: "Offers" }]} />
        <div className="mt-5">
          <DealBanner />
          <Suspense fallback={<ListingSkeleton />}>
            <ListingResults searchParams={searchParams} pathname="/offers" fixed={{ onSale: "1" }} hide={{ onSale: true }} />
          </Suspense>
        </div>
      </div>
    </PageTransition>
  );
}
