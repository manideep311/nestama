import { z } from "./zod";
import { ORDER_STATUSES, type OrderDetailDTO, type OrderStatusValue } from "./orders";

// ───────── Enums shared by admin forms and the API ─────────

export const PET_TYPES = ["DOG", "CAT", "BOTH"] as const;
export type PetTypeValue = (typeof PET_TYPES)[number];
export const PROMOTION_PLACEMENTS = ["HERO_CARD", "COUNTDOWN_BANNER", "CAMPAIGN", "NONE"] as const;
export const DISCOUNT_SCOPES = ["ALL", "CATEGORIES", "PRODUCTS"] as const;
export const COUPON_TYPES = ["PERCENT", "FIXED"] as const;
export const PROMOTION_THEMES = ["peach", "sage", "blush", "mist", "cream", "orange"] as const;
export type PromotionStatusValue = "scheduled" | "live" | "ended" | "paused";

const SLUG = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
const MAX_PAISE = 100_000_000; // ₹10,00,000

const optionalSlug = z
  .string()
  .trim()
  .max(120)
  .optional()
  .transform((v) => (v ? v : undefined))
  .pipe(z.string().regex(SLUG, "Use lowercase letters, numbers and dashes").optional());

/** Uploaded files are served from /uploads; catalogue photos come from https CDNs. */
const imageUrl = z
  .string()
  .trim()
  .min(1, "Add an image")
  .max(500)
  .regex(/^(https:\/\/|\/uploads\/)/, "Use an uploaded image or an https:// URL");

const isoDate = z.iso.datetime({ offset: true, error: "Enter a valid date and time" });

// ───────── Products ─────────

export const adminVariantInputSchema = z
  .object({
    id: z.string().max(40).optional(),
    sku: z
      .string()
      .trim()
      .min(2, "Add a SKU")
      .max(40)
      .regex(/^[A-Za-z0-9-]+$/, "Letters, numbers and dashes only")
      .transform((s) => s.toUpperCase()),
    label: z.string().trim().min(1, "Name this option").max(60),
    options: z.record(z.string().trim().min(1).max(30), z.string().trim().min(1).max(40)).default({}),
    price: z.number().int().min(100, "Price must be at least ₹1").max(MAX_PAISE),
    mrp: z.number().int().max(MAX_PAISE).nullable().default(null),
    stock: z.number().int().min(0, "Stock can't be negative").max(100_000),
    lowStockThreshold: z.number().int().min(0).max(1000).default(5),
    isDefault: z.boolean().default(false),
  })
  .refine((v) => v.mrp === null || v.mrp >= v.price, { path: ["mrp"], message: "MRP must be at least the selling price" });

export const adminImageInputSchema = z.object({
  id: z.string().max(40).optional(),
  url: imageUrl,
  alt: z.string().trim().min(3, "Describe the image for screen readers").max(160),
  width: z.number().int().min(1).max(20_000),
  height: z.number().int().min(1).max(20_000),
});

export const adminProductInputSchema = z
  .object({
    name: z.string().trim().min(3, "Name the product").max(120),
    slug: optionalSlug,
    shortDescription: z.string().trim().max(200).default(""),
    description: z.string().trim().min(20, "Describe the product (20+ characters)").max(5000),
    petType: z.enum(PET_TYPES),
    categoryId: z.string().min(1, "Choose a category"),
    brandId: z.string().min(1, "Choose a brand"),
    specs: z
      .array(z.object({ label: z.string().trim().min(1).max(40), value: z.string().trim().min(1).max(120) }))
      .max(20)
      .default([]),
    tags: z
      .array(z.string().trim().toLowerCase().min(1).max(30))
      .max(15)
      .default([])
      .transform((tags) => [...new Set(tags)]),
    isActive: z.boolean().default(true),
    isFeatured: z.boolean().default(false),
    isSample: z.boolean().default(false),
    variants: z.array(adminVariantInputSchema).min(1, "Add at least one option").max(30),
    images: z.array(adminImageInputSchema).min(1, "Add at least one image").max(10),
  })
  .superRefine((p, ctx) => {
    const defaults = p.variants.filter((v) => v.isDefault).length;
    if (defaults !== 1) ctx.addIssue({ code: "custom", path: ["variants"], message: "Mark exactly one option as the default" });
    const seen = new Set<string>();
    p.variants.forEach((v, i) => {
      if (seen.has(v.sku)) ctx.addIssue({ code: "custom", path: ["variants", i, "sku"], message: "Each option needs its own SKU" });
      seen.add(v.sku);
    });
  });
export type AdminProductInput = z.input<typeof adminProductInputSchema>;
export type AdminProductData = z.output<typeof adminProductInputSchema>;
export type AdminVariantInput = z.input<typeof adminVariantInputSchema>;

// ───────── Categories, brands, inventory ─────────

export const categoryInputSchema = z.object({
  name: z.string().trim().min(2, "Name the category").max(60),
  slug: optionalSlug,
  description: z.string().trim().max(300).default(""),
  imageUrl,
  imageAlt: z.string().trim().max(160).default(""),
  parentId: z.string().max(40).nullable().default(null),
  sortOrder: z.number().int().min(0).max(1000).default(0),
  showOnHome: z.boolean().default(true),
  homeLabel: z
    .string()
    .trim()
    .max(40)
    .optional()
    .transform((v) => (v ? v : null)),
});
export type CategoryInput = z.input<typeof categoryInputSchema>;

export const brandInputSchema = z.object({
  name: z.string().trim().min(2, "Name the brand").max(60),
  slug: optionalSlug,
  description: z.string().trim().max(300).default(""),
});
export type BrandInput = z.input<typeof brandInputSchema>;

export const stockUpdateSchema = z.object({
  items: z
    .array(z.object({ variantId: z.string().min(1).max(40), stock: z.number().int().min(0).max(100_000) }))
    .min(1)
    .max(200),
});

// ───────── Promotions & coupons ─────────

const windowRefine = <T extends { startsAt: string; endsAt: string }>(v: T) => new Date(v.endsAt) > new Date(v.startsAt);
const scopeRefine = <T extends { scope: string; categoryIds: string[]; productIds: string[] }>(v: T) =>
  (v.scope !== "CATEGORIES" || v.categoryIds.length > 0) && (v.scope !== "PRODUCTS" || v.productIds.length > 0);

export const promotionInputSchema = z
  .object({
    name: z.string().trim().min(3, "Name the promotion").max(80),
    slug: optionalSlug,
    headline: z.string().trim().min(3, "Add a headline").max(80),
    subheadline: z.string().trim().max(160).default(""),
    discountPercent: z.number().int().min(1, "Enter a discount from 1% to 90%").max(90, "Enter a discount from 1% to 90%"),
    startsAt: isoDate,
    endsAt: isoDate,
    isActive: z.boolean().default(true),
    placement: z.enum(PROMOTION_PLACEMENTS).default("NONE"),
    scope: z.enum(DISCOUNT_SCOPES).default("ALL"),
    categoryIds: z.array(z.string().max(40)).max(50).default([]),
    productIds: z.array(z.string().max(40)).max(200).default([]),
    couponId: z.string().max(40).nullable().default(null),
    imageUrl: imageUrl.nullable().default(null),
    imageAlt: z.string().trim().max(160).nullable().default(null),
    ctaLabel: z.string().trim().min(2).max(30).default("Shop now"),
    ctaHref: z
      .string()
      .trim()
      .regex(/^\/[^\s]*$/, "Use a link on this site, like /offers")
      .default("/offers"),
    theme: z.enum(PROMOTION_THEMES).default("peach"),
    sortOrder: z.number().int().min(0).max(1000).default(0),
  })
  .refine(windowRefine, { path: ["endsAt"], message: "End must be after the start" })
  .refine(scopeRefine, { path: ["scope"], message: "Pick at least one category or product for this scope" });
export type PromotionInput = z.input<typeof promotionInputSchema>;

export const couponInputSchema = z
  .object({
    code: z
      .string()
      .trim()
      .toUpperCase()
      .regex(/^[A-Z0-9]{4,20}$/, "4–20 letters or numbers"),
    description: z.string().trim().max(160).default(""),
    type: z.enum(COUPON_TYPES),
    value: z.number().int().min(1, "Enter the discount"),
    minOrder: z.number().int().min(0).max(MAX_PAISE).default(0),
    maxDiscount: z.number().int().min(100).max(MAX_PAISE).nullable().default(null),
    startsAt: isoDate,
    endsAt: isoDate,
    usageLimit: z.number().int().min(1).max(1_000_000).nullable().default(null),
    perUserLimit: z.number().int().min(1).max(1000).nullable().default(null),
    scope: z.enum(DISCOUNT_SCOPES).default("ALL"),
    categoryIds: z.array(z.string().max(40)).max(50).default([]),
    productIds: z.array(z.string().max(40)).max(200).default([]),
    isActive: z.boolean().default(true),
  })
  .refine((c) => c.type !== "PERCENT" || c.value <= 90, { path: ["value"], message: "Percent coupons go up to 90%" })
  .refine((c) => c.type !== "FIXED" || c.value >= 100, { path: ["value"], message: "Take at least ₹1 off" })
  .refine(windowRefine, { path: ["endsAt"], message: "End must be after the start" })
  .refine(scopeRefine, { path: ["scope"], message: "Pick at least one category or product for this scope" });
export type CouponInput = z.input<typeof couponInputSchema>;

// ───────── Orders, customers, reviews, settings ─────────

export const orderStatusUpdateSchema = z.object({
  status: z.enum(ORDER_STATUSES),
  note: z.string().trim().max(200).optional(),
});

export const roleUpdateSchema = z.object({ role: z.enum(["CUSTOMER", "ADMIN"]) });
export const reviewStatusSchema = z.object({ status: z.enum(["PUBLISHED", "HIDDEN"]) });

export const settingsInputSchema = z.object({
  announcementText: z.string().trim().max(160).default(""),
  freeShippingThreshold: z.number().int().min(0).max(MAX_PAISE),
  flatShippingFee: z.number().int().min(0).max(100_000),
  gstRatePercent: z.number().int().min(0).max(28),
  heroHeadline: z.string().trim().min(3).max(80),
  heroSubcopy: z.string().trim().max(240),
  heroImageUrl: imageUrl,
  heroImageAlt: z.string().trim().max(160),
  popularSearches: z
    .array(z.string().trim().min(2).max(40))
    .max(8)
    .transform((s) => [...new Set(s)]),
  supportEmail: z.email("Enter a valid email"),
  supportPhone: z.string().trim().min(6).max(30),
});
export type SettingsInput = z.input<typeof settingsInputSchema>;

// ───────── DTOs ─────────

export interface AdminProductRowDTO {
  id: string;
  slug: string;
  name: string;
  brand: string;
  category: string;
  petType: PetTypeValue;
  isActive: boolean;
  isSample: boolean;
  isFeatured: boolean;
  image: string | null;
  priceFrom: number;
  stock: number;
  stockState: "ok" | "low" | "out";
  variantCount: number;
  soldCount: number;
  updatedAt: string;
}

export interface AdminProductDTO {
  id: string;
  slug: string;
  name: string;
  shortDescription: string;
  description: string;
  petType: PetTypeValue;
  categoryId: string;
  brandId: string;
  specs: { label: string; value: string }[];
  tags: string[];
  isActive: boolean;
  isFeatured: boolean;
  isSample: boolean;
  variants: {
    id: string;
    sku: string;
    label: string;
    options: Record<string, string>;
    price: number;
    mrp: number | null;
    stock: number;
    lowStockThreshold: number;
    isDefault: boolean;
    hasOrders: boolean;
  }[];
  images: { id: string; url: string; alt: string; width: number; height: number }[];
  ratingAvg: number;
  ratingCount: number;
  soldCount: number;
}

export interface AdminCategoryDTO {
  id: string;
  slug: string;
  name: string;
  description: string;
  imageUrl: string;
  imageAlt: string;
  parentId: string | null;
  sortOrder: number;
  showOnHome: boolean;
  homeLabel: string | null;
  productCount: number;
}

export interface AdminBrandDTO {
  id: string;
  slug: string;
  name: string;
  description: string;
  productCount: number;
}

export interface AdminInventoryRowDTO {
  variantId: string;
  sku: string;
  label: string;
  productId: string;
  productName: string;
  productSlug: string;
  image: string | null;
  stock: number;
  lowStockThreshold: number;
  productActive: boolean;
}

export interface AdminPromotionDTO {
  id: string;
  slug: string;
  name: string;
  headline: string;
  subheadline: string;
  discountPercent: number;
  startsAt: string;
  endsAt: string;
  isActive: boolean;
  placement: (typeof PROMOTION_PLACEMENTS)[number];
  scope: (typeof DISCOUNT_SCOPES)[number];
  categoryIds: string[];
  productIds: string[];
  couponId: string | null;
  couponCode: string | null;
  imageUrl: string | null;
  imageAlt: string | null;
  ctaLabel: string;
  ctaHref: string;
  theme: string;
  sortOrder: number;
  status: PromotionStatusValue;
}

export interface AdminCouponDTO {
  id: string;
  code: string;
  description: string;
  type: (typeof COUPON_TYPES)[number];
  value: number;
  minOrder: number;
  maxDiscount: number | null;
  startsAt: string;
  endsAt: string;
  usageLimit: number | null;
  perUserLimit: number | null;
  scope: (typeof DISCOUNT_SCOPES)[number];
  categoryIds: string[];
  productIds: string[];
  isActive: boolean;
  usedCount: number;
  status: PromotionStatusValue;
}

export interface AdminCustomerRef {
  id: string;
  name: string;
  email: string;
}

export interface AdminOrderRowDTO {
  id: string;
  number: string;
  status: OrderStatusValue;
  placedAt: string;
  total: number;
  itemCount: number;
  customer: AdminCustomerRef;
}

export interface AdminOrderDetailDTO extends OrderDetailDTO {
  customer: AdminCustomerRef & { phone: string | null };
  /** The next fulfilment step an admin can move to, if any. */
  nextStatus: OrderStatusValue | null;
  canCancel: boolean;
}

export interface AdminCustomerRowDTO {
  id: string;
  name: string;
  email: string;
  role: "CUSTOMER" | "ADMIN";
  createdAt: string;
  orderCount: number;
  totalSpent: number;
}

export interface AdminCustomerDetailDTO extends AdminCustomerRowDTO {
  phone: string | null;
  addressCount: number;
  reviewCount: number;
  orders: AdminOrderRowDTO[];
}

export interface AdminReviewRowDTO {
  id: string;
  rating: number;
  title: string;
  body: string;
  status: "PUBLISHED" | "HIDDEN";
  author: string;
  authorEmail: string;
  isSample: boolean;
  isVerifiedPurchase: boolean;
  createdAt: string;
  product: { id: string; name: string; slug: string };
}

export interface Kpi {
  value: number;
  previous: number;
  /** Percent change versus the previous period; null when there was nothing to compare with. */
  change: number | null;
}

export interface RevenuePoint {
  /** yyyy-mm-dd (IST) — the day, or the Monday that starts the week. */
  date: string;
  revenue: number;
  orders: number;
}

export interface TopProductDTO {
  productId: string;
  name: string;
  slug: string;
  image: string | null;
  quantity: number;
  revenue: number;
}

export interface AdminOverviewDTO {
  kpis: { revenue: Kpi; orders: Kpi; aov: Kpi; customers: Kpi };
  revenueByDay: RevenuePoint[];
  topProducts: TopProductDTO[];
  lowStock: AdminInventoryRowDTO[];
  recentOrders: AdminOrderRowDTO[];
}

export const REPORT_RANGES = ["7d", "30d", "90d", "365d"] as const;
export type ReportRange = (typeof REPORT_RANGES)[number];

export interface SalesReportDTO {
  range: ReportRange;
  by: "day" | "week";
  buckets: RevenuePoint[];
  byCategory: { category: string; revenue: number; quantity: number }[];
  topProducts: TopProductDTO[];
  totals: { revenue: number; orders: number; aov: number };
}

/** The store settings an admin edits (prices in paise). */
export interface AdminSettingsDTO {
  announcementText: string;
  freeShippingThreshold: number;
  flatShippingFee: number;
  gstRatePercent: number;
  heroHeadline: string;
  heroSubcopy: string;
  heroImageUrl: string;
  heroImageAlt: string;
  popularSearches: string[];
  supportEmail: string;
  supportPhone: string;
  updatedAt: string;
}

export interface UploadResultDTO {
  url: string;
  width: number;
  height: number;
}
