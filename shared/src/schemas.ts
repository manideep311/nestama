import { z } from "./zod";

export const productSortValues = ["featured", "price-asc", "price-desc", "rating", "newest", "bestselling"] as const;
export type ProductSort = (typeof productSortValues)[number];

/** "a,b,c" → ["a","b","c"] (trimmed, de-duplicated). */
const csvList = z
  .string()
  .trim()
  .transform((s) => [
    ...new Set(
      s
        .split(",")
        .map((x) => x.trim().toLowerCase())
        .filter(Boolean),
    ),
  ])
  .pipe(z.array(z.string().max(60)).max(20));

/** "1" / "true" switches. */
const flag = z
  .enum(["1", "true"])
  .transform(() => true as const)
  .optional();

/** Query for GET /products. Prices are in whole rupees (what shoppers type), converted to paise on the server. */
export const productListQuerySchema = z.object({
  pet: z.enum(["dog", "cat"]).optional(),
  category: z.string().trim().min(1).max(80).optional(),
  brand: csvList.optional(),
  minPrice: z.coerce.number().int().min(0).max(1_000_000).optional(),
  maxPrice: z.coerce.number().int().min(0).max(1_000_000).optional(),
  rating: z.coerce.number().int().min(1).max(5).optional(),
  inStock: flag,
  onSale: flag,
  q: z.string().trim().min(1).max(80).optional(),
  sort: z.enum(productSortValues).default("featured"),
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(48).default(24),
});
export type ProductListQuery = z.infer<typeof productListQuerySchema>;

export const searchQuerySchema = z.object({ q: z.string().trim().min(1).max(80) });

export const newsletterSchema = z.object({
  email: z.string().trim().toLowerCase().email("Enter a valid email address").max(254),
});
export type NewsletterInput = z.infer<typeof newsletterSchema>;

export const slugParamSchema = z.object({
  slug: z
    .string()
    .trim()
    .min(1)
    .max(120)
    .regex(/^[a-z0-9-]+$/, "Invalid slug"),
});
