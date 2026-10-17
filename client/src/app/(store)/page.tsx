import { Flame } from "lucide-react";
import type { HomeDTO, ProductCardDTO } from "@nestama/shared";
import { getHome } from "@/lib/catalog";
import { Hero } from "@/components/home/Hero";
import { CategoryGrid } from "@/components/home/CategoryGrid";
import { CampaignCards } from "@/components/home/CampaignCards";
import { RecommendedForPet } from "@/components/home/RecommendedForPet";
import { TrustSection } from "@/components/home/TrustSection";
import { ProductCarousel } from "@/components/product/ProductCarousel";
import { OfferCountdown } from "@/components/promo/OfferCountdown";
import { SectionHeading } from "@/components/ui/SectionHeading";
import { ButtonLink } from "@/components/ui/Button";
import { PageTransition } from "@/components/layout/PageTransition";
import { RecentlyViewed } from "@/components/product/RecentlyViewed";

export default async function HomePage() {
  let home: HomeDTO;
  try {
    home = await getHome();
  } catch (err) {
    console.error("[home] Failed to load homepage data:", err);
    return <StoreUnavailable />;
  }

  return (
    <PageTransition>
      <Hero settings={home.settings} promotion={home.heroPromotion} />
      <CategoryGrid petCards={home.petCards} categories={home.categories} />
      <CampaignCards campaigns={home.campaigns} />

      {home.deals.length > 0 && (
        <section aria-labelledby="deals-title" className="container-page pt-14 md:pt-20">
          <SectionHeading
            id="deals-title"
            title={
              <span className="inline-flex items-center gap-2">
                <Flame className="size-8 text-ember" aria-hidden="true" /> Deals of the day
              </span>
            }
            subtitle="Limited-time prices on your pet's favourites."
            action={{ href: "/offers", label: "View all deals" }}
            aside={home.countdownPromotion && <OfferCountdown endsAt={home.countdownPromotion.endsAt} variant="pill" />}
          />
          <ProductCarousel products={home.deals} label="Deals of the day" />
        </section>
      )}

      <Rail id="best-sellers" eyebrow="Most loved" title="Best sellers" products={home.bestSellers} href="/shop?sort=bestselling" />
      <Rail id="new-arrivals" eyebrow="Just landed" title="New arrivals" products={home.newArrivals} href="/shop?sort=newest" />
      <RecommendedForPet recommended={home.recommended} />
      <RecentlyViewed className="container-page pt-14 md:pt-20" />
      <Rail
        id="limited-time"
        eyebrow="Ending soon"
        title="Limited-time offers"
        subtitle="These prices end within the week."
        products={home.limitedTime}
        href="/offers"
      />
      <TrustSection freeShippingThreshold={home.settings.freeShippingThreshold} />
    </PageTransition>
  );
}

function Rail({
  id,
  eyebrow,
  title,
  subtitle,
  products,
  href,
}: {
  id: string;
  eyebrow: string;
  title: string;
  subtitle?: string;
  products: ProductCardDTO[];
  href: string;
}) {
  if (products.length === 0) return null;
  return (
    <section aria-labelledby={id} className="container-page pt-14 md:pt-20">
      <SectionHeading id={id} eyebrow={eyebrow} title={title} subtitle={subtitle} action={{ href, label: "Shop all" }} />
      <ProductCarousel products={products} label={title} />
    </section>
  );
}

function StoreUnavailable() {
  return (
    <section className="container-page grid min-h-[50vh] place-items-center py-20 text-center">
      <div className="max-w-md">
        <h1 className="text-3xl font-extrabold">The shelves are being restocked</h1>
        <p className="mt-3 text-muted">We couldn&apos;t load the store just now. Please try again in a moment.</p>
        <ButtonLink href="/" className="mt-6">
          Try again
        </ButtonLink>
      </div>
    </section>
  );
}
