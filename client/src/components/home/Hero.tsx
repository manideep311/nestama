import Image from "next/image";
import { ArrowRight, BadgeCheck, Heart, ShieldCheck, Truck } from "lucide-react";
import { formatINR, type PromotionDTO, type StoreSettingsPublicDTO } from "@nestama/shared";
import { ButtonLink } from "@/components/ui/Button";
import { HeartDoodle, PawIcon, YarnCurl, YarnUnderline } from "@/components/ui/icons";
import { HeroOfferCard } from "./HeroOfferCard";

export function Hero({ settings, promotion }: { settings: StoreSettingsPublicDTO; promotion: PromotionDTO | null }) {
  // "Happy Pets. Happier Lives." → first sentence in charcoal, the rest in ember with the yarn underline.
  const [lead, ...rest] = settings.heroHeadline.split(/(?<=\.)\s+/);
  const accent = rest.join(" ");

  const trust = [
    { icon: Truck, title: "Free shipping", note: `above ${formatINR(settings.freeShippingThreshold)}` },
    { icon: BadgeCheck, title: "Quality products", note: "checked by our team" },
    { icon: ShieldCheck, title: "Trusted brands", note: "and honest labels" },
    { icon: Heart, title: "Loved by", note: "pet parents" },
  ];

  return (
    <section
      aria-labelledby="hero-title"
      className="relative overflow-hidden bg-[linear-gradient(180deg,var(--color-cream)_0%,#fff1e4_100%)]"
    >
      <div className="pointer-events-none absolute inset-0 paw-pattern" aria-hidden="true" />

      <div className="relative container-page grid items-center gap-x-8 gap-y-10 py-10 md:grid-cols-2 md:py-14 lg:grid-cols-[1.12fr_0.86fr_0.92fr] lg:py-16">
        {/* Copy */}
        <div className="relative z-10">
          <p className="mb-4 inline-flex items-center gap-2 text-xs font-bold tracking-[0.18em] text-orange-ink uppercase">
            <YarnCurl className="h-3 w-8 text-orange" /> Everything for dogs &amp; cats
          </p>
          <h1
            id="hero-title"
            className="font-display text-[3.1rem] leading-[0.95] font-extrabold tracking-[-0.035em] text-charcoal sm:text-[4rem] md:text-[3.3rem] lg:text-[3.7rem] xl:text-[4.6rem]"
          >
            <span className="block">{lead}</span>
            {accent && (
              <span className="relative inline-block text-ember">
                {accent}
                <YarnUnderline animate className="absolute -bottom-3 left-0 h-4 w-[96%] text-orange/80" />
                <HeartDoodle className="absolute -top-4 -right-9 hidden size-8 rotate-12 text-orange sm:block" />
              </span>
            )}
          </h1>
          <p className="mt-7 max-w-md text-lg leading-relaxed text-charcoal/85">{settings.heroSubcopy}</p>

          <div className="mt-7 flex flex-wrap gap-3">
            <ButtonLink href="/shop" size="lg">
              Shop now <ArrowRight className="size-5" aria-hidden="true" />
            </ButtonLink>
            <ButtonLink href="#categories" size="lg" variant="outline">
              Explore categories
            </ButtonLink>
          </div>

          <ul className="mt-9 grid max-w-md grid-cols-2 gap-x-5 gap-y-4">
            {trust.map(({ icon: Icon, title, note }) => (
              <li key={title} className="flex items-center gap-2.5">
                <span className="grid size-9 shrink-0 place-items-center rounded-full bg-white text-ember shadow-card">
                  <Icon className="size-[18px]" aria-hidden="true" />
                </span>
                <span className="text-[13px] leading-tight">
                  <strong className="block font-bold text-forest">{title}</strong>
                  <span className="text-muted">{note}</span>
                </span>
              </li>
            ))}
          </ul>
        </div>

        {/* Photo */}
        <div className="relative mx-auto w-full max-w-sm md:max-w-none">
          <div className="relative aspect-[4/5] overflow-hidden rounded-t-[999px] rounded-b-[2.5rem] bg-peach shadow-lift">
            {settings.heroImage.url && (
              <Image
                src={settings.heroImage.url}
                alt={settings.heroImage.alt}
                fill
                preload
                data-hero=""
                sizes="(min-width: 1024px) 30vw, (min-width: 768px) 45vw, 90vw"
                className="object-cover object-[50%_35%]"
              />
            )}
          </div>
          <p className="absolute -top-2 -right-2 rotate-[8deg] rounded-2xl bg-white/90 px-3 py-1.5 font-[family-name:var(--font-hand)] text-xl leading-tight font-bold text-forest shadow-card sm:-right-6 sm:text-2xl">
            Different species,
            <br />
            same love
          </p>
          <PawIcon className="absolute -bottom-3 -left-3 size-12 -rotate-12 text-orange drop-shadow-sm" />
        </div>

        {/* Offer */}
        <div className="md:col-span-2 lg:col-span-1">
          <HeroOfferCard promotion={promotion} freeShippingThreshold={settings.freeShippingThreshold} />
        </div>
      </div>
    </section>
  );
}
