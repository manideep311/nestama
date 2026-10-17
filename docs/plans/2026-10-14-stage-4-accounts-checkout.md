# Stage 4 — Accounts, Checkout & Orders Implementation Plan

**Goal:** Shoppers can register, sign in, reset a password, manage addresses and profile, check out with the NestaPay demo gateway (server-verified HMAC), see a confirmation that only celebrates a paid order, track orders, keep a synced wishlist and write reviews.

**Architecture:** Better Auth 1.7.7 is mounted in Express at `/api/auth/*` (before `express.json()`), using the Prisma adapter on the existing `users / sessions / accounts / verifications` tables. A `loadSession` middleware puts `res.locals.user` on every `/api/v1` request (the Stage 3 cart already reads it). Pure logic lives in `server/src/lib/` and is unit tested: payment signatures, order numbers, cart merge and order state transitions. Checkout, payment, order, address, wishlist and review modules follow `routes → controller → service`. The client uses `better-auth/react` for session state, TanStack Query for account and checkout data, and a Next 16 `proxy.ts` for UX-only redirects.

**Tech Stack:** Better Auth 1.7.7, Express 5, Prisma 7.10, Zod 4, Next.js 16.4 (Cache Components, `proxy.ts`), React 19.3, TanStack Query 5, Motion 14, Vitest + Supertest.

**Spec:** `docs/specs/2026-10-10-nestama-design.md` (§5, §6 rules 4–10, §7, §8, §9 signed-in routes, §10 `OrderSuccessAnimation`, §11 checkout, order, account and auth pages, §14)

## Global Constraints

- **No git commands** until the user asks.
- The server is the only authority on prices, stock, coupons, payments, orders and permissions. Money is in integer paise.
- No card, UPI or bank data ever leaves the browser. The demo authorize call sends only `{ gatewayOrderId, method, outcome }`.
- Signature: `HMAC_SHA256(gatewayOrderId + "|" + gatewayPaymentId, DEMO_GATEWAY_SECRET)`, compared with `timingSafeEqual`.
- Unpaid orders expire after **30 minutes**. A sweep runs every 5 minutes, plus lazy checks; payment failure releases stock immediately.
- The success animation renders only when the server reports a paid status.
- Rate limits: auth POSTs 10/min/IP; checkout and payments 20/min/user.
- Passwords are at least 8 characters. Cookies are `httpOnly`, `sameSite=lax`, and `secure` when the base URL is https.
- The first admin is seeded from `ADMIN_EMAIL` / `ADMIN_PASSWORD`; values are never printed.
- Every async region has loading (skeleton), empty, error and success states. Dialogs trap focus. Reduced motion is respected.
- Secrets live only in `.env` files and are never echoed in chat.

---

### Task 1: Shared contracts
**Files:** `shared/src/account.ts` (new), `shared/src/orders.ts` (new), `shared/src/index.ts`, `shared/src/account.test.ts` (new).
**Produces:**
- `addressInputSchema`, with these fields:
  - `fullName` 2–80
  - `phone` `/^[6-9]\d{9}$/`
  - `line1` 3–120, `line2?` ≤120, `landmark?` ≤80
  - `city` 2–60
  - `state`, one of `INDIAN_STATES` (36 states and UTs)
  - `pincode` `/^[1-9]\d{5}$/`
  - `isDefault?` boolean
- `AddressDTO`.
- `profileUpdateSchema { name 2–60, phone? }`.
- `checkoutSchema { addressId: string }`.
- `PaymentMethodValue = "UPI" | "CARD" | "NETBANKING"`.
- `authorizePaymentSchema { gatewayOrderId, method, outcome: "success" | "failure" }`.
- `verifyPaymentSchema { orderId, gatewayOrderId, gatewayPaymentId, signature }`.
- `CheckoutOrderDTO { orderId, orderNumber, gatewayOrderId, amount }`.
- `AuthorizeResultDTO`, either `{ status: "authorized", gatewayPaymentId, signature }` or `{ status: "failed", reason }`.
- `OrderStatusValue`, `PAID_STATUSES`, `ORDER_TRACK_STEPS`.
- `OrderSummaryDTO` and `OrderDetailDTO` (items, events, totals, address snapshot, payment `{ method, status, failureReason }`, `canPay`, `expiresAt`).
- `reviewInputSchema { rating 1–5 int, title 3–80, body 10–1000 }`.
- `wishlistSyncSchema { productIds: string[] ≤200 }`.
- [x] TDD: valid and invalid phone, pincode and state; trims; the checkout and payment schemas reject extra or missing fields.

### Task 2: Pure server libs
**Files:** `server/src/lib/signature.ts`, `server/src/lib/order-number.ts`, `server/src/lib/cart-merge.ts`, `server/src/lib/order-status.ts`, plus a test for each.
**Produces:**
- `signPayment(gatewayOrderId, gatewayPaymentId, secret): string` (hex).
- `verifyPaymentSignature(gatewayOrderId, gatewayPaymentId, signature, secret): boolean`. Uses constant-time comparison, returns false on a length mismatch or non-hex input, and never throws.
- `newOrderNumber(random?: () => number): string` → `NST-XXXXXX`. Crockford-style alphabet without 0/O/1/I.
- `newGatewayId(prefix: "order" | "pay"): string` → `order_<16 base62>`.
- `mergeCartLines(guest, user, stockByVariant, max = MAX_LINE_QUANTITY)`. Returns the merged `{ variantId, quantity }[]`: quantities summed, capped at `min(stock, max)`, zero-stock lines dropped.
- `canTransition(from, to): boolean` for admin and fulfilment.
- `isPaid(status)`.
- [x] TDD each, including: tampered signatures, a wrong secret and a 1-char change all fail; order numbers have the right length and alphabet; merging caps at stock and at 20; illegal status jumps are rejected.

### Task 3: Server auth (Better Auth)
**Files:**
- `server/src/config/env.ts`: adds `BETTER_AUTH_SECRET` (≥32), `BETTER_AUTH_URL`, `DEMO_GATEWAY_SECRET` (≥32), `ADMIN_EMAIL?`, `ADMIN_PASSWORD?`, `RESEND_API_KEY?`, `EMAIL_FROM`. These are required outside `test` only when used.
- `server/src/lib/auth.ts`, `server/src/lib/mailer.ts`.
- `server/src/modules/auth/auth.middleware.ts`.
- `server/src/app.ts`.
- `server/prisma/seed.ts` (admin user).
- `server/test/auth.int.test.ts`.

**Produces:**
- `auth`, created by `betterAuth` with:
  - `prismaAdapter(prisma, { provider: "postgresql" })`
  - `emailAndPassword { enabled, minPasswordLength: 8, sendResetPassword }`
  - `user.additionalFields { role: { type: "string", input: false, defaultValue: "CUSTOMER" }, phone: { type: "string", required: false } }`
  - `session.cookieCache { enabled: true, maxAge: 60 }`
  - `trustedOrigins: [CLIENT_ORIGIN]`, `advanced.cookiePrefix: "nst"`
- Mounting: `app.all("/api/auth/*splat", authLimiter, toNodeHandler(auth))`, placed before `express.json()`. `authLimiter` allows 10 POSTs per minute per IP; GETs are exempt.
- `loadSession(req, res, next)`: `res.locals.user = { id, email, name, role } | undefined`. Before the cart router, it merges a guest cart into the user cart once signed in (deletes the guest cart, clears the `nst_cart` cookie).
- `requireAuth`: 401 `UNAUTHENTICATED`.
- `requireRole("ADMIN")`: 403 `FORBIDDEN`.
- `sendMail({ to, subject, html, text })`: uses Resend over `fetch` when a key is set, otherwise logs the reset link to the console.
- Seed: create the admin through `auth.api.signUpEmail` if missing, then set `role = ADMIN`. Never log the password.
- [x] Integration tests:
  - sign-up, then the session cookie works and `get-session` returns the user;
  - a wrong password gets 401;
  - `requireAuth` gets 401 without a cookie;
  - a guest cart with items, followed by sign-in, then `GET /cart` shows the items under the user cart and the guest token is cleared;
  - password reset request → `sendResetPassword` captured, then reset with the token, then sign in with the new password.

### Task 4: Account API (addresses, orders list, order detail)
**Files:** `server/src/modules/account/{account.routes,account.controller,account.service}.ts`, `server/src/modules/orders/orders.mapper.ts`, `server/test/account.int.test.ts`.
**Produces:**
- `GET|POST /account/addresses` and `PATCH|DELETE /account/addresses/:id`, all `requireAuth`.
  - The first address becomes the default.
  - Setting a default clears the others in one transaction.
  - Deleting the default promotes the most recent remaining address.
  - At most 10 addresses.
  - Another user's id gets 404.
- `GET /account/orders?page=` returns `Paginated<OrderSummaryDTO>`, newest first.
- `GET /orders/:id` returns an `OrderDetailDTO` for the owner only. It applies the lazy expiry check first.
- `toOrderDetailDTO(order)` mapper.
- [x] Integration tests: address CRUD and default rules; ownership 404s; validation 400s.

### Task 5: Checkout + NestaPay demo payments
**Files:**
- `server/src/modules/checkout/{checkout.routes,checkout.controller,checkout.service}.ts`
- `server/src/modules/payments/{payments.routes,payments.controller,payments.service}.ts`
- `server/src/modules/orders/order-expiry.ts`
- `server/src/server.ts` (5-minute sweep)
- `server/test/checkout.int.test.ts`

**Produces:**
- `POST /checkout/orders { addressId }` returns a `CheckoutOrderDTO`. It runs in one transaction:
  1. Cancel the user's other `PENDING_PAYMENT` orders and release their stock.
  2. Re-price the cart with `priceCart` (an invalid coupon is dropped and reported as 409 `CART_CHANGED`).
  3. Reserve stock: `updateMany where stock ≥ qty`. A miss gives 409 `OUT_OF_STOCK` with `details.lines`.
  4. Create the `Order` with the address snapshot, item snapshots and `expiresAt = now + 30m`, an `OrderEvent PENDING_PAYMENT`, and a `Payment CREATED`.

  An empty cart gets 422 `CART_EMPTY`. A missing or foreign address gets 404.
- `POST /payments/demo/authorize` (owner, payment `CREATED`, order `PENDING_PAYMENT` and not expired):
  - `success` stores `gatewayPaymentId` and `method` and returns the signature;
  - `failure` marks the payment `FAILED` and the order `PAYMENT_FAILED`, adds an event, releases stock, and returns the reason.
- `POST /payments/verify` checks the HMAC, ownership, `payment.amount === order.total` and the gateway ids. Then, in one transaction:
  - payment `CAPTURED`, order `CONFIRMED` with `paidAt`, and an event;
  - the `CouponRedemption` and `usedCount++`;
  - `soldCount += qty`, and the cart is cleared.

  It is idempotent: if already captured with the same ids, it returns the order. A bad signature gets 400 `SIGNATURE_INVALID` and the order is left unchanged. An expired order gets 409 `ORDER_EXPIRED`.
- `expireStaleOrders(now)` releases stock and moves orders to `CANCELLED` with an event; it returns the count.
- `checkoutLimiter`: 20/min, keyed by user id.
- [x] Integration tests:
  - happy path (stock decremented, then captured, cart empty, coupon counted, sold count up);
  - tampered signature rejected;
  - failure outcome releases stock;
  - out-of-stock 409;
  - a second checkout cancels the first pending order;
  - expiry sweep restores stock;
  - repeating verify is idempotent;
  - another user can't authorize, verify or read the order.

### Task 6: Wishlist + reviews API
**Files:** `server/src/modules/wishlist/*`, `server/src/modules/catalog/reviews.service.ts` (+ create), `catalog.routes.ts`, `server/test/wishlist-reviews.int.test.ts`.
**Produces:**
- Wishlist endpoints, all `requireAuth`:
  - `GET /wishlist` → `{ productIds: string[] }` (newest first)
  - `POST /wishlist { productId }`
  - `DELETE /wishlist/:productId`
  - `POST /wishlist/sync { productIds }` adds the union, ignoring unknown ids, and returns the merged list
- `POST /products/:slug/reviews` (`requireAuth`, `reviewInputSchema`):
  - creates the review, or updates it if the user already wrote one;
  - `isVerifiedPurchase` is true if the user has a paid order containing the product;
  - recomputes `ratingAvg` (1 dp) and `ratingCount` from published reviews in the same transaction;
  - returns the `ReviewDTO`.
- `GET /products/:slug/reviews/mine` returns the caller's review or null.
- [x] Integration tests: sync union and dedupe; unknown ids ignored; review create, then update, then aggregates change; verified flag after a paid order; 401 for anonymous users.

### Task 7: Client auth foundation + auth pages
**Files:**
- `client/src/lib/auth-client.ts`
- `client/src/proxy.ts`
- `client/src/components/auth/{AuthCard,PasswordField,SessionSync}.tsx`
- `client/src/app/{login,register,forgot-password,reset-password}/page.tsx`
- `Header.tsx`, `MobileMenu.tsx`, `providers.tsx`, `lib/wishlist-store.ts`

**Produces:**
- `authClient = createAuthClient({ plugins: [inferAdditionalFields({ user: { role: { type: "string" }, phone: { type: "string", required: false } } })] })`.
- `useSession` re-exported.
- `proxy.ts`: when there is no Better Auth session cookie (`getSessionCookie`), `/account*` and `/checkout` redirect to `/login?next=<path>`.
- `SessionSync` (mounted in Providers):
  - on sign-in: invalidate the cart query, POST the local wishlist to `/wishlist/sync`, replace local with the server list, and from then on mirror toggles to the server;
  - on sign-out: clear the local wishlist and invalidate the cart.
- Auth pages:
  - accessible forms with labels, inline errors and a show-password toggle;
  - `next` redirect support, restricted to same-site paths;
  - friendly Better Auth error mapping;
  - "Check your inbox" state for forgot-password (and the dev console note);
  - reset-password reads `?token=` and handles an invalid or expired token.
- Header: the Account link shows the first name when signed in, otherwise "Sign in". The mobile drawer gets the same plus "Sign out".
- [x] Browser checks: register → signed in and header updated; sign out; sign in with `next=/checkout`; wrong password message; reset flow using the logged link; `/account` while signed out redirects.

### Task 8: Account area
**Files:** `client/src/app/account/{layout,page}.tsx`, `account/{orders,addresses,wishlist,profile}/page.tsx`, `client/src/components/account/*`, `client/src/lib/account-client.ts`.
**Produces:**
- Account nav: sidebar on desktop, chip row on mobile.
- Overview: greeting, latest 3 orders and quick links.
- Orders list: status chips, totals, links, empty state, pagination.
- Addresses: cards, add/edit dialog form with the state select, default badge, delete with confirmation.
- Wishlist: product grid from the ids via `/products/by-ids`, empty state.
- Profile: name and phone through `authClient.updateUser`, change password, sign out.
- Query hooks: `useAddresses`, `useSaveAddress`, `useDeleteAddress`, `useOrders`, `useOrder(id)`.
- [x] Browser checks for every page at 375 and desktop, including empty states.

### Task 9: Checkout page + NestaPay demo modal
**Files:** `client/src/app/checkout/page.tsx`, `client/src/components/checkout/{CheckoutView,AddressStep,ReviewStep,NestaPayDialog,PaymentForms}.tsx`, `client/src/lib/checkout-client.ts`, `client/src/lib/payment-format.ts` (+ test).
**Produces:**
- Checkout layout: one column on mobile, summary sidebar on desktop.
- Address step: choose a saved address or add one inline.
- Review step: lines and the server summary, with a coupon note.
- "Pay ₹X securely": calls `POST /checkout/orders`, then opens the `NestaPayDialog`, a native modal labelled "NestaPay — demo, no real money".
- Payment tabs:
  - UPI: format check, published test value `success@nestapay`.
  - Card: Luhn check, expiry in the future, CVV 3–4 digits, test card `4111 1111 1111 1111`.
  - Netbanking: bank select.
- "Simulate failure" toggle, processing state, then authorize, then verify, then `router.replace(/orders/:id/confirmed)`.
- Pure helpers in `payment-format.ts`: `luhnValid`, `formatCardNumber`, `expiryValid(mm/yy, now)`, `upiValid`.
- Error states: out of stock (back to cart), cart changed (refresh the summary), payment failed (try again).
- Empty cart shows a link back to the shop.
- [x] TDD the format helpers. Browser checks: full happy path, failure path, keyboard-only through the dialog.

### Task 10: Order confirmation + tracking
**Files:** `client/src/app/orders/[id]/{page,confirmed/page}.tsx`, `client/src/components/orders/{OrderTimeline,OrderItems,OrderTotals,OrderSuccessAnimation,PendingPayment}.tsx`.
**Produces:**
- Both pages read `params` behind Suspense and fetch through `useOrder(id)`.
- Confirmed page:
  - **only** when `isPaid(status)`: `OrderSuccessAnimation` (dog wags, one paw and confetti burst, reduced-motion static), "Woohoo! Your order is on its way!", "Track your order →" and "Continue shopping";
  - pending: "Complete payment", which reopens NestaPay for the same gateway order while `canPay`;
  - failed or cancelled: the real state plus "Return to checkout".
- Tracking page: a step timeline across `ORDER_TRACK_STEPS` with event timestamps in IST, items, totals with GST, the address snapshot and payment info.
- [x] Browser checks: paid → animation shown; directly opening `/confirmed` for a pending order shows no animation; timeline correct.

### Task 11: Reviews UI
**Files:** `client/src/components/pdp/{ReviewForm,StarInput}.tsx`, `Reviews.tsx`.
**Produces:**
- Signed-in users get a "Write a review" (or "Edit your review") panel: radio-group star input, title, body with counters, validation.
- On submit, the review appears immediately at the top with a "Your review" label, plus a success toast.
- Guests see "Sign in to write a review" linking to `/login?next=<pdp>#reviews`.
- [x] Browser checks: create, edit, guest prompt, keyboard star selection.

### Task 12: Verification
- [x] Run all tests, typecheck, lint, Prettier and `next build`.
- [x] Browser flows: register → add to cart as a guest → sign in (cart merged) → checkout → pay → confirmation → tracking → account orders. Then:
  - failure path;
  - wishlist sync across sign-in;
  - writing a review;
  - password reset;
  - checks at 375, 768 and desktop;
  - keyboard-only checkout;
  - reduced-motion check on the success animation.
- [x] Mark this plan done, update the docs, and report to the user (including the Supabase reminder).



---

## Completion notes (2026-10-14)

All 12 tasks are done and verified.

**Automated checks**
- Tests: shared 22, client 42, server 117 (17 files, including the DB integration suites). Server test files now run one at a time (`fileParallelism: false`), because they share one database and assert exact stock counts. Running them in parallel caused a cross-file stock race.
- Typecheck, lint and Prettier are clean.
- `next build` passes (106 pages, proxy active).

**Browser checks**
- Register and sign in; wrong password; sign out; proxy redirect.
- Password reset by the logged link; the token can't be reused.
- Addresses: add, validate, set default, delete.
- Profile update; wishlist sync on sign-in.
- Checkout, then NestaPay with UPI, then the confirmation (celebration only when paid), then tracking.
- Declined card: stock released and the cart kept. "Try again" creates a fresh order.
- A pending order shows "Complete payment" (with netbanking), and the confirmed page for an unpaid order never celebrates.
- Writing a review: "Your review" is pinned and marked as a verified purchase.
- Phone-width layouts.

**Decisions and deviations**
- Profile changes go through Better Auth `update-user`, with a before-hook that validates the name and phone. There is no separate profile endpoint.
- Product rating totals include ratings beyond the written reviews, so a new or edited review adjusts them incrementally in one SQL statement. "Sample review" now means a seeded reviewer, never a real customer.
- Checkout closes the shopper's older unpaid orders. A declined payment closes its order, and "Try again" starts a new one.
- NestaPay netbanking lists fictional demo banks. Card fields set `autocomplete="off"` so browsers never offer real saved cards.
- `/account/wishlist` is open to guests, who see their local list and a prompt to sign in to sync. Every other account page requires sign-in.
- Stage 5 should add on-demand cache revalidation (Express → Next `revalidateTag`) so admin edits and new reviews show on cached catalog pages straight away. Today they appear within about a minute.

**Dev environment notes**
