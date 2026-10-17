import type { HomeDTO, PetCardDTO, ProductCardDTO, StoreSettingsPublicDTO } from "@nestama/shared";
import { getStoreSettingsRow } from "../settings/settings.service";
import { allProductCards, listCategories, toPromotionDTO } from "../catalog/catalog.service";

const unsplash = (id: string) => `https://images.unsplash.com/photo-${id}`;

/** Virtual category cards that open the pet-type listings. */
const PET_CARDS: PetCardDTO[] = [
  {
    pet: "dog",
    label: "Dog Essentials",
    image: { url: unsplash("1768058430062-9e8309e7e665"), alt: "A golden retriever holding a ball in its mouth" },
  },
  {
    pet: "cat",
    label: "Cat Essentials",
    image: { url: unsplash("1775483680617-6dde248dad4c"), alt: "A fluffy kitten playing with a yellow toy" },
  },
];

const SECTION_SIZE = 8;
const WEEK_MS = 7 * 24 * 3600_000;

export async function getPublicSettings(): Promise<StoreSettingsPublicDTO> {
  const s = await getStoreSettingsRow();
  return {
    announcementText: s.announcementText,
    freeShippingThreshold: s.freeShippingThreshold,
    flatShippingFee: s.flatShippingFee,
    gstRatePercent: s.gstRatePercent,
    heroHeadline: s.heroHeadline,
    heroSubcopy: s.heroSubcopy,
    heroImage: { url: s.heroImageUrl, alt: s.heroImageAlt },
    popularSearches: s.popularSearches,
    supportEmail: s.supportEmail,
    supportPhone: s.supportPhone,
  };
}

/** Sold-out products sink to the end of any merchandising list. */
const availableFirst = (a: ProductCardDTO, b: ProductCardDTO) => Number(a.stock === "OUT_OF_STOCK") - Number(b.stock === "OUT_OF_STOCK");

export async function getHome(now = new Date()): Promise<HomeDTO> {
  const [settings, categories, { cards, rows, promos }] = await Promise.all([getPublicSettings(), listCategories(), allProductCards(now)]);

  const promotionDTOs = promos.map(toPromotionDTO);
  const countdownPromotion = promotionDTOs.find((p) => p.placement === "COUNTDOWN_BANNER") ?? null;
  const heroPromotion = promotionDTOs.find((p) => p.placement === "HERO_CARD") ?? countdownPromotion;
  const campaigns = promotionDTOs.filter((p) => p.placement === "CAMPAIGN");

  const meta = new Map(rows.map((r) => [r.id, { soldCount: r.soldCount, publishedAt: r.publishedAt.getTime() }]));
  const sold = (c: ProductCardDTO) => meta.get(c.id)?.soldCount ?? 0;
  const published = (c: ProductCardDTO) => meta.get(c.id)?.publishedAt ?? 0;
  const inStock = cards.filter((c) => c.stock !== "OUT_OF_STOCK");

  const deals = (
    countdownPromotion
      ? inStock.filter((c) => c.pricing.promotion?.slug === countdownPromotion.slug)
      : inStock.filter((c) => c.pricing.discountPercent > 0)
  )
    .sort((a, b) => b.pricing.discountPercent - a.pricing.discountPercent || sold(b) - sold(a))
    .slice(0, 10);

  const dealIds = new Set(deals.map((d) => d.id));

  const bestSellers = [...cards].sort((a, b) => availableFirst(a, b) || sold(b) - sold(a)).slice(0, SECTION_SIZE);
  const newArrivals = [...cards].sort((a, b) => availableFirst(a, b) || published(b) - published(a)).slice(0, SECTION_SIZE);

  const recommendedFor = (pet: "DOG" | "CAT") =>
    inStock
      .filter((c) => c.petType === pet || c.petType === "BOTH")
      .sort((a, b) => b.ratingAvg - a.ratingAvg || b.ratingCount - a.ratingCount)
      .slice(0, SECTION_SIZE);

  const limitedTime = inStock
    .filter((c) => {
      const endsAt = c.pricing.promotion ? Date.parse(c.pricing.promotion.endsAt) : NaN;
      return !dealIds.has(c.id) && endsAt - now.getTime() <= WEEK_MS;
    })
    .sort(
      (a, b) =>
        Date.parse(a.pricing.promotion!.endsAt) - Date.parse(b.pricing.promotion!.endsAt) ||
        b.pricing.discountPercent - a.pricing.discountPercent,
    )
    .slice(0, SECTION_SIZE);

  return {
    settings,
    serverTime: now.toISOString(),
    heroPromotion,
    countdownPromotion,
    campaigns,
    petCards: PET_CARDS,
    categories: categories.filter((c) => c.showOnHome),
    deals,
    bestSellers,
    newArrivals,
    recommended: { DOG: recommendedFor("DOG"), CAT: recommendedFor("CAT") },
    limitedTime,
  };
}
