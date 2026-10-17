# Stage 3 — Catalog, Search & Cart Implementation Plan

**Goal:** Shoppers can browse (filters, sort, pages), search with live suggestions, open rich product pages (gallery, variants, delivery estimate, reviews, related), quick-view from cards, and manage a cart with coupons — all priced by the server.

**Architecture:** Listing/search/PDP data come from the Express catalog module (extended filters + facets, search, reviews, delivery estimate). Pages are Server Components reading URL state (`searchParams`/`params`) inside `<Suspense>` with paw skeletons; interactive controls are client islands that update the URL. Coupons are a pure, unit-tested validation module wired into cart pricing.

**Tech Stack:** Next.js 16.4 (Cache Components), React 19.3 `ViewTransition`, TanStack Query, Express, Prisma, Zod, Vitest + Supertest.

**Spec:** `docs/specs/2026-10-10-nestama-design.md` (§6, §9, §10, §11)

## Global Constraints

- **No git commands** until the user asks.
- Server is the only price authority; client prices are display-only. Money in paise.
- URL is the source of truth for listing state (shareable, crawlable pagination links).
- Every async region has loading (skeleton), empty and error states.
- Keyboard: search is an ARIA combobox (↑/↓/Enter/Escape); dialogs trap focus and close on Escape.
- Sample reviews are labelled as sample content (demo honesty).
- Deviation from spec §11: no separate slide-over mini-cart — the toast's "View cart" and the header link go to `/cart` (one cart surface to maintain).

---

### Task 1: Listing API — filters, facets, effective-price filtering
**Files:** `shared/src/schemas.ts` (extend `productListQuerySchema`), `shared/src/catalog.ts` (`ProductListResponse`, `ListingFacets`), `server/src/modules/catalog/listing.ts` (pure filter/sort/facet helpers + tests), `catalog.service.ts`, `server/test/catalog.int.test.ts`.
- Query adds `brand` (comma list), `minPrice`/`maxPrice` (rupees), `rating` (min 1–5), `inStock` (`1`), `onSale` (`1`), `q` (≤ 80 chars).
- Response `ProductListResponse = Paginated<ProductCardDTO> & { facets: { brands: {slug,name,count}[]; categories: {slug,name,count}[]; price: {min,max} } }` (facets computed ignoring their own filter).
- [x] TDD pure `applyListingFilters(cards, meta, query)` + `sortCards` + `buildFacets` (on-sale, price range in rupees→paise, rating floor, in-stock, brand set, stable sort).
- [x] Integration: brand + price + onSale combinations; `q` matches name/brand/tags; facet counts.

### Task 2: Search API + reviews + delivery estimate
**Files:** `server/src/modules/catalog/search.ts`, `server/src/lib/delivery.ts` (+ test), `server/src/modules/catalog/reviews.service.ts`, seed sample reviewers/reviews, routes.
- `GET /search?q=` → `{ products: ProductCardDTO[≤6]; categories: {slug,name}[≤4] }` (case-insensitive name/brand/tags/category match, ranked: name-prefix > name-contains > other).
- `GET /products/:slug/reviews?page=` → `{ summary: { average, count, distribution: Record<1..5, number> }, items: ReviewDTO[], page, totalPages }`.
- `GET /delivery-estimate?pincode=` → `{ pincode, minDays, maxDays, earliest, latest, express: boolean }` via pure `estimateDelivery(pincode, from: Date)` (metro prefixes 11/40/56/60/70/50 → 2–3 days, other valid → 4–6, invalid → 400); dates skip Sundays.
- [x] Seed 6 sample reviewer users + 2–4 published reviews for most products (`isVerifiedPurchase` on some).

### Task 3: Coupons (pure + cart wiring)
**Files:** `server/src/lib/coupons.ts` (+ test), `cart.service.ts`, `cart.routes.ts`, `shared/src/cart.ts`, `server/test/cart.int.test.ts`.
- `evaluateCoupon(coupon, ctx: { now, subtotal, eligibleSubtotal, userRedemptions, totalRedemptions })` → `{ ok: true, discount } | { ok: false, reason: "NOT_FOUND"|"INACTIVE"|"NOT_STARTED"|"EXPIRED"|"MIN_ORDER_NOT_MET"|"NOT_ELIGIBLE"|"USAGE_LIMIT", message }` with friendly messages ("Add ₹X more to use NESTAMA20").
- `POST /cart/coupon {code}` stores the code on the cart (re-validated on every cart read; an invalid stored code is dropped with a `couponNotice`), `DELETE /cart/coupon`.
- [x] TDD all reasons + percent cap + fixed ≤ eligible; integration apply/remove/min-order.

### Task 4: Listing pages
**Files:** `client/src/app/shop/page.tsx`, `client/src/app/c/[slug]/page.tsx`, `client/src/app/offers/page.tsx`, `client/src/components/listing/{ListingView,FilterPanel,SortSelect,ActiveFilters,Pagination,ProductGrid,ListingSkeleton}.tsx`, `client/src/lib/listing-url.ts` (+ test).
- [x] Pure URL helpers: `parseListingParams`, `withParam(params, key, value)` (resets page), `toggleBrand`.
- [x] Desktop sidebar filters, mobile bottom-sheet; sort select; active-filter chips with clear-all; result count; grid 2/3/4 cols; numbered pagination with real links; paw skeleton fallback; empty state with "Clear filters".

### Task 5: Product detail page
**Files:** `client/src/app/products/[slug]/page.tsx`, `client/src/components/pdp/{Gallery,PurchasePanel,VariantPicker,QuantityStepper,DeliveryEstimate,SpecsTable,Reviews,RecentlyViewedTracker}.tsx`, `client/src/lib/recently-viewed.ts`.
- [x] Gallery with thumbnails (keyboard ←/→), hero image in `<ViewTransition name="product-{slug}" share="morph">`; purchase panel: brand, name, rating, price + badge, variant chips (colour swatches when option is Colour), quantity stepper (≤ available), stock line, delivery estimate by pincode (uses the header pincode), Add to cart (`appearance="full"`) + compact `WaggingDogMascot` that wags on add; wishlist; trust row; tabs-free stacked sections: description, specifications, reviews (distribution bars + list, sample label), related products; breadcrumb; `generateMetadata`.
- [x] Recently viewed (localStorage, max 12) tracked here; rail on PDP and home.

### Task 6: Quick view
**Files:** `client/src/components/product/QuickView.tsx`, `ProductCard.tsx` (eye button).
- [x] Focus-trapped dialog fetching `/api/v1/products/:slug` (TanStack Query), compact gallery + variant + qty + add to cart + "View full details"; Escape/overlay close; restores focus.

### Task 7: Animated search
**Files:** `client/src/components/search/AnimatedSearch.tsx` (replaces `HeaderSearch`), `PawLoader.tsx`.
- [x] Combobox: focus opens panel (popular searches from settings + "Trending" products), typing debounces 200 ms and queries `/api/v1/search`, paw loader only while in flight, product thumbnails with price, categories, "See all results for …"; ↑/↓/Enter/Escape; mobile full-width panel.

### Task 8: Cart page
**Files:** `client/src/app/cart/page.tsx`, `client/src/components/cart/{CartView,CartLine,CouponForm,OrderSummary,FreeShippingProgress}.tsx`, `client/src/components/animations/EmptyCartIllustration.tsx`, `cart-client.ts` (coupon mutations).
- [x] Lines with image/name/variant/unit + struck price, quantity stepper (optimistic), remove (with toast Undo), stock warnings; coupon form with specific messages; summary (subtotal, savings, coupon, shipping, GST included, total) and the yarn-thread free-shipping progress; empty state puppy + "Your cart is waiting for something pawsome!" + "Explore Products"; checkout CTA (Stage 4 target).

### Task 9: Verification
- [x] All tests/typecheck/lint/build; browser: filters + sort + pagination via URL, search keyboard flow, PDP variant/qty/add + dog wag + morph from card, quick view, cart qty/remove/coupon/empty state; 375/768/desktop.

---

## Completion notes (2026-10-14)

All tasks done and verified: tests (shared 4, client 19, server 76 incl. DB integration), typecheck, lint, Prettier, `next build` (94 pages; product pages prerendered static). Browser-checked in dev and in a production `next start`, at 375 / 768 / desktop.

Deviations and decisions made during the stage:

- **URL data behind Suspense.** `/products/[slug]` and `/c/[slug]` read `params` inside a `<Suspense>` boundary with page skeletons (Next 16.4 instant-navigation rule; it applies even with `generateStaticParams`). Product cards link with `prefetch={true}`, so in production the per-link prefetch resolves the cached product before the click: no skeleton, and the card→hero `product-{slug}` morph still pairs (verified: name present in the old and new view-transition states, transition finished). Dev never prefetches, so dev shows the skeleton and no morph.
- **Quick view** is one native modal `<dialog>` (focus trap, Escape, focus restore to the eye button) shared via `QuickViewProvider`. It is a bottom sheet on phones and a centred card from `md` up. It closes itself when Add to cart is pressed, so the photo's flight to the header cart is visible (the top layer would otherwise hide it). `VariantPicker` / `QuantityStepper` were extracted and are shared with the product page.
- **Search** popular chips come from store settings; "Trending now" shows the 4 best sellers.
- **Brand logo images** are `unoptimized` (pre-sized static WebP; the custom loader only resizes CDN images).
- **Intro film (owner request, 2026-10-13):** plays the whole film full screen, ends on the logo frame, and flies the logo pieces into the header logo. See `docs/brand-assets.md`.
