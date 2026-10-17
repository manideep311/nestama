// Sample catalog metadata: brands, categories, settings. All brands are fictional.

export const unsplash = (id: string) => `https://images.unsplash.com/photo-${id}`;

export interface BrandSeed {
  slug: string;
  name: string;
  description: string;
}

export const brands: BrandSeed[] = [
  { slug: "tug-theory", name: "Tug Theory", description: "Durable play for dogs who mean business." },
  { slug: "whisker-wool", name: "Whisker & Wool", description: "Thoughtful toys and furniture for curious cats." },
  { slug: "nestama-home", name: "Nestama Home", description: "Our in-house range of beds, bowls and everyday comforts." },
  { slug: "barkbite-kitchen", name: "Barkbite Kitchen", description: "Small-batch food and treats made with real ingredients." },
  { slug: "little-tiger-pantry", name: "Little Tiger Pantry", description: "Nutrition built around how cats actually eat." },
  { slug: "trailtail", name: "Trailtail", description: "Harnesses, leashes and travel gear for outdoor pets." },
  { slug: "pawprint-atelier", name: "Pawprint Atelier", description: "Collars, clothing and small accessories, made to last." },
  { slug: "furrow-co", name: "Furrow & Co.", description: "Gentle grooming tools and coat care." },
  { slug: "wagwell", name: "Wagwell", description: "Everyday supplements and wellness care." },
];

export interface CategorySeed {
  slug: string;
  name: string;
  homeLabel?: string;
  description: string;
  imageId: string;
  imageAlt: string;
  parent?: string;
  showOnHome: boolean;
  sortOrder: number;
}

export const categories: CategorySeed[] = [
  {
    slug: "food-treats",
    name: "Food & Treats",
    description: "Complete meals and honest treats for dogs and cats.",
    imageId: "1568640347023-a616a30bc3bd",
    imageAlt: "Bone-shaped dog biscuits scattered on a pink surface",
    showOnHome: true,
    sortOrder: 1,
  },
  {
    slug: "toys",
    name: "Toys",
    description: "Tuggers, squeakers, chasers and puzzles for every play style.",
    imageId: "1591946614720-90a587da4a36",
    imageAlt: "A golden dog holding a striped plush elephant toy",
    showOnHome: true,
    sortOrder: 2,
  },
  {
    slug: "beds-furniture",
    name: "Beds & Furniture",
    description: "Beds, baskets, cat trees and scratchers built for long naps.",
    imageId: "1581888227599-779811939961",
    imageAlt: "A dog resting in a grey bolster bed with a blanket",
    showOnHome: true,
    sortOrder: 3,
  },
  {
    slug: "grooming",
    name: "Grooming",
    description: "Shampoos, brushes and tools for an easy grooming routine.",
    imageId: "1611173622933-91942d394b04",
    imageAlt: "A Pomeranian wrapped in a pink towel after a bath",
    showOnHome: true,
    sortOrder: 4,
  },
  {
    slug: "health-wellness",
    name: "Health & Wellness",
    description: "Supplements and care for joints, teeth, digestion and calm.",
    imageId: "1770836037793-95bdbf190f71",
    imageAlt: "A veterinarian gently examining a dachshund",
    showOnHome: true,
    sortOrder: 5,
  },
  {
    slug: "travel",
    name: "Travel",
    homeLabel: "Travel Essentials",
    description: "Carriers, car gear and trail packs for pets on the move.",
    imageId: "1559190394-df5a28aab5c5",
    imageAlt: "A cocker spaniel enjoying the breeze from a car window",
    showOnHome: true,
    sortOrder: 6,
  },
  {
    slug: "accessories",
    name: "Accessories",
    description: "Collars, leashes, clothing, bowls and everyday add-ons.",
    imageId: "1682969651476-6fb48aba8b03",
    imageAlt: "A sparkly bone-shaped name tag on a dog collar",
    showOnHome: false,
    sortOrder: 7,
  },
  {
    slug: "collars-leashes",
    name: "Collars & Leashes",
    description: "Collars, harnesses, leashes and ID tags.",
    imageId: "1708062270853-ee7c66b69f07",
    imageAlt: "A red rope leash coiled on a wooden floor",
    parent: "accessories",
    showOnHome: true,
    sortOrder: 8,
  },
  {
    slug: "clothing",
    name: "Pet Clothing",
    description: "Raincoats, knits, shirts and bandanas.",
    imageId: "1530041539828-114de669390e",
    imageAlt: "A pug wearing a bright yellow raincoat",
    parent: "accessories",
    showOnHome: true,
    sortOrder: 9,
  },
  {
    slug: "bowls-feeders",
    name: "Bowls & Feeders",
    description: "Bowls, slow feeders and travel water bowls.",
    imageId: "1782909800977-401f7d7dbadc",
    imageAlt: "A corgi drinking from an orange collapsible bowl",
    parent: "accessories",
    showOnHome: false,
    sortOrder: 10,
  },
];

/** Virtual home cards that link to pet-type listings rather than a category. */
export const petCards = [
  {
    pet: "dog" as const,
    label: "Dog Essentials",
    imageId: "1768058430062-9e8309e7e665",
    imageAlt: "A golden retriever holding a ball in its mouth",
  },
  {
    pet: "cat" as const,
    label: "Cat Essentials",
    imageId: "1775483680617-6dde248dad4c",
    imageAlt: "A fluffy kitten playing with a yellow toy",
  },
];

export const settings = {
  announcementText: "Easy 7-day returns on every order",
  freeShippingThreshold: 99900,
  flatShippingFee: 7900,
  gstRatePercent: 18,
  heroHeadline: "Happy Pets. Happier Lives.",
  heroSubcopy: "Thoughtfully chosen essentials for the ones who make your life better.",
  heroImageId: "1727419780738-8b9e85ab9ca6",
  heroImageAlt: "A white shepherd dog and an orange kitten sitting together at home",
  popularSearches: ["Dog beds", "Cat toys", "No-pull harness", "Puppy food", "Shampoo", "Cat tree"],
  supportEmail: "hello@nestama.test",
  supportPhone: "1800-NESTAMA",
};
