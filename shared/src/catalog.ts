// DTOs shared by the API (producer) and the client (consumer).
// Money fields are integer paise. Dates are ISO strings.

export type PetType = "DOG" | "CAT" | "BOTH";
export type StockStatus = "IN_STOCK" | "LOW_STOCK" | "OUT_OF_STOCK";
export type PromotionPlacement = "HERO_CARD" | "COUNTDOWN_BANNER" | "CAMPAIGN" | "NONE";

export interface ImageDTO {
  url: string;
  alt: string;
  /** Intrinsic pixel size when known (product photos). Other images render with `fill`. */
  width?: number;
  height?: number;
}

export interface PriceDTO {
  /** Regular selling price. */
  price: number;
  /** What the customer pays now. */
  salePrice: number;
  /** Strike-through price, or null. */
  referencePrice: number | null;
  discountPercent: number;
  promotion: { slug: string; name: string; endsAt: string } | null;
}

export interface ProductCardDTO {
  id: string;
  slug: string;
  name: string;
  brand: string;
  petType: PetType;
  category: { slug: string; name: string };
  image: ImageDTO;
  hoverImage: ImageDTO | null;
  defaultVariantId: string;
  /** Pricing of the default variant. */
  pricing: PriceDTO;
  ratingAvg: number;
  ratingCount: number;
  stock: StockStatus;
  isSample: boolean;
}

export interface VariantDTO {
  id: string;
  sku: string;
  label: string;
  options: Record<string, string>;
  pricing: PriceDTO;
  stock: StockStatus;
  /** Exact units available (capped for display). */
  available: number;
}

export interface ProductDetailDTO extends ProductCardDTO {
  shortDescription: string;
  description: string;
  specs: { label: string; value: string }[];
  tags: string[];
  images: ImageDTO[];
  variants: VariantDTO[];
  brandSlug: string;
  categoryTrail: { slug: string; name: string }[];
}

export interface CategoryDTO {
  id: string;
  slug: string;
  name: string;
  /** Label used on the homepage card (falls back to name). */
  homeLabel: string;
  description: string;
  image: ImageDTO;
  parentSlug: string | null;
  productCount: number;
  showOnHome: boolean;
}

export interface PetCardDTO {
  pet: "dog" | "cat";
  label: string;
  image: ImageDTO;
}

export interface PromotionDTO {
  id: string;
  slug: string;
  name: string;
  headline: string;
  subheadline: string;
  discountPercent: number;
  startsAt: string;
  endsAt: string;
  placement: PromotionPlacement;
  /** Coupon promoted alongside this offer, with a ready-made label such as "20% off". */
  coupon: { code: string; label: string } | null;
  image: ImageDTO | null;
  ctaLabel: string;
  ctaHref: string;
  theme: string;
}

export interface StoreSettingsPublicDTO {
  announcementText: string;
  freeShippingThreshold: number;
  flatShippingFee: number;
  gstRatePercent: number;
  heroHeadline: string;
  heroSubcopy: string;
  heroImage: ImageDTO;
  popularSearches: string[];
  supportEmail: string;
  supportPhone: string;
}

export interface HomeDTO {
  settings: StoreSettingsPublicDTO;
  /** Server clock at response time; the client uses it to correct countdown drift. */
  serverTime: string;
  heroPromotion: PromotionDTO | null;
  countdownPromotion: PromotionDTO | null;
  campaigns: PromotionDTO[];
  petCards: PetCardDTO[];
  categories: CategoryDTO[];
  deals: ProductCardDTO[];
  bestSellers: ProductCardDTO[];
  newArrivals: ProductCardDTO[];
  recommended: { DOG: ProductCardDTO[]; CAT: ProductCardDTO[] };
  limitedTime: ProductCardDTO[];
}

export interface Paginated<T> {
  items: T[];
  page: number;
  pageSize: number;
  total: number;
  totalPages: number;
}

export interface ApiErrorBody {
  error: { code: string; message: string; details?: unknown };
}

export interface FacetOption {
  slug: string;
  name: string;
  count: number;
}

export interface ListingFacets {
  brands: FacetOption[];
  categories: FacetOption[];
  /** Effective (sale) price bounds in paise for the current filters, ignoring the price filter itself. */
  price: { min: number; max: number };
  onSaleCount: number;
}

export interface ProductListResponse extends Paginated<ProductCardDTO> {
  facets: ListingFacets;
}

export interface SearchResultDTO {
  query: string;
  products: ProductCardDTO[];
  categories: { slug: string; name: string }[];
}

export interface ReviewDTO {
  id: string;
  rating: number;
  title: string;
  body: string;
  author: string;
  createdAt: string;
  isVerifiedPurchase: boolean;
  isSample: boolean;
}

export interface ReviewListDTO {
  summary: { average: number; count: number; distribution: Record<1 | 2 | 3 | 4 | 5, number> };
  items: ReviewDTO[];
  page: number;
  totalPages: number;
}

export interface DeliveryEstimateDTO {
  pincode: string;
  minDays: number;
  maxDays: number;
  /** ISO dates (yyyy-mm-dd) in IST. */
  earliest: string;
  latest: string;
  metro: boolean;
}
