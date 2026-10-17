# Stage 2 — Signature Animations Implementation Plan

**Goal:** The pet-themed interaction layer — kitten-wool loader, dog tail-wag product open, wishlist heart, add-to-cart flight with a real server cart, toasts, and page transitions — all fast, accessible and reduced-motion aware.

**Architecture:** Animations live in `client/src/components/animations/` as self-contained SVG/CSS/Motion components with small prop APIs; business state lives in hooks (`useCart`, `useWishlist`) and providers (`ToastProvider`, `PetMomentProvider`) so animations never own data. The cart is server-authoritative from day one (guest cookie cart in Postgres); the client uses TanStack Query with optimistic updates. Route-level motion uses React 19.3 `<ViewTransition>` (shared product-image morph, page fade/slide, anchored header).

**Tech Stack:** React 19.3 `ViewTransition`, Motion 14, TanStack Query 5, Express cart module, Vitest + Supertest.

**Spec:** `docs/specs/2026-10-10-nestama-design.md` (§4.1, §6, §10)

## Global Constraints

- **No git commands** until the user asks.
- Every animation has a reduced-motion path (static pose or instant state); no infinite loops except the loader while visible.
- Animations never delay navigation or data; the loader is dismissed as soon as the app is ready (hard cap ≈ 2 s, failsafe 4 s without JS).
- No sound. No video assets. SVG/CSS/Motion only.
- Toast copy: "Added to your pack!", "Saved to your favorites!", "Removed from favorites", "Good choice! Your furry friend will love this."
- Filled orange with white text uses `ember` (#D43F0A).
- Money in paise; prices computed only on the server.

---

### Task 1: Toast system
**Files:** `client/src/components/toast/ToastProvider.tsx`, `client/src/components/toast/Toaster.tsx`, `client/src/app/providers.tsx`, layout wiring.
**Produces:** `useToast(): { show(t: { title: string; description?: string; icon?: "paw" | "heart" | "cart" | "check" | "alert"; actions?: { label: string; onClick?: () => void; href?: string }[]; duration?: number }): string; dismiss(id: string): void }`.
- [x] Polite `aria-live` region (role="status"), max 3 visible, auto-dismiss 4 s (paused on hover/focus), Motion slide-up, reduced motion → fade only. Bottom-centre on mobile, bottom-right on desktop.

### Task 2: Pet illustrations + primitives
**Files:** `client/src/components/animations/{DogMascot.tsx,WaggingDogMascot.tsx,PawBurst.tsx,animations.css}`.
**Produces:** `<DogMascot className wag?: boolean />` (SVG golden dog; tail in its own group with `transform-origin` at the base), `<WaggingDogMascot play: number size: "sm"|"md" />` (wags 3× ≈ 700 ms each time `play` increments; still otherwise), `<PawBurst trigger: number count?: number color?: string />` (6–8 paw prints radiating, 600 ms).
- [x] Static pose under reduced motion.

### Task 3: Kitten-wool loader
**Files:** `client/src/components/animations/KittenWoolAnimation.tsx`, `client/src/components/loader/InitialLoadingScreen.tsx`, `client/src/components/loader/IntroController.tsx`, CSS in `animations.css`, layout wiring.
- [x] Server-rendered overlay (pure CSS animation, plays before hydration): paw taps wool ball → ball rolls (ease-out) with the strand drawing behind it → kitten head tracks the ball → strand flows into the NESTAMA wordmark (clip reveal) → tagline fades in → paw progress bar fills; copy "Getting everything ready for your furry friend…".
- [x] Inline pre-paint script: skip (hide instantly) when already seen this session, unless `?intro=1`.
- [x] `IntroController` (client): progress milestones = hydrated / fonts ready / hero image decoded; dismiss when all ready or at 2 s cap (`?intro=1` plays the full 2 s); fade out 350 ms, then `display:none`; `role="status"` text for screen readers; CSS failsafe hides after 4 s if JS never runs.

### Task 4: Product-open moment + view transitions
**Files:** `client/src/components/animations/PetMomentProvider.tsx`, `ProductCard.tsx` (update), `client/src/components/layout/PageTransition.tsx`, `globals.css` (view-transition CSS), `StickyHeader.tsx` (anchor name).
**Produces:** `usePetMoment(): { celebrate(opts: { rect: DOMRect; message?: string }): void }`.
- [x] Card click (plain left-click / Enter on the title link): card lifts (`scale 1.02`), `PawBurst`, `celebrate()` shows a small dog beside the card (desktop) or bottom corner (mobile, `sm` size) with the speech bubble; navigation proceeds in the same click (never `preventDefault`). Modified clicks (ctrl/⌘/shift/middle) behave normally with no animation.
- [x] `<ViewTransition name="product-{slug}" share="morph" default="none">` on the card image (PDP adds the matching name in Stage 3). Page content wrapped in `PageTransition` (fade + 8 px rise, 200 ms); header anchored (`viewTransitionName: site-header`); `::view-transition { pointer-events: none }`; reduced-motion CSS zeroes durations.

### Task 5: Wishlist (guest, local) + WishlistButton
**Files:** `client/src/lib/wishlist-store.ts` (+ test), `client/src/components/product/WishlistButton.tsx`.
**Produces:** `useWishlist(): { ids: string[]; has(id): boolean; toggle(id): boolean /* returns new state */ }` backed by `localStorage["nst_wishlist"]` via `useSyncExternalStore` (server-synced in Stage 4).
- [x] Pure helpers `toggleId(list, id)` / `parseList(raw)` unit-tested (dedupe, max 200, tolerant of corrupt storage).
- [x] Button: heart fills orange with a spring pop + `PawBurst`, toast "Saved to your favorites!" / "Removed from favorites", `aria-pressed`, label switches Save/Remove.

### Task 6: Server cart (guest cookie) + cart summary pricing
**Files:** `server/src/lib/pricing.ts` (+ `summarizeCart`), `pricing.test.ts`, `server/src/modules/cart/{cart.routes,cart.controller,cart.service}.ts`, `shared/src/cart.ts` (DTOs + schemas), `server/test/cart.int.test.ts`.
**Produces:**
```ts
// shared
interface CartLineDTO { id: string; variantId: string; productId: string; slug: string; name: string; variantLabel: string; image: ImageDTO; quantity: number; maxQuantity: number; unitPrice: number; originalUnitPrice: number; lineTotal: number; stock: StockStatus }
interface CartSummaryDTO { itemCount: number; subtotal: number; promoSavings: number; couponCode: string | null; couponDiscount: number; shipping: number; freeShippingThreshold: number; amountToFreeShipping: number; total: number; gstIncluded: number; gstRatePercent: number }
interface CartDTO { id: string; lines: CartLineDTO[]; summary: CartSummaryDTO }
addCartItemSchema { variantId: string; quantity: 1..20 }, updateCartItemSchema { quantity: 0..20 }
// server pricing
summarizeCart(lines: { salePrice: number; price: number; quantity: number }[], opts: { couponDiscount: number; freeShippingThreshold: number; flatShippingFee: number; gstRatePercent: number }): Omit<CartSummaryDTO, "couponCode" | "itemCount">
```
- [x] TDD `summarizeCart`: empty cart → zeros and no shipping; below threshold → flat fee; at/above threshold → free; coupon discount counts against the threshold; GST included = round(goods × r / (100 + r)); `amountToFreeShipping` never negative.
- [x] Endpoints: `GET /cart`, `POST /cart/items` (adds or increments, capped at stock, 409 `OUT_OF_STOCK`), `PATCH /cart/items/:id` (0 removes), `DELETE /cart/items/:id`. Guest cart created lazily; `nst_cart` httpOnly cookie (`sameSite=lax`, `secure` in prod, 60 days). Every response returns the full `CartDTO` re-priced on the server.
- [x] Integration tests with Supertest agent (cookie persistence): add → count 1; add same variant → quantity 2; patch to 0 → removed; unknown variant → 404; out-of-stock → 409; free-shipping threshold flips shipping to 0.

### Task 7: Client cart + AnimatedAddToCart
**Files:** `client/src/app/providers.tsx` (QueryClientProvider), `client/src/lib/cart-client.ts` (`useCart`, `useAddToCart`, `useUpdateCartLine`), `client/src/components/animations/flyToCart.ts`, `client/src/components/product/AddToCartButton.tsx`, `CartButton.tsx` (live count + bump).
- [x] `useAddToCart` optimistic count bump, rollback + error toast on failure; success toast "Added to your pack!" with **Undo** (removes the line or restores previous quantity) and **View cart**.
- [x] `flyToCart(fromEl, imgSrc)`: clone thumbnail, animate along a curved path to `[data-cart-target]` (Web Animations API, 650 ms), dotted paw trail; skipped when target off-screen or reduced motion. Cart badge bumps (scale spring) when count changes. Paw presses the button (180 ms) on click.

### Task 8: Verification
- [x] All workspace tests, typecheck, lint, production build.
- [x] Browser: loader on first load (and `?intro=1`), skipped on reload; reduced-motion emulation shows static loader and no dog; product click shows dog + bubble and navigates; wishlist toggles and persists across reload; add to cart flies to the header, count updates, Undo works; keyboard-only path for all of the above; 375 / 768 / desktop.
