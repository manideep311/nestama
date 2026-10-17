# Stage 1 — Foundation + Storefront Shell Implementation Plan

**Goal:** A running pnpm workspace in which the Express API serves a seeded sample catalog from Supabase Postgres and the Next.js client renders the full NESTAMA homepage from that API.

**Architecture:** `client/` (Next.js 16, App Router) renders catalog pages as Server Components that fetch from `server/` (Express 5) over `API_URL`; browser calls go through a Next.js `/api` rewrite. `shared/` holds Zod schemas, DTO types and money helpers consumed as TypeScript source by both sides. Pricing is a pure server module.

**Tech Stack:** pnpm 11 workspaces, TypeScript (JS compiler line), Next.js 16.4, React 19.3, Tailwind 4.3, Motion 14, Express 5.3, Prisma 7.10 + `@prisma/adapter-pg`, Zod 4, Vitest + Supertest.

**Spec:** `docs/specs/2026-10-10-nestama-design.md`

## Global Constraints

- **No git commands** of any kind until the user explicitly asks (user instruction). `create-next-app` runs with `--disable-git`. No commit steps.
- Money is integer paise everywhere; format only at the edge with `formatINR`.
- Server is the only place prices are computed; client prices are display-only.
- Colors: forest `#123D2F`, orange `#FF571F`, cream `#FFF8EF`, white `#FFFFFF`, charcoal `#202522`, sage `#E5EFE4`, peach `#FFE3D2`; body text contrast ≥ 4.5:1.
- Fonts: Bricolage Grotesque (display), Manrope (body) via `next/font/google`.
- Sample products use fictional brands and `isSample: true`; a sitewide "Portfolio demo" ribbon is shown.
- Secrets live only in `server/.env` / `client/.env.local` (git-ignored); `.env.example` files document them.
- ESM everywhere (`"type": "module"`); `moduleResolution: "Bundler"`.
- Every animation respects `prefers-reduced-motion` (Stage 1 only has hover/press transitions).

---

## File map (Stage 1)

```
package.json, pnpm-workspace.yaml, tsconfig.base.json, README.md
shared/
  package.json, tsconfig.json, vitest.config.ts
  src/index.ts            re-exports
  src/money.ts            formatINR, rupeesToPaise, paiseToRupees, roundToRupee
  src/money.test.ts
  src/catalog.ts          PetType, ProductCardDTO, ProductDetailDTO, CategoryDTO, PromotionDTO, HomeDTO, StoreSettingsPublicDTO, Paginated<T>
  src/schemas.ts          productListQuerySchema, newsletterSchema
server/
  package.json, tsconfig.json, vitest.config.ts, prisma.config.ts, .env.example
  prisma/schema.prisma
  prisma/seed.ts
  prisma/seed-data/{categories,brands,products,promotions,coupons,settings,images}.ts
  src/server.ts           listen()
  src/app.ts              createApp(): Express
  src/config/env.ts       env (Zod-parsed)
  src/lib/prisma.ts       prisma singleton (PrismaPg adapter)
  src/lib/errors.ts       AppError, notFoundHandler, errorHandler
  src/lib/validate.ts     validate({ body?, query?, params? })
  src/lib/pricing.ts      selectBestPromotion, priceVariant
  src/lib/pricing.test.ts
  src/modules/catalog/catalog.routes.ts
  src/modules/catalog/catalog.controller.ts
  src/modules/catalog/catalog.service.ts
  src/modules/catalog/product-mapper.ts   toProductCardDTO, toProductDetailDTO
  src/modules/catalog/product-mapper.test.ts
  src/modules/home/home.routes.ts, home.service.ts
  src/modules/newsletter/newsletter.routes.ts
  test/app.test.ts        health, 404, validation error shape
  test/catalog.int.test.ts (DB) /home, /categories, /products, /products/:slug
client/
  (create-next-app output, src/ dir, App Router, Tailwind v4)
  next.config.ts          rewrites /api → API_URL, images.remotePatterns, transpilePackages
  .env.example
  src/app/globals.css     @theme tokens, base styles, paw pattern
  src/app/layout.tsx      fonts, ribbon, announcement, header, footer
  src/app/page.tsx        homepage (Server Component)
  src/lib/api.ts          apiGet<T>(path, init?)
  src/lib/cn.ts
  src/components/ui/{Button,Badge,Container,SectionHeading,Logo,PawIcon,Rating}.tsx
  src/components/layout/{DemoRibbon,AnnouncementBar,Header,CategoryNav,MobileMenu,HeaderSearch,Footer,NewsletterForm}.tsx
  src/components/product/{ProductCard,PriceTag,StockBadge,ProductRail,DealsCarousel}.tsx
  src/components/home/{Hero,HeroPromoCard,TrustBadges,CategoryGrid,CategoryCard,CampaignCards,RecommendedForPet,TrustSection}.tsx
  scripts/contrast.mjs    WCAG contrast check of palette pairs
```

---

### Task 1: Workspace + shared money helpers

**Files:** Create root `package.json`, `pnpm-workspace.yaml`, `tsconfig.base.json`; `shared/package.json`, `shared/tsconfig.json`, `shared/vitest.config.ts`, `shared/src/money.ts`, `shared/src/money.test.ts`, `shared/src/index.ts`.

**Interfaces — Produces:**
- `formatINR(paise: number, opts?: { decimals?: boolean }): string` → `"₹1,299"` (Indian digit grouping, no decimals by default; `decimals: true` → `"₹1,299.50"`).
- `rupeesToPaise(rupees: number): number`, `paiseToRupees(paise: number): number`.
- `roundToRupee(paise: number): number` → nearest multiple of 100, halves round up.

- [x] **Step 1:** Root `package.json` (`private`, `packageManager: pnpm@11.x`, scripts `dev` = `concurrently -n server,client -c green,magenta "pnpm --filter server dev" "pnpm --filter client dev"`, `test` = `pnpm -r test`, `typecheck` = `pnpm -r typecheck`), `pnpm-workspace.yaml` listing `client`, `server`, `shared` (+ build-script approvals for `prisma`, `@prisma/engines`, `esbuild`, `sharp`), `tsconfig.base.json` (`strict`, `target ES2023`, `module ESNext`, `moduleResolution Bundler`, `skipLibCheck`, `noUncheckedIndexedAccess`).
- [x] **Step 2: Write failing tests** `shared/src/money.test.ts`:

```ts
import { describe, it, expect } from "vitest";
import { formatINR, rupeesToPaise, paiseToRupees, roundToRupee } from "./money";

describe("money", () => {
  it("formats paise as Indian rupees with lakh grouping", () => {
    expect(formatINR(129900)).toBe("₹1,299");
    expect(formatINR(12345600)).toBe("₹1,23,456");
    expect(formatINR(0)).toBe("₹0");
  });
  it("optionally shows paise", () => {
    expect(formatINR(129950, { decimals: true })).toBe("₹1,299.50");
  });
  it("converts between rupees and paise without float drift", () => {
    expect(rupeesToPaise(19.99)).toBe(1999);
    expect(paiseToRupees(1999)).toBe(19.99);
  });
  it("rounds to the nearest whole rupee", () => {
    expect(roundToRupee(110415)).toBe(110400);
    expect(roundToRupee(110450)).toBe(110500);
    expect(roundToRupee(110449)).toBe(110400);
  });
});
```

- [x] **Step 3:** Run `pnpm --filter shared test` → FAIL (module not found).
- [x] **Step 4: Implement** `shared/src/money.ts`:

```ts
const inr0 = new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR", maximumFractionDigits: 0, minimumFractionDigits: 0 });
const inr2 = new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR", maximumFractionDigits: 2, minimumFractionDigits: 2 });

export function formatINR(paise: number, opts: { decimals?: boolean } = {}): string {
  const rupees = paise / 100;
  return (opts.decimals ? inr2 : inr0).format(rupees);
}
export const rupeesToPaise = (rupees: number): number => Math.round(rupees * 100);
export const paiseToRupees = (paise: number): number => paise / 100;
export const roundToRupee = (paise: number): number => Math.round(paise / 100) * 100;
```

- [x] **Step 5:** Run `pnpm --filter shared test` → PASS. (If `Intl` emits a non-breaking space or different symbol on this Node build, normalise in `formatINR` and keep the tests as written.)

---

### Task 2: Server skeleton (env, app, errors, validation)

**Files:** `server/package.json`, `server/tsconfig.json`, `server/vitest.config.ts`, `server/.env.example`, `server/src/config/env.ts`, `server/src/lib/errors.ts`, `server/src/lib/validate.ts`, `server/src/app.ts`, `server/src/server.ts`, `server/test/app.test.ts`.

**Interfaces — Produces:**
- `env` object: `{ NODE_ENV, PORT, CLIENT_ORIGIN, DATABASE_URL, DIRECT_URL }` (others added in later stages). DB vars are optional until Task 4 so the skeleton runs without them.
- `class AppError extends Error { constructor(code: string, status: number, message: string, details?: unknown) }`.
- `validate(schemas: { body?: ZodType; query?: ZodType; params?: ZodType })` → middleware; parsed values stored on `res.locals.body/query/params`.
- `createApp(): Express` — helmet, cors (`CLIENT_ORIGIN`, credentials), `express.json({ limit: "1mb" })`, cookie-parser, `GET /api/v1/health → { ok: true }`, routers, `notFoundHandler`, `errorHandler`.
- Error response shape: `{ error: { code: string, message: string, details?: unknown } }`.

- [x] **Step 1: Failing tests** `server/test/app.test.ts`:

```ts
import { describe, it, expect } from "vitest";
import request from "supertest";
import express from "express";
import { z } from "zod";
import { createApp } from "../src/app";
import { validate } from "../src/lib/validate";
import { errorHandler } from "../src/lib/errors";

describe("app skeleton", () => {
  it("serves health", async () => {
    const res = await request(createApp()).get("/api/v1/health");
    expect(res.status).toBe(200);
    expect(res.body).toEqual({ ok: true });
  });
  it("returns JSON 404 for unknown routes", async () => {
    const res = await request(createApp()).get("/api/v1/nope");
    expect(res.status).toBe(404);
    expect(res.body.error.code).toBe("NOT_FOUND");
  });
  it("returns 400 VALIDATION_ERROR with field details", async () => {
    const app = express();
    app.get("/t", validate({ query: z.object({ page: z.coerce.number().int().min(1) }) }), (_req, res) => res.json(res.locals.query));
    app.use(errorHandler);
    const bad = await request(app).get("/t?page=0");
    expect(bad.status).toBe(400);
    expect(bad.body.error.code).toBe("VALIDATION_ERROR");
    const ok = await request(app).get("/t?page=2");
    expect(ok.body).toEqual({ page: 2 });
  });
});
```

- [x] **Step 2:** `pnpm --filter server test` → FAIL.
- [x] **Step 3: Implement** env (Zod), errors (`AppError`, `notFoundHandler` → `AppError("NOT_FOUND",404,"Route not found")`, `errorHandler` mapping `ZodError` → 400, `AppError` → its status, else 500 `INTERNAL` with server-side `console.error`), `validate`, `createApp`, `server.ts` (`createApp().listen(env.PORT)` with a startup log). Scripts: `dev` = `tsx watch src/server.ts`, `test` = `vitest run`, `typecheck` = `tsc --noEmit`.
- [x] **Step 4:** `pnpm --filter server test` → PASS; `pnpm --filter server dev` and `curl localhost:4000/api/v1/health` → `{"ok":true}`.

---

### Task 3: Pricing core (pure, TDD)

**Files:** `server/src/lib/pricing.ts`, `server/src/lib/pricing.test.ts`.

**Interfaces — Produces:**

```ts
export type PromotionScope = "ALL" | "CATEGORIES" | "PRODUCTS";
export interface PromotionRule {
  id: string; slug: string; name: string;
  discountPercent: number; startsAt: Date; endsAt: Date; isActive: boolean;
  scope: PromotionScope; categoryIds: string[]; productIds: string[];
}
export interface PricingTarget { productId: string; categoryId: string; categoryAncestorIds: string[] }
export interface VariantPriceInput { price: number; mrp: number | null }
export interface PricedVariant {
  price: number;            // regular selling price (paise)
  salePrice: number;        // what the customer pays now
  referencePrice: number | null; // strike-through price, null when none
  discountPercent: number;  // badge %, 0 when none
  promotion: { id: string; slug: string; name: string; endsAt: Date } | null;
}
export function isPromotionLive(p: PromotionRule, now: Date): boolean;
export function promotionApplies(p: PromotionRule, t: PricingTarget): boolean;
export function selectBestPromotion(promos: PromotionRule[], t: PricingTarget, now: Date): PromotionRule | null;
export function priceVariant(v: VariantPriceInput, promo: PromotionRule | null): PricedVariant;
```

- [x] **Step 1: Failing tests** `server/src/lib/pricing.test.ts`:

```ts
import { describe, it, expect } from "vitest";
import { isPromotionLive, promotionApplies, selectBestPromotion, priceVariant, type PromotionRule, type PricingTarget } from "./pricing";

const now = new Date("2026-10-10T12:00:00Z");
const promo = (o: Partial<PromotionRule> = {}): PromotionRule => ({
  id: "p1", slug: "toys", name: "Toys", discountPercent: 15,
  startsAt: new Date("2026-10-01T00:00:00Z"), endsAt: new Date("2026-10-20T00:00:00Z"),
  isActive: true, scope: "ALL", categoryIds: [], productIds: [], ...o,
});
const toy: PricingTarget = { productId: "prod1", categoryId: "toys", categoryAncestorIds: [] };
const collar: PricingTarget = { productId: "prod2", categoryId: "collars", categoryAncestorIds: ["accessories"] };

describe("isPromotionLive", () => {
  it("is live inside [startsAt, endsAt)", () => expect(isPromotionLive(promo(), now)).toBe(true));
  it("is not live before start, at/after end, or when inactive", () => {
    expect(isPromotionLive(promo({ startsAt: new Date("2026-10-11T00:00:00Z") }), now)).toBe(false);
    expect(isPromotionLive(promo({ endsAt: now }), now)).toBe(false);
    expect(isPromotionLive(promo({ isActive: false }), now)).toBe(false);
  });
});

describe("promotionApplies", () => {
  it("ALL applies to everything", () => expect(promotionApplies(promo(), toy)).toBe(true));
  it("CATEGORIES matches the product category or an ancestor", () => {
    expect(promotionApplies(promo({ scope: "CATEGORIES", categoryIds: ["toys"] }), toy)).toBe(true);
    expect(promotionApplies(promo({ scope: "CATEGORIES", categoryIds: ["accessories"] }), collar)).toBe(true);
    expect(promotionApplies(promo({ scope: "CATEGORIES", categoryIds: ["beds"] }), toy)).toBe(false);
  });
  it("PRODUCTS matches listed product ids", () => {
    expect(promotionApplies(promo({ scope: "PRODUCTS", productIds: ["prod1"] }), toy)).toBe(true);
    expect(promotionApplies(promo({ scope: "PRODUCTS", productIds: ["prod1"] }), collar)).toBe(false);
  });
});

describe("selectBestPromotion", () => {
  it("picks the highest live applicable percent and never stacks", () => {
    const best = selectBestPromotion(
      [promo({ id: "a", discountPercent: 15 }), promo({ id: "b", discountPercent: 25, scope: "PRODUCTS", productIds: ["prod1"] }), promo({ id: "c", discountPercent: 40, isActive: false })],
      toy, now);
    expect(best?.id).toBe("b");
  });
  it("returns null when nothing applies", () => {
    expect(selectBestPromotion([promo({ scope: "PRODUCTS", productIds: ["x"] })], toy, now)).toBeNull();
  });
});

describe("priceVariant", () => {
  it("applies the promotion and rounds to whole rupees", () => {
    const r = priceVariant({ price: 129900, mrp: 149900 }, promo({ discountPercent: 15 }));
    expect(r.salePrice).toBe(110400);        // 1104.15 → 1104
    expect(r.referencePrice).toBe(129900);   // strike-through is the regular price when promoted
    expect(r.discountPercent).toBe(15);
    expect(r.promotion?.slug).toBe("toys");
  });
  it("falls back to MRP as the reference when no promotion", () => {
    const r = priceVariant({ price: 79900, mrp: 99900 }, null);
    expect(r.salePrice).toBe(79900);
    expect(r.referencePrice).toBe(99900);
    expect(r.discountPercent).toBe(20);
    expect(r.promotion).toBeNull();
  });
  it("has no reference or badge when price equals MRP or MRP missing", () => {
    expect(priceVariant({ price: 50000, mrp: 50000 }, null)).toMatchObject({ referencePrice: null, discountPercent: 0 });
    expect(priceVariant({ price: 50000, mrp: null }, null)).toMatchObject({ referencePrice: null, discountPercent: 0 });
  });
});
```

- [x] **Step 2:** Run → FAIL.
- [x] **Step 3: Implement** using `roundToRupee` from `@nestama/shared`. `discountPercent` for the badge = `Math.round((1 - salePrice / referencePrice) * 100)` when a reference exists.
- [x] **Step 4:** Run → PASS.

---

### Task 4: Prisma schema + database connection (user sets up Supabase here)

**Files:** `server/prisma/schema.prisma`, `server/prisma.config.ts`, `server/src/lib/prisma.ts`, `server/.env.example`.

- [x] **Step 1:** Write the full schema from spec §5 (all models and enums including Better Auth's `User/Session/Account/Verification` with `role` on `User`), `generator client { provider = "prisma-client"; output = "../src/generated/prisma" }`, indexes on `Product(slug)`, `Product(categoryId, isActive)`, `ProductVariant(productId)`, `Promotion(isActive, startsAt, endsAt)`, `Order(userId, placedAt)`.
- [x] **Step 2:** `prisma.config.ts` (schema path, migrations path, seed `tsx prisma/seed.ts`, datasource URL = `DIRECT_URL`). `src/lib/prisma.ts` exports a singleton `PrismaClient({ adapter: new PrismaPg({ connectionString: env.DATABASE_URL }) })`.
- [x] **Step 3:** `pnpm --filter server exec prisma validate` and `prisma generate` → succeed.
- [x] **Step 4: Give the user Supabase setup directions** (create project, region Mumbai, copy the Session-pooler and Transaction-pooler URLs, paste into `server/.env`). Continue with Tasks 7–9 (client work) while waiting.
- [x] **Step 5:** When `server/.env` has URLs: `prisma migrate dev --name init` → migration applied.

---

### Task 5: Seed data (sample catalog with Unsplash photography)

**Files:** `server/prisma/seed.ts`, `server/prisma/seed-data/*.ts`.

- [x] **Step 1: Image research.** Query Unsplash's public search JSON (`/napi/search/photos?query=…&per_page=30`) for each product type, category, hero (golden retriever + kitten), and campaign; keep only free photos (`premium === false`, `plus === false`); record `id`, `alt_description`, `width`, `height` in `seed-data/images.ts`. Verify every chosen URL returns HTTP 200 and spot-check by viewing a contact sheet.
- [x] **Step 2:** Categories (10 home categories + Accessories parent with Collars & Leashes, Pet Clothing, Bowls & Feeders), 8 fictional brands, `StoreSettings` defaults (₹999 free-shipping threshold, ₹79 fee, 18% GST, hero copy from the brief, popular searches).
- [x] **Step 3:** ~60 products: name, slug, description (2–3 sentences, believable), petType, category, brand, specs (4–6 rows), tags, 1–3 images, 1–4 variants (sku, label, options, price, mrp, stock including a few low/zero stock), ratingAvg/ratingCount/soldCount, `isSample: true`, staggered `publishedAt` (for New Arrivals), some `isFeatured`.
- [x] **Step 4:** Promotions with windows relative to seed time: Toys 15% (Toys category, CAMPAIGN), Beds 20% (Beds & Furniture, CAMPAIGN), Grooming 15% (Grooming, CAMPAIGN), Healthy Pets 25% (selected Health products, CAMPAIGN), PAW-SOME DEALS 25% (selected deal products, COUNTDOWN_BANNER, ends in 3 days 7 hours) + a HERO_CARD promotion pointing at the same deal; coupon `NESTAMA20` (PERCENT 20, minOrder ₹999, maxDiscount ₹500, same window).
- [x] **Step 5:** `seed.ts` is idempotent (upsert by slug/code/sku; wipes and re-creates product images/variants for sample products). Run `pnpm --filter server exec prisma db seed` twice → no errors, counts stable.

---

### Task 6: Catalog + home API

**Files:** `shared/src/catalog.ts`, `shared/src/schemas.ts`, `server/src/modules/catalog/*`, `server/src/modules/home/*`, `server/src/modules/newsletter/newsletter.routes.ts`, `server/test/catalog.int.test.ts`.

**Interfaces — Produces (shared DTOs):**

```ts
export type PetType = "DOG" | "CAT" | "BOTH";
export interface ImageDTO { url: string; alt: string; width: number; height: number }
export interface PriceDTO { price: number; salePrice: number; referencePrice: number | null; discountPercent: number; promotion: { slug: string; name: string; endsAt: string } | null }
export interface ProductCardDTO {
  id: string; slug: string; name: string; brand: string; petType: PetType;
  category: { slug: string; name: string };
  image: ImageDTO; hoverImage: ImageDTO | null;
  defaultVariantId: string; pricing: PriceDTO;          // pricing of the default variant
  ratingAvg: number; ratingCount: number;
  stock: "IN_STOCK" | "LOW_STOCK" | "OUT_OF_STOCK"; isSample: boolean;
}
export interface CategoryDTO { id: string; slug: string; name: string; description: string; image: ImageDTO; parentSlug: string | null; productCount: number }
export interface PromotionDTO { id: string; slug: string; name: string; headline: string; subheadline: string; discountPercent: number; startsAt: string; endsAt: string; placement: "HERO_CARD" | "COUNTDOWN_BANNER" | "CAMPAIGN" | "NONE"; couponCode: string | null; image: ImageDTO | null; ctaLabel: string; ctaHref: string; theme: string }
export interface StoreSettingsPublicDTO { announcementText: string; freeShippingThreshold: number; flatShippingFee: number; gstRatePercent: number; heroHeadline: string; heroSubcopy: string; popularSearches: string[]; supportEmail: string; supportPhone: string }
export interface HomeDTO {
  settings: StoreSettingsPublicDTO; serverTime: string;
  heroPromotion: PromotionDTO | null; countdownPromotion: PromotionDTO | null; campaigns: PromotionDTO[];
  categories: CategoryDTO[]; deals: ProductCardDTO[]; bestSellers: ProductCardDTO[]; newArrivals: ProductCardDTO[];
  recommended: { DOG: ProductCardDTO[]; CAT: ProductCardDTO[] }; limitedTime: ProductCardDTO[];
}
export interface Paginated<T> { items: T[]; page: number; pageSize: number; total: number; totalPages: number }
```

`productListQuerySchema` (Zod): `pet?: "dog"|"cat"`, `category?: string`, `sort?: "featured"|"price-asc"|"price-desc"|"rating"|"newest"|"bestselling"` (default `featured`), `page` (≥1, default 1), `pageSize` (1–48, default 24). (Brand/price/rating/stock/onSale/q filters are added in Stage 3.)

Server: `toProductCardDTO(product, promos, now)` in `product-mapper.ts`; stock status `OUT_OF_STOCK` when all variants are 0, `LOW_STOCK` when the default variant's stock ≤ its threshold.

- [x] **Step 1: Failing unit tests** `product-mapper.test.ts` — given a product fixture with two images, two variants (default stock 3, threshold 5) and a live 15% category promotion: `pricing.salePrice` equals `priceVariant` output, `hoverImage` is the second image, `stock === "LOW_STOCK"`; with all variants at 0 → `OUT_OF_STOCK`.
- [x] **Step 2:** Implement mapper → PASS.
- [x] **Step 3: Failing integration tests** `catalog.int.test.ts` (runs against the seeded DB; skipped automatically when `DATABASE_URL` is unset): `GET /api/v1/home` returns ≥ 8 categories, ≥ 4 campaigns, a countdown promotion with a future `endsAt`, ≥ 6 deals; `GET /api/v1/products?pet=dog&sort=price-asc` returns ascending `pricing.salePrice` and only DOG/BOTH products; `GET /api/v1/products?page=0` → 400; `GET /api/v1/products/<seeded slug>` returns variants and images; unknown slug → 404 `NOT_FOUND`.
- [x] **Step 4:** Implement services/controllers/routes; `price-asc/desc` sorts on effective sale price (computed in the service after loading candidates, then paginated — catalog size is small; documented as a known scaling limit). `POST /api/v1/newsletter` with `newsletterSchema` (email) → 201, duplicate → 200.
- [x] **Step 5:** Run all server tests → PASS.

---

### Task 7: Client scaffold + design tokens

**Files:** `client/*` from `create-next-app@16.4.0 client --ts --tailwind --app --src-dir --eslint --import-alias "@/*" --use-pnpm --disable-git --skip-install`, then `next.config.ts`, `.env.example`, `src/app/globals.css`, `src/lib/api.ts`, `src/lib/cn.ts`, `src/components/ui/*`, `scripts/contrast.mjs`.

**Interfaces — Produces:**
- `apiGet<T>(path: string, init?: { cookie?: string; revalidate?: number }): Promise<T>` — server-side fetch to `${API_URL}/api/v1${path}`; throws `ApiError(status, code, message)`.
- UI primitives: `<Button variant="primary|accent|outline|ghost" size="sm|md|lg" asChild?>`, `<Badge tone="orange|forest|sage|peach">`, `<Container>`, `<SectionHeading eyebrow title action?>`, `<Logo withTagline?>`, `<PawIcon className>`, `<Rating value count size>`.
- Tailwind tokens: `bg-forest`, `text-charcoal`, `bg-cream`, `bg-sage`, `bg-peach`, `bg-orange`, `text-orange-ink`, `font-display`, `font-sans`, radii, shadows `shadow-card`, `shadow-lift`, motion durations.

- [x] **Step 1:** Scaffold, add `@nestama/shared` workspace dependency, `transpilePackages`, rewrites, `images.remotePatterns` for `images.unsplash.com`, `res.cloudinary.com`, `localhost:4000`.
- [x] **Step 2:** `scripts/contrast.mjs` computes WCAG ratios for: charcoal/cream, charcoal/white, cream/forest, white/forest, charcoal/orange, white/orange, orange-ink/white, orange-ink/cream, forest/sage, charcoal/peach. Choose `orange-ink` as the lightest orange that hits ≥ 4.5:1 on cream. Run → all text pairs used for normal text ≥ 4.5.
- [x] **Step 3:** Tokens, fonts (`Bricolage_Grotesque`, `Manrope` via `next/font/google`, CSS variables), base layer (cream body, charcoal text, focus-visible ring, selection color, `prefers-reduced-motion` reset), paw pattern utility.
- [x] **Step 4:** UI primitives. `pnpm --filter client build` → succeeds.

---

### Task 8: Layout shell (ribbon, announcement, header, footer)

**Files:** `src/components/layout/*`, `src/app/layout.tsx`.

- [x] **Step 1:** `DemoRibbon` (thin forest bar, dismiss stored in `localStorage`, rendered visible by default on the server). `AnnouncementBar` (free shipping above `formatINR(settings.freeShippingThreshold)`, current offer + coupon chip from countdown promotion, delivery pincode selector — popover with 6-digit validation, stored in `localStorage`; rotates messages on small screens with a fade, static under reduced motion).
- [x] **Step 2:** `Header` — sticky, cream/blur background, shadow on scroll; row 1: logo + tagline, search input (`HeaderSearch`: submits to `/shop?q=` — full animated search arrives in Stage 3), account, wishlist, cart (count badge = 0 until Stage 3); row 2: `CategoryNav` (Dogs → `/shop?pet=dog`, Cats → `/shop?pet=cat`, Food → `/c/food-treats`, Accessories → `/c/accessories`, Toys → `/c/toys`, Grooming → `/c/grooming`, Beds & Furniture → `/c/beds-furniture`, Health & Wellness → `/c/health-wellness`, Travel → `/c/travel`, Offers → `/offers` in orange-ink). Mobile: hamburger → `MobileMenu` drawer (focus trap, Escape, `aria-expanded`), search moves below the logo row.
- [x] **Step 3:** `Footer` — forest background with cream text, columns: Shop, Customer Service (shipping & returns, FAQs, track order, contact), About NESTAMA, contact details; `NewsletterForm` (client, POST `/api/v1/newsletter`, success/error states); social links (Instagram, Facebook, YouTube, X — icon buttons with labels); payment marks (UPI, Visa, Mastercard, RuPay, Netbanking as simple text/SVG chips); legal line with the demo disclaimer.
- [x] **Step 4:** Verify at 375/768/1280 in the browser: no horizontal scroll, sticky header works, drawer keyboard-operable.

---

### Task 9: Product card family

**Files:** `src/components/product/{ProductCard,PriceTag,StockBadge,ProductRail,DealsCarousel}.tsx`.

- [x] **Step 1:** `PriceTag({ pricing, size })` — sale price bold charcoal; reference price struck through in muted text; discount badge (orange fill, charcoal text). Screen-reader text: "Price ₹1,104, was ₹1,299, 15% off".
- [x] **Step 2:** `ProductCard({ product, priority? })` — `article` with `rounded-3xl` white card, 1:1 image (`next/image`, `sizes`), hover image crossfade on pointer devices, discount badge top-left, wishlist heart button top-right (visual only in Stage 1; `aria-label="Save {name} to favorites"`), brand + name (2-line clamp), `Rating`, `PriceTag`, `StockBadge`, "Add to cart" button (disabled with "Sold out" when out of stock). The whole card is a link to `/products/{slug}` via a stretched link on the title so inner buttons remain separately focusable. Hover: lift `-translate-y-1` + `shadow-lift`; touch: press scale.
- [x] **Step 3:** `ProductRail({ title, eyebrow, products, href })` grid on desktop / horizontal scroll-snap on mobile. `DealsCarousel({ products })` horizontal scroll-snap with prev/next buttons (`aria-controls`, disabled at ends), keyboard scroll, edge fade masks.

---

### Task 10: Homepage sections

**Files:** `src/components/home/*`, `src/app/page.tsx`.

- [x] **Step 1:** `Hero` — two-column on desktop: left: eyebrow, H1 "Happy Pets. Happier Lives." (font-display, 48–72px), supporting copy, buttons Shop Now (`/shop`) and Explore Categories (`#categories`), `TrustBadges` (Quality Products, Free Shipping, Trusted Brands, Loved by Pet Parents); right: lifestyle photo (golden retriever + kitten, `priority`) with rounded mask and paw motif, overlapped by `HeroPromoCard` (promotion headline, % badge, coupon chip, end date text — live countdown is added in Stage 2, "Shop Deals" CTA). Stacks on mobile with image first-cropped.
- [x] **Step 2:** `CategoryGrid` + `CategoryCard` — 10 circular thumbnails (Dog Essentials → `/shop?pet=dog`, Cat Essentials → `/shop?pet=cat`, then categories); hover/focus: image `scale-[1.06]`, paw slides in, label → orange-ink; touch press feedback. 2 columns mobile → 5 desktop.
- [x] **Step 3:** `CampaignCards` — four cards from `campaigns` (image, headline, % badge from `discountPercent`, CTA), alternating sage/peach/cream gradient themes.
- [x] **Step 4:** Sections in order: Deals of the Day (`DealsCarousel`), Best Sellers, New Arrivals, `RecommendedForPet` (client Dog/Cat segmented toggle, `role="tablist"`), Limited-Time Offers (hidden when empty), `TrustSection` (6 items with icons). (Countdown banner component lands in Stage 2; Recently Viewed lands in Stage 3 with the PDP.)
- [x] **Step 5:** `page.tsx` fetches `apiGet<HomeDTO>("/home", { revalidate: 60 })`; shows a friendly error block with retry link if the API is down.

---

### Task 11: Stage 1 verification

- [x] **Step 1:** `pnpm test` (all workspaces) → PASS; `pnpm typecheck` → clean; `pnpm --filter client build` → success.
- [x] **Step 2:** Run `pnpm dev`; in the browser check the homepage at 375, 768 and 1280 widths: all sections render with real seeded data and images, no console errors, no horizontal scroll, sticky header, mobile drawer, keyboard tab order reaches every control with a visible focus ring.
- [x] **Step 3:** Fix any issues found, re-verify, then report Stage 1 results to the user.
