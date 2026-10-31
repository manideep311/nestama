# Architecture

How NESTAMA fits together: the parts, the data, and the flows that matter most (checkout and payment, sign-in, and the admin side).

## The parts

```text
Browser ──> Next.js storefront (Vercel) ──/api/*, /uploads/*──> Express API (Render) ──> PostgreSQL (Supabase)
                     ^                                               │
                     └──────────── cache revalidation ───────────────┘
```

- **`client/`**: the Next.js storefront and the admin dashboard. Catalog pages are prerendered with cache components and tagged `catalog`. Interactive data (cart, account, admin tables) is fetched in the browser with TanStack Query.
- **`server/`**: the Express API. It handles validation, pricing, stock, orders, payments, auth and admin. Prisma talks to PostgreSQL through the `pg` adapter.
- **`shared/`**: Zod schemas, DTO types and small helpers (money, dates, pet life stages) used by both sides, so a form and the endpoint behind it validate the same way.

The browser only ever talks to the storefront's origin. The storefront's proxy forwards `/api/*` and `/uploads/*` to the API, so session cookies stay first-party.

## Data model

| Area | Tables | Notes |
| --- | --- | --- |
| People | `users`, `sessions`, `accounts`, `verifications`, `addresses`, `pets` | Better Auth owns sessions, accounts and verifications. `role` is `CUSTOMER` or `ADMIN`. A user has up to five pets. |
| Catalog | `categories` (two levels), `brands`, `products`, `product_variants`, `product_images`, `reviews` | Prices and stock live on variants. Products keep rating totals and a sold count for sorting. Reviews can be hidden by an admin. |
| Shopping | `carts`, `cart_items`, `wishlist_items` | A cart belongs to a user or to a guest token cookie; the guest cart merges into the account at sign-in. |
| Promotions | `promotions`, `coupons`, `coupon_redemptions` | Promotions discount by category or product and can feature on the homepage. Coupons have a date window, a minimum order, and overall and per-customer limits. |
| Orders | `orders`, `order_items`, `order_events`, `payments` | Order items copy the name, price and image at purchase time, so later catalog edits don't rewrite history. Every status change is recorded as an event. |
| Settings | `store_settings` (one row) | Free-shipping threshold, announcement text, popular searches. |

Money is stored as whole paise (integers), never as floating-point rupees.

## Checkout and payment

1. **Place the order** (`POST /checkout/orders`).
   - The API re-prices the cart from the database. Each item gets the single best live promotion (promotions never stack), then the coupon applies to the subtotal.
   - It checks stock and creates the order as `PENDING_PAYMENT` with a 30-minute window.
   - It reserves stock by decrementing the variants in the same transaction.
   - Starting a new checkout cancels any earlier unpaid order, returning its stock.
2. **Pay with NestaPay** (the built-in demo gateway).
   - The payment window collects UPI, card or netbanking details and checks them only for format. Nothing typed there is sent to the server.
   - The API "authorizes" the payment and returns an HMAC signature over the gateway order and payment ids. A shopper can also choose a simulated failure.
3. **Verify** (`POST /payments/verify`).
   - The API checks the signature and the amount, then settles everything in one transaction:
     - captures the payment and confirms the order;
     - claims one use of the coupon with a conditional update (`usedCount < usageLimit`), so concurrent payments can't overshoot its limit. If the last use was just taken, nothing is captured: the order closes and its stock returns;
     - records the coupon redemption;
     - adds to each product's sold count;
     - removes the purchased lines from the cart.
   - Conditional updates make a repeated or concurrent verify safe.
4. **Unpaid orders expire.**
   - A sweep every five minutes closes orders past their window and returns their stock.
   - A failed payment closes the order the same way.

Order statuses then move only along allowed transitions:
- `CONFIRMED → PACKED → SHIPPED → OUT_FOR_DELIVERY → DELIVERED`;
- cancellation is allowed until the order ships.

Cancelling a paid order returns stock, reverses the sold count and frees the coupon use.

## Sign-in and access

- **Accounts:** Better Auth provides email and password accounts.
  - Its routes are mounted on the API at `/api/auth/*`.
  - The session cookie is `httpOnly`, `SameSite=Lax`, and `Secure` in production.
  - A signed copy of the session is cached in a cookie for a minute, so most requests skip the session lookup.
- **Roles:** checked on the API, which is the real enforcement point.
  - `requireAuth` protects customer routes.
  - `requireRole("ADMIN")` protects every admin route, and re-reads the role from the database on each request.
  - A test walks every documented route and checks its guard.
- **Page redirects:** the storefront's proxy sends signed-out visitors to the sign-in page before account, checkout, order and admin pages. This is for convenience only.
- **Full page load after sign-in or sign-out:** the router may hold pages it prefetched under the old session, such as a guest's redirect from `/checkout` to sign-in, and a full load discards them.
  - After sign-in, admins land on `/admin` and customers on their account (or the page they came from).
- **Only through the storefront:** in production the storefront's proxy adds a shared secret (`PROXY_SECRET`) to every request it forwards, and the API refuses anything without it (the health check excepted). Direct calls can't reach the API, so the `X-Forwarded-For` it sees is the one Vercel set, and the rate limits key on the shopper's real address.
- **Writes from other sites:** API writes whose `Origin` isn't the storefront's get a 403.

## Admin

The dashboard at `/admin` is the same Next.js app, using the same API with admin-only routes:
- **Dashboard and reports:** KPIs and revenue charts, plus reports by day, week and category with CSV export (spreadsheet formulas neutralised).
- **Catalog:** products with variants, stock and images; categories, brands and inventory. Uploads are checked by their bytes and stored on Cloudinary, or on local disk without it.
- **Sales:** order fulfilment with status history; coupons and promotions.
- **Customers and reviews:** customer details and roles; review moderation.
- **Store settings.**

When an admin changes something shoppers can see, the API calls the storefront's `/revalidate` endpoint with a shared secret. The storefront drops its `catalog` cache, so the change appears without a redeploy.

## Live demo protections

Anyone can check out on the live demo, and each paid order lowers stock permanently, so:

- **A daily cap:** checkout refuses an account that has already paid for `DEMO_DAILY_ORDER_LIMIT` orders today, in Indian time.
- **A reset:** every variant has a `restockLevel`, set by the seed and by admin stock edits. A reset sets stock back to it, less what unpaid orders are holding, and gives the seeded promotions and coupons a new window once they've ended.
  - It runs once `DEMO_RESET_HOURS` have passed (checked at boot and hourly), or from the admin Inventory page.
  - The last run is recorded in `store_settings`.

## Pet recommendations

Each pet's life stage (puppy or kitten, adult, senior) comes from its birthday or an approximate age, computed in Indian time. Picks are ranked by:
- rating, damped for products with few reviews;
- sales;
- a bonus for products tagged for that life stage, and a penalty for products made for the opposite one;
- treats and toys near the pet's birthday.

At most two picks come from any one category, so the row stays varied.

## Search

The header's typeahead (`GET /api/v1/search`) blends two searches:

- **Keywords:** every word must appear in a product's name, brand, category, tags or species. Name matches come first, then best sellers.
- **Meaning:** each product has an embedding, 384 numbers from the `all-MiniLM-L6-v2` model, of its name, species, category and description. It's stored in a pgvector column with an HNSW index. The query is embedded the same way, and the closest products by cosine similarity are candidates.

The blend scores each product as `(1 − w) × keyword + w × similarity`, with `w` from `SEARCH_SEMANTIC_WEIGHT`:
- A keyword match scores 1 at the top, minus 0.01 for each place down, so keyword matches keep their lead and similarity reorders them.
- A product found only by meaning needs a similarity of at least `SEARCH_MIN_SIMILARITY` to be shown.
- `w = 0` is the keyword search alone, and the model is never loaded.

The model runs inside the API (ONNX on the CPU, through Transformers.js), so there's no API key and no per-query cost. Texts are embedded one at a time: the quantised model scales its activations across a whole batch, so a product embedded alongside others came out slightly different (cosine ≈ 0.99 to itself), which was enough to reorder close results between re-embeds. Vectors stay current in three ways:
- The API embeds any product without one at boot.
- Admin edits to a product, or to its category's name, re-embed it.
- Each vector records the model that made it, so a model change re-embeds everything, and vectors from different models are never compared.

If embedding fails, search falls back to keywords and admin edits still save.

`pnpm --filter server eval:search` scores keyword-only, hybrid and a PostgreSQL full-text baseline on a query set written for the project (`server/eval/search-questions.json`), including off-catalogue queries that should show nothing.
