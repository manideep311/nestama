import Image from "next/image";
import Link from "next/link";
import { ArrowRight } from "lucide-react";
import type { PromotionDTO } from "@nestama/shared";
import { cn } from "@/lib/cn";

const themes: Record<string, string> = {
  sage: "bg-[linear-gradient(135deg,#e5efe4_0%,#d6e7d3_100%)]",
  blush: "bg-[linear-gradient(135deg,#ffe8e3_0%,#ffd5cf_100%)]",
  peach: "bg-[linear-gradient(135deg,#fff0e2_0%,#ffe3d2_100%)]",
  mist: "bg-[linear-gradient(135deg,#e9f2f0_0%,#d9e9e6_100%)]",
  cream: "bg-[linear-gradient(135deg,#fff8ef_0%,#f8eddf_100%)]",
  orange: "bg-[linear-gradient(135deg,#ffe3d2_0%,#ffc9a8_100%)]",
};

/** Small handwritten asides, keyed by promotion slug. Purely decorative. */
const asides: Record<string, string> = {
  "toys-that-make-tails-wag": "Play more, bark less",
  "cozy-beds-sweeter-dreams": "z z z…",
  "grooming-made-easy": "Fresh & fluffy",
  "healthy-pets-brighter-tomorrows": "Feel-good care",
};

export function CampaignCards({ campaigns }: { campaigns: PromotionDTO[] }) {
  if (campaigns.length === 0) return null;
  return (
    <section aria-label="Current campaigns" className="container-page pt-12 md:pt-16">
      <ul className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {campaigns.map((c) => (
          <li key={c.id}>
            <CampaignCard campaign={c} />
          </li>
        ))}
      </ul>
    </section>
  );
}

function CampaignCard({ campaign }: { campaign: PromotionDTO }) {
  const aside = asides[campaign.slug];
  // Product-scoped campaigns cover selected items, so they promise "up to".
  const isUpTo = campaign.subheadline.toLowerCase().startsWith("up to") || campaign.headline.toLowerCase().includes("up to");
  return (
    <Link
      href={campaign.ctaHref}
      className={cn(
        "group relative flex min-h-56 overflow-hidden rounded-3xl p-5 ring-1 ring-line transition-[transform,box-shadow] duration-300 ease-soft hover:-translate-y-1 hover:shadow-lift sm:p-6",
        themes[campaign.theme] ?? themes.cream,
      )}
    >
      <div className="relative z-10 flex max-w-[50%] flex-col">
        <h3 className="text-[1.45rem] leading-[1.08] font-extrabold text-forest">{campaign.headline}</h3>
        <p className="mt-2 text-lg font-extrabold text-charcoal">
          {isUpTo ? "Up to " : "Flat "}
          <span className="text-ember">{campaign.discountPercent}% OFF</span>
        </p>
        <span className="mt-auto inline-flex w-fit items-center gap-1.5 rounded-full bg-forest px-4 py-2 text-sm font-bold text-cream transition-colors group-hover:bg-forest-700">
          {campaign.ctaLabel}
          <ArrowRight className="size-4 transition-transform duration-200 group-hover:translate-x-0.5" aria-hidden="true" />
        </span>
      </div>

      {campaign.image && (
        <div className="absolute inset-y-0 right-0 w-[48%]">
          <div className="absolute inset-0 overflow-hidden rounded-l-[5rem]">
            <Image
              src={campaign.image.url}
              alt={campaign.image.alt}
              fill
              sizes="(min-width: 1280px) 150px, (min-width: 640px) 24vw, 48vw"
              className="object-cover transition-transform duration-700 ease-soft group-hover:scale-[1.06]"
            />
          </div>
        </div>
      )}
      {aside && (
        <span
          aria-hidden="true"
          className="absolute top-3 right-4 z-10 -rotate-6 rounded-xl bg-white/85 px-2 py-0.5 font-[family-name:var(--font-hand)] text-lg font-bold text-forest"
        >
          {aside}
        </span>
      )}
    </Link>
  );
}
