# NESTAMA — Design Spec

**Tagline:** Your True Friend
**Date:** 2026-10-10
**Type:** Portfolio project — production-quality pet-accessories ecommerce site with a demo payment gateway.
**Source brief:** the original NESTAMA brief (visual identity, animations, homepage, PLP/PDP, cart/checkout/accounts, admin, stack, quality bar, six-stage build order). This spec records the decisions made on top of that brief; where the brief is specific and this spec is silent, the brief governs.

---

## 1. Goals and non-goals

**Goals**
- A storefront that looks and behaves like a real premium pet brand: polished UI, purposeful pet-themed micro-animations, fully working shopping flows.
- A separate **client** (Next.js) and **server** (Express API). The server is the only authority on prices, stock, coupons, payments, orders and permissions.
- Admin can change promotions, coupons, prices, inventory, homepage content and order fulfilment without code changes.
- Fast, accessible, responsive, reduced-motion aware.

**Non-goals**
- Real payments. Checkout uses a clearly labelled demo gateway ("NestaPay — demo, no real money"). No card/UPI data is ever transmitted.
- Real shipping carriers, invoices/GST filing, multi-currency, i18n, native apps.
- Deployment is prepared (configs, README) but only performed with explicit user approval.

---

## 2. Architecture

```
nestama/                      pnpm workspace (root package.json, pnpm-workspace.yaml)
├─ client/                    Next.js 16 · React 19 · TypeScript · Tailwind v4 · Motion
├─ server/                    Express 5 · TypeScript · Prisma 7 · Better Auth
└─ shared/                    Zod schemas, TS types, money formatting, constants
```

- **Ports (dev):** client `:3000`, server `:4000`. Root `pnpm dev` runs both via `concurrently`.
- **API:** REST + JSON under `/api/v1`. Auth routes under `/api/auth/*` (Better Auth). OpenAPI JSON generated from Zod at `/api/docs/openapi.json`, browsable UI at `/api/docs`.
- **Same-origin in the browser:** Next.js `rewrites()` proxies `/api/:path*` → `${API_URL}/api/:path*`. The browser only ever talks to the client origin, so session cookies are first-party and no CORS is needed for browser traffic. The server still enforces a CORS allowlist (`CLIENT_ORIGIN`) for defence in depth.
- **Rendering:**
  - Catalog pages (home, shop, category, product) are Server Components that fetch from the API server-to-server (`API_URL`), forwarding the incoming `cookie` header when user-specific data is needed. Good SEO and fast first paint.
  - Interactive state (cart, wishlist, search, checkout, account, admin) uses client components with **TanStack Query** against the proxied `/api` routes, including optimistic updates for cart and wishlist.
- **Server layering:** `modules/<name>/{<name>.routes.ts, <name>.controller.ts, <name>.service.ts}`. Routes declare validation (Zod from `shared/`) and guards; controllers translate HTTP ↔ service calls; services hold business logic and call Prisma. Pure logic (pricing, coupons, promotions, signatures, delivery estimates) lives in `server/src/lib/` with no I/O so it is unit-testable.
- **Errors:** services throw `AppError(code, httpStatus, message, details?)`; one error middleware returns `{ error: { code, message, details? } }`. Zod failures → `400 VALIDATION_ERROR`. Unknown errors → `500 INTERNAL` without leaking internals.

---

## 3. Tech stack (pinned majors)

| Layer | Choice |
|---|---|
| Frontend | Next.js 16.4, React 19.3, TypeScript |
| UI / animation | Tailwind CSS 4.3, Motion 14 (`motion/react`, formerly Framer Motion), lucide-react icons + custom paw icon |
| Client data | TanStack Query 5 |
| API | Express 5.3, TypeScript, run with `tsx` in dev, compiled with `tsc` for prod |
| Database | PostgreSQL on **Supabase** (database only), Prisma ORM 7.10 with `@prisma/adapter-pg` |
| Auth | Better Auth 1.7 (email/password, password reset, sessions, `role` field) mounted in Express |
| Validation | Zod 4 schemas in `shared/`, used by both sides |
| Security | helmet, CORS allowlist, express-rate-limit (auth, checkout, search), cookie `httpOnly; secure; sameSite=lax` |
| Images | Unsplash photos (seed catalog) via `next/image`; admin uploads → Cloudinary when `CLOUDINARY_URL` is set, else `server/uploads/` served statically |
| Email | Resend when `RESEND_API_KEY` is set; otherwise reset links are logged to the server console |
| Charts (admin) | Recharts |
| Tests | Vitest + Supertest (server), Vitest + Testing Library for critical client logic; UI verified in the browser at 375 / 768 / 1280 widths |
| Hosting (prepared) | Client → Vercel; server → Render or Railway; DB → Supabase |

TypeScript: the JS-based compiler (5.x/6.x line) — the native TS 7 compiler is not used until Next.js and tooling support it.

---

## 4. Design system

**Palette (Tailwind v4 `@theme` tokens)**

| Token | Hex | Use |
|---|---|---|
| `forest` | `#123D2F` | Primary brand, headers, primary buttons (cream text) |
| `orange` | `#FF571F` | Accent fills: badges, heart, cart count, Add to Cart, countdown gradient |
| `cream` | `#FFF8EF` | Page background |
| `white` | `#FFFFFF` | Cards, inputs |
| `charcoal` | `#202522` | Body text |
| `sage` | `#E5EFE4` | Section backgrounds, chips |
| `peach` | `#FFE3D2` | Promo surfaces, gradient end |
| `orange-ink` | derived, ≥4.5:1 on white and cream | Orange-coloured *text* and small icons on light backgrounds |

Contrast rules: text on `orange` fills is charcoal (≈4.9:1) or white only at ≥18.66px bold; all body text ≥4.5:1; focus ring 2px `forest` + 2px offset (`orange` ring on dark surfaces). Exact derived values are verified with a contrast script in Stage 1.

**Typography:** Display — *Bricolage Grotesque* (600–800, tight tracking, large confident headlines). Body/UI — *Manrope* (400–700). Loaded with `next/font` (self-hosted, `display: swap`). Scale: 12 / 14 / 16 / 18 / 20 / 24 / 30 / 36 / 48 / 60 / 72.

**Shape and depth:** cards `rounded-3xl` with 1px `forest/8%` border and soft forest-tinted shadow; buttons pill-shaped; inputs `rounded-xl`. Spacing on a 4px grid; sections `py-16 md:py-24`; container max-width 1280px with 16px mobile gutters.

**Motifs:** subtle paw-print patterns (low-opacity SVG backgrounds), soft gradients (`orange → peach`, `sage → cream`), circular category thumbnails. Never cartoonish — the photography and typography carry the premium feel; pets add personality in small doses.

**Motion tokens:** `fast 150ms`, `base 220ms`, `slow 400ms`; easing `cubic-bezier(.2,.8,.2,1)`; springs for bounces (`stiffness 500, damping 22`). One `useReducedMotion` gate (Motion's hook + CSS `@media (prefers-reduced-motion)`) used by every animation.

### 4.1 Visual reference (user-supplied mockup, 2026-10-10)

The user supplied a mockup to be used **as a reference** (not a pixel copy) for product presentation, page sections and the loading/animation moments. Takeaways adopted:

- **Announcement bar:** forest background with icon-led items: free shipping ≥ ₹999 · `NESTAMA20` for 20% off · limited-time offer · delivery pincode selector ("Deliver to 500081").
- **Header:** paw logo mark + "NESTAMA / YOUR TRUE FRIEND"; wide rounded search field ("Search for pet food, toys, accessories…"); Account, Wishlist, Cart with an orange count badge; category nav row with **Offers** underlined in orange.
- **Hero:** three zones on desktop: copy (left: "Happy Pets." charcoal / "Happier Lives." orange, doodled heart, paw), pet photo (centre, soft-faded into the background, handwritten aside), and a white **offer card** (right: "SPECIAL OFFER" pill, "UP TO 25% OFF", four **forest countdown tiles** Days/Hours/Minutes/Seconds, coupon row with copy button, orange "Shop Now →"). Trust row under the CTAs: Free Shipping above ₹999 · Quality Products · Loved by Pet Parents.
- **Categories:** one row of circular thumbnails on pastel (peach/sage) discs, label below.
- **Campaign cards:** four tinted cards (sage, pink-peach, peach, sage-blue), forest headline, "Flat 15% OFF" with the number in orange, forest pill CTA ("Shop Toys →"), pet photo on the right, handwritten accent ("Play more, bark less", "z z z").
- **Deals of the Day:** flame icon, subtitle, "View all deals →", "Offer ends in hh:mm:ss" pill. **Product card:** white card, orange `NN% OFF` badge top-left, product image, name, stars + review count, bold price + struck-through reference price, orange square **cart icon button** bottom-right.
- **Trust strip:** six outlined icons with two-line labels on a cream band.
- **Footer:** forest, logo, "Join our pet-loving community" newsletter with orange Subscribe, pet photo on the right.
- **Loader:** cream card, logo, kitten batting an orange wool ball whose strand runs across the card, copy line, paw-marked progress bar with a percentage.
- **Product click:** dog beside the product with a speech bubble "Good choice! Your furry friend will love this."
- **Add to cart:** toast "Added to your pack!"; product thumbnail flies to the cart with a dotted paw trail; cart badge bumps.
- **PDP:** name, rating, price + strike + `20% OFF` chip, short description, colour swatches, size chips, quantity stepper, orange Add to Cart + heart button, feature icon row (e.g. Breathable · Adjustable · Durable · Reflective), tabs Description / Specifications / Reviews.
- **Order success:** puppy + confetti, "Woohoo! Your order is on its way!", forest "Track your order →" and outlined "Continue shopping".

**Accessibility adjustment:** white text on `#FF571F` is 3.17:1 (fails AA). Filled orange buttons and badges with white text use **`ember` `#D43F0A`** (4.65:1); `#FF571F` stays for hearts, paws, the yarn thread, count dots and gradients.

---

## 5. Data model (Prisma)

Money is stored as **integer paise** (`Int`). Timestamps are UTC `DateTime`.

- **Better Auth tables:** `User` (+ `role: CUSTOMER | ADMIN`, `phone?`), `Session`, `Account`, `Verification`.
- `Address` — userId, fullName, phone, line1, line2?, city, state, pincode, isDefault.
- `Category` — slug, name, description, image, parentId? (e.g. *Accessories* → Collars & Leashes, Pet Clothing, Bowls & Feeders), sortOrder, showOnHome.
- `Brand` — slug, name, logo?. Sample brands are fictional.
- `Product` — slug, name, description, petType `DOG | CAT | BOTH`, categoryId, brandId, specs `Json` (key/value list), tags `String[]`, isActive, isSample, isFeatured, publishedAt, ratingAvg, ratingCount, soldCount (denormalised, updated on review change / paid order).
- `ProductVariant` — productId, sku (unique), label (e.g. "Medium / Sage"), options `Json`, price (regular selling price), mrp? (≥ price), stock, lowStockThreshold (default 5), isDefault.
- `ProductImage` — productId, url, alt, width, height, sortOrder.
- `Review` — productId, userId, rating 1–5, title, body, status `PUBLISHED | HIDDEN`, isVerifiedPurchase. One review per user per product.
- `Cart` — userId? (unique) or guest token (unique), updatedAt. `CartItem` — cartId, variantId, quantity (unique per cart+variant).
- `WishlistItem` — userId, productId (unique pair).
- `Promotion` — slug, name, headline, subheadline, discountPercent (1–90), startsAt, endsAt, isActive, placement `HERO_CARD | COUNTDOWN_BANNER | CAMPAIGN | NONE`, scope `ALL | CATEGORIES | PRODUCTS`, categories (m:n), products (m:n), couponId? (code to display), image?, ctaLabel, ctaHref, theme, sortOrder.
- `Coupon` — code (unique, uppercase), description, type `PERCENT | FIXED`, value, minOrder, maxDiscount?, startsAt, endsAt, usageLimit?, perUserLimit?, scope + categories/products, isActive, usedCount.
- `Order` — number (human readable, e.g. `NST-24A7K9`), userId, status, address snapshot `Json`, subtotal, promoDiscount, couponCode?, couponDiscount, shipping, total, gstIncluded, placedAt, expiresAt (for unpaid reservations).
  - Status: `PENDING_PAYMENT → CONFIRMED → PACKED → SHIPPED → OUT_FOR_DELIVERY → DELIVERED`, plus `PAYMENT_FAILED`, `CANCELLED`.
- `OrderItem` — orderId, variantId, productId, name/variantLabel/image snapshot, unitPrice (charged), originalUnitPrice, quantity, lineTotal.
- `OrderEvent` — orderId, status, note?, createdAt (tracking timeline).
- `Payment` — orderId, gateway `NESTAPAY_DEMO`, gatewayOrderId (unique), gatewayPaymentId?, method `UPI | CARD | NETBANKING`, amount, status `CREATED | CAPTURED | FAILED`, failureReason?.
- `CouponRedemption` — couponId, userId, orderId (counts toward limits only once the order is paid).
- `NewsletterSubscriber` — email (unique), createdAt.
- `StoreSettings` — singleton: announcementText, freeShippingThreshold (default ₹999), flatShippingFee (default ₹79), gstRatePercent (default 18), heroHeadline, heroSubcopy, popularSearches `String[]`, supportEmail, supportPhone.

---

## 6. Commerce rules

All computed by pure functions in `server/src/lib/pricing.ts`, shared by product listing, cart, checkout and order creation. Client-side prices are display-only.

1. **Effective unit price.** For each variant, find active promotions (`isActive`, `startsAt ≤ now < endsAt`) whose scope includes the product (category scope includes child categories). Take the **single highest** `discountPercent` (no stacking). `salePrice = roundToRupee(price × (100 − pct) / 100)`. No active promotion → `salePrice = price`.
2. **Displayed reference price.** If a promotion applies, strike-through shows `price`; otherwise it shows `mrp` when `mrp > price`. Discount badge = `round((1 − salePrice / reference) × 100)%`.
3. **Cart subtotal** = Σ `salePrice × qty`. `promoDiscount` = Σ `(price − salePrice) × qty` (shown as savings).
4. **Coupon.** Valid if active, inside its window, under usage limits (global and per user, counted on paid orders), and `subtotal ≥ minOrder`. Eligible subtotal = sum of in-scope lines. `PERCENT`: `min(maxDiscount ?? ∞, round(eligible × value / 100))`; `FIXED`: `min(value, eligible)`. Invalid coupons return a specific reason (`EXPIRED`, `MIN_ORDER_NOT_MET`, `NOT_ELIGIBLE`, `USAGE_LIMIT`, `NOT_FOUND`).
5. **Shipping.** `0` if `subtotal − couponDiscount ≥ freeShippingThreshold`, else `flatShippingFee`.
6. **Total** = `subtotal − couponDiscount + shipping`.
7. **GST.** Prices are GST-inclusive (Indian retail norm). `gstIncluded = round(goodsTotal × rate / (100 + rate))` where `goodsTotal = subtotal − couponDiscount`; shown as "Includes ₹X GST".
8. **Stock.** Order creation reserves stock with a conditional decrement in one transaction (fails with `OUT_OF_STOCK` per line if insufficient). Unpaid orders expire after 30 minutes; a server interval (every 5 min) and lazy checks release reservations and mark them `CANCELLED`. Payment failure releases immediately.
9. **Cart persistence.** Every cart lives in the DB. Guests get an `httpOnly` cookie `nst_cart` (random token). On sign-in the guest cart merges into the user cart (quantities summed, capped at stock) and the guest cart is deleted. Wishlist for guests lives in `localStorage` and is pushed to the server on sign-in.
10. **Checkout requires sign-in**; the guest cart carries over.

**Seed promotions (configurable, not hardcoded):** Toys That Make Tails Wag 15% (Toys), Cozy Beds for Sweeter Dreams 20% (Beds & Furniture), Grooming Made Easy 15% (Grooming), Healthy Pets, Brighter Tomorrows 25% (selected Health & Wellness products), and **PAW-SOME DEALS — UP TO 25% OFF** (countdown banner + hero card, deal products, linked coupon `NESTAMA20`: 20% off, min ₹999, max ₹500). Seed windows are relative to seed time so the countdown is live after seeding.

---

## 7. Demo payment flow (mirrors Razorpay)

1. `POST /api/v1/checkout/orders { addressId, couponCode? }` → server re-prices the cart, reserves stock, creates `Order(PENDING_PAYMENT)` + `Payment(CREATED, gatewayOrderId)`. Returns `{ orderId, orderNumber, gatewayOrderId, amount }`.
2. Client opens the **NestaPay demo modal**: UPI / Card / Netbanking tabs with format-only validation on fake inputs (published test values like `4111 1111 1111 1111`, `success@nestapay`). Inputs are never sent anywhere. A "Simulate failure" toggle exists for demos.
3. `POST /api/v1/payments/demo/authorize { gatewayOrderId, method, outcome }` — stands in for the gateway's own servers. On success returns `{ gatewayPaymentId, signature }` where `signature = HMAC_SHA256(gatewayOrderId + "|" + gatewayPaymentId, DEMO_GATEWAY_SECRET)`; on failure returns a failure reason.
4. `POST /api/v1/payments/verify { orderId, gatewayOrderId, gatewayPaymentId, signature }` — verifies the HMAC with `timingSafeEqual`, checks the payment belongs to the caller's order and the amount matches, then in one transaction: `Payment → CAPTURED`, `Order → CONFIRMED`, `OrderEvent`, `CouponRedemption`, `soldCount += qty`, clear cart. Idempotent on retries. Failures mark `PAYMENT_FAILED` and release stock.
5. Client navigates to `/orders/[id]/confirmed`. The page fetches the order from the server; **the success animation renders only when the server reports a paid status**. Otherwise it shows the real state (pending/failed) with a retry.

---

## 8. Auth and authorization

- Better Auth (Prisma adapter) mounted at `/api/auth/*` in Express. Email + password (min 8 chars), sign-out, password reset (token email via Resend or console). `BETTER_AUTH_URL` = the public client origin (browser traffic arrives through the proxy); `trustedOrigins` = `[CLIENT_ORIGIN]`.
- Express middleware: `loadSession` (attaches `req.user?`), `requireAuth`, `requireRole('ADMIN')`. Every `/api/v1/admin/*` route uses `requireRole('ADMIN')`. Ownership is checked in services (users only see their own orders, addresses, reviews).
- Client: a Next.js `proxy`/middleware redirects unauthenticated users away from `/account`, `/checkout`, `/admin` for UX only; the server is the enforcement point.
- First admin is seeded from `ADMIN_EMAIL` / `ADMIN_PASSWORD` env vars (never committed).
- Rate limits: auth 10/min/IP, checkout + payments 20/min/user, search 60/min/IP.

---

## 9. API surface (v1)

Public: `GET /home`, `GET /categories`, `GET /categories/:slug`, `GET /brands`, `GET /products` (filters: `pet, category, brand[], minPrice, maxPrice, rating, inStock, onSale, q, sort=featured|price-asc|price-desc|rating|newest|bestselling, page, pageSize`; returns items + facet counts + pagination), `GET /products/:slug`, `GET /products/:slug/related`, `GET /products/by-ids?ids=`, `GET /products/:slug/reviews`, `GET /search?q=` (top 6 products + matching categories), `GET /promotions/active`, `GET /settings/public`, `POST /newsletter`, `GET /delivery-estimate?pincode=&variantId=`.

Cart (guest or user): `GET /cart`, `POST /cart/items`, `PATCH /cart/items/:id`, `DELETE /cart/items/:id`, `POST /cart/coupon`, `DELETE /cart/coupon`. Cart responses always include the full server-computed summary.

Signed-in: `GET|POST /wishlist`, `DELETE /wishlist/:productId`, `POST /wishlist/sync`, `GET|POST|PATCH|DELETE /account/addresses`, `GET /account/orders`, `GET /orders/:id`, `POST /products/:slug/reviews`, `POST /checkout/orders`, `POST /payments/demo/authorize`, `POST /payments/verify`.

Admin (`/admin/*`): `stats/overview`, `reports/sales?range=`, `reports/orders.csv`, CRUD for `products` (+ variants, images), `categories`, `brands`, `coupons`, `promotions`; `inventory` (list + low-stock + bulk stock update); `orders` (list/filter, detail, `PATCH status` appends `OrderEvent`); `customers` (list, detail, role change); `reviews` (list, hide/publish); `settings` (GET/PUT); `uploads` (multipart image → Cloudinary or local).

---

## 10. Animation system

All pet animations are hand-built inline SVG animated with CSS keyframes and Motion — no Lottie, no video. Each lives in `client/src/components/animations/` behind a small props API (`play`, `size`, `onDone`) so any one can be swapped for a Lottie file later. Every animation has a reduced-motion variant (static pose or instant state). No animation loops indefinitely except the loader while it is visible.

| Component | Behaviour |
|---|---|
| `InitialLoadingScreen` + `KittenWoolAnimation` | Rendered in the root layout's server HTML with pure CSS so it plays before JS loads: paw taps an orange wool ball → ball rolls (eased) → kitten head/paw track it → wool strand path-draws into the NESTAMA wordmark → tagline fades in → paw-shaped progress fills → overlay fades out. Copy: "Getting everything ready for your furry friend…". Dismissed as soon as hydration + fonts + hero image are ready, hard cap ~2s, never artificially extended. Shown once per browser session (an inline pre-paint script checks `sessionStorage` and hides it on repeat loads); `?intro=1` forces a replay for demos. Reduced motion: static logo + tagline, same dismissal. Never shown on client-side navigation. |
| `WaggingDogMascot` | SVG dog; tail rotates 2–3 wags (~700ms) when `play` flips; idle otherwise. Sizes `sm` (mobile) / `md`. Used by product-open, PDP add-to-cart, order success. |
| Product-open interaction (`ProductCard` → PDP/quick view) | Click/Enter on a card: card lifts (`scale 1.02`, shadow up), dog peeks from the card corner and wags, 6–8 paw particles burst, toast "Good choice! Your furry friend will love this." **Navigation starts in the same click** (`router.push` after a `startViewTransition` where supported); the dog lives in a layout-level overlay and finishes over the arriving page — navigation is never delayed for it. PDP image uses a shared view-transition name; fallback is a fade + 12px slide. Mobile: small corner dog that never covers product info. Reduced motion: navigate instantly, no dog/particles. |
| `AnimatedAddToCart` | Paw presses the button (scale + paw overlay, 180ms) → product thumbnail flies to the header cart icon along a curved path (measured rects; skipped if the icon is off-screen) → cart count bounces → toast "Added to your pack!" with **Undo** and **View cart**. Optimistic update rolled back on API error with an error toast. |
| `WishlistButton` | Heart fills orange with a scale pop + 6 paw-print burst; toast "Saved to your favorites!"; clicking again removes ("Removed from favorites"). `aria-pressed` reflects state. |
| Category cards | Hover/focus: image zooms 1.06, paw icon slides in, label shifts to orange-ink. Touch: brief press scale (0.97) feedback instead of hover. |
| `OfferCountdown` | Days/hours/minutes/seconds computed from the promotion's real `endsAt` (server time offset corrected from the API response `Date` header). Digits flip/slide on change. Orange → peach gradient, small wagging-tail mascot, "Shop Deals", coupon chip `NESTAMA20` with copy button. Never resets on refresh. On expiry: replaced by "This offer has ended" and data is refetched so the expired promotion disappears. Screen readers get a static "Offer ends {date, time}" and a polite live region updated once per minute; ticking digits are `aria-hidden`. |
| `AnimatedSearch` | Focus opens a panel (fade/scale) with popular searches and suggested products; typing debounces 200ms, shows matching thumbnails, paw spinner only while a request is in flight. ARIA combobox: arrow keys, Enter, Escape closes, focus returns to input. Mobile: full-screen sheet. |
| `EmptyCartIllustration` | Puppy peering into an empty bowl (gentle head tilt once). "Your cart is waiting for something pawsome!" + "Explore Products". |
| `OrderSuccessAnimation` | Dog wags, paw-print + confetti shapes burst once. "Woohoo! Your order is on its way!" Only mounted after the server confirms payment. |
| Page transitions | Route content fades + slides 8px over 200ms; header, footer and announcement bar stay mounted and still. No full-screen transitions on navigation. |
| Loading skeletons | Card skeletons with a subtle shimmer and a tiny paw pulse; dimensions match real cards (no layout shift). |

---

## 11. Pages

- **Home (`/`)**, in order: demo ribbon (thin, dismissible: "Portfolio demo — sample products, no real payments") → announcement bar (free-shipping threshold from settings, current offer, coupon code, pincode/delivery-location selector stored locally) → sticky header (logo + tagline, search, account, wishlist, cart count; category nav: Dogs, Cats, Food, Accessories, Toys, Grooming, Beds & Furniture, Health & Wellness, Travel, Offers; mobile drawer) → hero (golden retriever + kitten lifestyle photo, "Happy Pets. Happier Lives.", supporting copy, Shop Now / Explore Categories, four trust indicators; hero promo card with live countdown) → category grid (10 circular cards) → four campaign cards → Deals of the Day carousel (keyboard + swipe, scroll-snap) → Best Sellers → New Arrivals → Recommended for Your Pet (Dog/Cat toggle) → Recently Viewed (localStorage, hidden when empty) → Limited-Time Offers (promotions ending within 7 days) → trust section (6 items) → footer (customer service, about, contact, shipping/returns, FAQs, social, newsletter, payment-method marks).
- **Shop (`/shop`)**, **category (`/c/[slug]`)**, **offers (`/offers`)**: shared listing with filters (pet type, category, brand, price range, rating, availability, on sale), sort, result count, active-filter chips, responsive grid (2 / 3 / 4 columns), pagination with page links (crawlable), skeletons during transitions. All state in the URL. Mobile filters in a bottom sheet. Nav "Dogs"/"Cats" → `/shop?pet=dog|cat`.
- **Product (`/products/[slug]`)**: gallery (thumbnails, keyboard, swipe, zoom on hover/tap), name, brand, rating, prices + badge, variant selector, quantity, stock status, pincode delivery estimate (metro prefixes 2–3 days, otherwise 4–6), Add to Cart with compact `WaggingDogMascot` that wags only on add, wishlist, description, specs table, reviews (distribution bars, list, write-a-review for signed-in users), related products. Adds itself to Recently Viewed.
- **Quick view**: eye button on cards opens `ProductQuickView` modal (focus-trapped, Escape closes) with variant + add to cart.
- **Cart (`/cart`)** and slide-over mini-cart: line items, quantity steppers, remove, coupon input with specific error messages, summary (subtotal, savings, coupon, shipping with "₹X away from free shipping" progress, GST included, total), empty state.
- **Checkout (`/checkout`)**: address (saved or new) → review → NestaPay demo payment. Responsive single column on mobile, summary sidebar on desktop.
- **Order pages**: `/orders/[id]/confirmed` (success animation if paid), `/orders/[id]` (tracking timeline, items, totals).
- **Account**: `/account` overview, `/account/orders`, `/account/addresses`, `/account/wishlist`, `/account/profile`. Auth: `/login`, `/register`, `/forgot-password`, `/reset-password`.
- **Static**: `/about`, `/faq`, `/shipping-returns`, `/contact`.
- States everywhere: loading (skeleton), empty, error (friendly message + retry), success.

---

## 12. Admin (`/admin`)

Separate layout (sidebar on desktop, drawer on mobile), same design tokens in a denser variant.

- **Dashboard:** revenue, orders, AOV, customers (30 days vs previous), revenue-by-day chart, top products, low-stock alerts, recent orders.
- **Products:** table with search/filter (category, sample, active, stock), create/edit form (details, category, brand, pet type, specs, tags, variants with price/MRP/stock/SKU, images with upload + reorder + alt text), activate/deactivate.
- **Categories / Brands:** CRUD, ordering, home visibility.
- **Inventory:** variant stock table, inline edit, low-stock filter.
- **Promotions:** CRUD with percent, start/end (datetime-local in IST, stored UTC), scope + eligible categories/products, placement, linked coupon, copy, image, CTA; status chip (scheduled / live / ended). Changing these updates the storefront immediately.
- **Coupons:** CRUD with type/value/min order/max discount/window/limits/scope; usage counts.
- **Orders:** list with status filter + search, detail with items/payment/address, advance fulfilment status (appends timeline event), cancel (releases stock if not shipped).
- **Customers:** list, detail (orders, spend), role change.
- **Reviews:** list, hide/publish.
- **Homepage & settings:** announcement text, free-shipping threshold, shipping fee, GST rate, hero copy, popular searches, support contacts.
- **Reports:** sales by day/week, by category, top products; orders CSV export.

---

## 13. Performance, accessibility, quality

- `next/image` with explicit sizes and `sizes` attributes, AVIF/WebP, priority only for the hero; below-the-fold sections lazy-load. Fonts self-hosted. Animations are SVG/CSS (no heavy assets). Motion components are client-only islands.
- Semantic landmarks, one `h1` per page, labelled controls, visible focus, skip link, focus-trapped dialogs, `aria-live` for toasts and cart count, all hover features reachable by focus/tap, contrast ≥ 4.5:1 for text.
- No layout shift: fixed aspect ratios for images and skeletons.
- `prefers-reduced-motion` respected by every animation (see §10).
- Server: input validation on every endpoint, parameterised queries via Prisma, no secrets in the client bundle, cookies `httpOnly`, rate limits, helmet headers, admin authorization on every admin route.

---

## 14. Testing and verification

- **Server unit (Vitest):** pricing (promotion selection, rounding, coupon types, caps, min order, shipping threshold, GST), coupon validation reasons, payment signature create/verify, delivery estimate, cart merge logic.
- **Server integration (Vitest + Supertest, against a separate `test` schema):** auth-guarded routes reject anonymous/customer users on admin routes; cart add/update/remove totals; checkout → authorize → verify happy path and tampered-signature rejection; stock reservation and release.
- **Client:** unit tests for countdown math and URL filter-state helpers.
- **Browser verification per stage** at 375 / 768 / 1280 widths, light reduced-motion check, keyboard-only pass on header, search, product card, cart and checkout.

---

## 15. Environment variables

`server/.env`: `DATABASE_URL`, `DIRECT_URL` (Supabase pooler URLs), `PORT=4000`, `CLIENT_ORIGIN=http://localhost:3000`, `BETTER_AUTH_SECRET`, `BETTER_AUTH_URL=http://localhost:3000`, `DEMO_GATEWAY_SECRET`, `ADMIN_EMAIL`, `ADMIN_PASSWORD`, optional `CLOUDINARY_URL`, `RESEND_API_KEY`, `EMAIL_FROM`.
`client/.env.local`: `API_URL=http://localhost:4000`, `NEXT_PUBLIC_SITE_URL=http://localhost:3000`.
`.env.example` files are committed; real `.env` files are git-ignored.

---

## 16. Build stages

1. **Foundation + storefront shell:** workspace, client/server/shared scaffolds, design tokens, fonts, header/nav/announcement/footer, homepage sections, category cards, campaign cards, product cards — fed by the API with seeded sample data (requires DB setup; user receives Supabase setup directions at this point).
2. **Signature animations:** kitten loader, dog tail-wag product open, wishlist, add-to-cart, real countdown, page transitions.
3. **Catalog + cart:** listing with filters/sort/pagination, product detail, quick view, search, cart + mini-cart, coupons, guest cart.
4. **Accounts + checkout:** Better Auth flows, addresses, cart merge, checkout, NestaPay demo with server verification, order confirmation, tracking, order history, wishlist sync, reviews.
5. **Admin:** dashboard, products/categories/brands/inventory, promotions and coupons, orders/fulfilment, customers, reviews, settings, reports.
6. **Hardening:** performance pass, accessibility pass, mobile polish, security review, deployment configs + README.

Each stage ends with the app running and its features verified in the browser before the next begins.
