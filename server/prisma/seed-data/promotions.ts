// Seed promotions & coupons. Windows are relative to seed time so demos always have live offers.
// Everything here is editable from the admin dashboard afterwards.

const HOUR = 3600_000;
const DAY = 24 * HOUR;

export interface PromotionSeed {
  slug: string;
  name: string;
  headline: string;
  subheadline: string;
  discountPercent: number;
  startOffsetMs: number;
  endOffsetMs: number;
  placement: "HERO_CARD" | "COUNTDOWN_BANNER" | "CAMPAIGN" | "NONE";
  scope: "ALL" | "CATEGORIES" | "PRODUCTS";
  categorySlugs?: string[];
  productSlugs?: string[];
  couponCode?: string;
  imageId?: string;
  imageAlt?: string;
  ctaLabel: string;
  ctaHref: string;
  theme: string;
  sortOrder: number;
}

export const dealProductSlugs = [
  "farm-chicken-brown-rice-adult-dog-food",
  "adventure-no-pull-harness",
  "sky-tower-cat-tree",
  "explorer-pet-carrier-backpack",
  "treat-puzzle-ball",
  "cloud-bolster-dog-bed",
  "tender-tuna-pate",
  "deshedding-grooming-glove",
  "trailhead-rope-leash",
  "feather-wand-teaser",
];

export const promotions: PromotionSeed[] = [
  {
    slug: "pawsome-deals",
    name: "Paw-some Deals",
    headline: "Paw-some deals — up to 25% off",
    subheadline: "Hand-picked favourites at their best prices of the season.",
    discountPercent: 25,
    startOffsetMs: -2 * DAY,
    endOffsetMs: 3 * DAY + 7 * HOUR,
    placement: "COUNTDOWN_BANNER",
    scope: "PRODUCTS",
    productSlugs: dealProductSlugs,
    couponCode: "NESTAMA20",
    imageId: "1768058430062-9e8309e7e665",
    imageAlt: "A golden retriever holding a ball",
    ctaLabel: "Shop deals",
    ctaHref: "/offers",
    theme: "orange",
    sortOrder: 0,
  },
  {
    slug: "toys-that-make-tails-wag",
    name: "Toys That Make Tails Wag",
    headline: "Toys That Make Tails Wag",
    subheadline: "Squeakers, tuggers and chasers for every play style.",
    discountPercent: 15,
    startOffsetMs: -3 * DAY,
    endOffsetMs: 20 * DAY,
    placement: "CAMPAIGN",
    scope: "CATEGORIES",
    categorySlugs: ["toys"],
    imageId: "1627323721367-94128c3fa0f7",
    imageAlt: "A golden retriever puppy chewing a plush toy on the grass",
    ctaLabel: "Shop toys",
    ctaHref: "/c/toys",
    theme: "sage",
    sortOrder: 1,
  },
  {
    slug: "cozy-beds-sweeter-dreams",
    name: "Cozy Beds for Sweeter Dreams",
    headline: "Cozy Beds for Sweeter Dreams",
    subheadline: "Bolsters, baskets and memory foam for long naps.",
    discountPercent: 20,
    startOffsetMs: -1 * DAY,
    endOffsetMs: 14 * DAY,
    placement: "CAMPAIGN",
    scope: "CATEGORIES",
    categorySlugs: ["beds-furniture"],
    imageId: "1774440865547-6329be652bb4",
    imageAlt: "A beagle puppy asleep on a yellow pillow",
    ctaLabel: "Shop beds",
    ctaHref: "/c/beds-furniture",
    theme: "blush",
    sortOrder: 2,
  },
  {
    slug: "grooming-made-easy",
    name: "Grooming Made Easy",
    headline: "Grooming Made Easy",
    subheadline: "Gentle shampoos, brushes and tools for bath day.",
    discountPercent: 15,
    startOffsetMs: -4 * DAY,
    endOffsetMs: 10 * DAY,
    placement: "CAMPAIGN",
    scope: "CATEGORIES",
    categorySlugs: ["grooming"],
    imageId: "1757553532955-38d5d1c735d2",
    imageAlt: "A smiling white spitz with a freshly groomed coat",
    ctaLabel: "Shop grooming",
    ctaHref: "/c/grooming",
    theme: "peach",
    sortOrder: 3,
  },
  {
    slug: "healthy-pets-brighter-tomorrows",
    name: "Healthy Pets, Brighter Tomorrows",
    headline: "Healthy Pets, Brighter Tomorrows",
    subheadline: "Up to 25% off selected health & wellness essentials.",
    discountPercent: 25,
    startOffsetMs: -1 * DAY,
    endOffsetMs: 6 * DAY,
    placement: "CAMPAIGN",
    scope: "PRODUCTS",
    productSlugs: ["joint-care-glucosamine-chews", "daily-multivitamin-bites", "probiotic-gut-health-chews", "dental-care-kit"],
    imageId: "1508609540374-67d1601ba520",
    imageAlt: "A golden retriever balancing a treat on its nose",
    ctaLabel: "Shop wellness",
    ctaHref: "/c/health-wellness",
    theme: "mist",
    sortOrder: 4,
  },
];

export interface CouponSeed {
  code: string;
  description: string;
  type: "PERCENT" | "FIXED";
  /** Percent, or rupees for FIXED. */
  value: number;
  minOrder: number;
  maxDiscount?: number;
  startOffsetMs: number;
  endOffsetMs: number;
  usageLimit?: number;
  perUserLimit?: number;
}

export const coupons: CouponSeed[] = [
  {
    code: "NESTAMA20",
    description: "20% off orders above ₹999 (up to ₹500) during Paw-some Deals",
    type: "PERCENT",
    value: 20,
    minOrder: 999,
    maxDiscount: 500,
    startOffsetMs: -2 * DAY,
    endOffsetMs: 3 * DAY + 7 * HOUR,
  },
  {
    code: "WELCOME10",
    description: "10% off your first order above ₹499 (up to ₹300)",
    type: "PERCENT",
    value: 10,
    minOrder: 499,
    maxDiscount: 300,
    startOffsetMs: -30 * DAY,
    endOffsetMs: 365 * DAY,
    perUserLimit: 1,
  },
  {
    code: "FLAT150",
    description: "₹150 off orders above ₹1,499",
    type: "FIXED",
    value: 150,
    minOrder: 1499,
    startOffsetMs: -1 * DAY,
    endOffsetMs: 60 * DAY,
  },
];
