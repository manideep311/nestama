# Stage 5 — Admin Implementation Plan

**Goal:** An admin at `/admin` can run the store without code changes. That covers the dashboard and reports; products (with variants and images), categories, brands and inventory; promotions and coupons; order fulfilment; customers; review moderation; and store settings. Every change shows on the storefront immediately.

**Architecture:**
- **API.** Express gains one `adminRouter` mounted at `/api/v1/admin`, guarded once by `requireRole("ADMIN")`. Each resource has a small service.
- **Pure logic.** Report bucketing, CSV escaping, promotion status, slugs and IST conversion live in `lib/` and are unit tested.
- **Storefront freshness.** Catalog writes call `revalidateStorefront()`, which POSTs to a secret-protected Next route handler that runs `revalidateTag("catalog", { expire: 0 })`. All storefront caches already share the `catalog` tag.
- **Admin client.** A dedicated layout with a forest sidebar and dense tables. TanStack Query hooks in `lib/admin-client.ts`; Recharts for charts.

**Tech Stack:** Express 5, Prisma 7.10, Zod 4, multer 2.4.0 + image-size 2.0.4 (uploads), Next.js 16.4 route handler + `revalidateTag`, React 19.3, TanStack Query 5, Recharts 3.10.1.

**Spec:** `docs/specs/2026-10-10-nestama-design.md`: §12 (Admin), §9 (admin API), §8 (`requireRole`), §3 (Recharts, Cloudinary or local uploads), §13–14.

## Global Constraints

- **No git commands** until the user asks.
- Every `/api/v1/admin/*` route uses `requireRole("ADMIN")`: 401 for anonymous users, 403 for customers. Tests cover both.
- Money is integer paise. Admin forms take rupees and convert with `rupeesToPaise`.
- Promotion and coupon windows are edited as `datetime-local` in **IST** and stored in UTC.
- Storefront changes appear immediately: every catalog, promotion, coupon, settings or review-visibility write revalidates the `catalog` tag.
- Uploads: images only (JPEG/PNG/WebP/AVIF, at most 5 MB). They go to Cloudinary when `CLOUDINARY_URL` is set, otherwise `server/uploads/` served at `/uploads/*`.
- Order status changes follow `canTransition`. Cancelling a paid order that hasn't shipped releases stock and reverses its sold counts. Every change appends an `OrderEvent`.
- An admin can't remove their own admin role, and the last admin can't be demoted.
- CSV export escapes quotes and neutralises spreadsheet formulas (cells starting `= + - @`).
- Every admin screen has loading, empty, error and success states, works at phone width with a drawer nav, and is keyboard reachable.

---

### Task 1: Shared admin contracts + pure libs
**Files:**
- `shared/src/admin.ts` (+ test)
- `server/src/lib/{reports,csv,promotion-status,slug}.ts` (+ tests)
- `client/src/lib/ist.ts` (+ test)

**Produces:**
- **Product input:** `adminProductInputSchema`
  - details: `name`, `slug?`, `shortDescription`, `description`, `petType`, `categoryId`, `brandId`
  - lists: `specs[{label,value}]`, `tags[]`
  - flags: `isActive`, `isFeatured`, `isSample`
  - `variants[{ id?, sku, label, options, price, mrp?, stock, lowStockThreshold, isDefault }]`, where `price ≥ 100` paise, `mrp ≥ price`, exactly one default, and SKUs are unique within the product
  - `images[{ url, alt, width, height }]`, at least 1
- **Other inputs:**
  - `categoryInputSchema`, `brandInputSchema`, `promotionInputSchema` (endsAt > startsAt, percent 1–90)
  - `couponInputSchema` (PERCENT 1–90, or FIXED in paise; endsAt > startsAt)
  - `settingsInputSchema`, `orderStatusUpdateSchema { status, note? }`
  - `roleUpdateSchema`, `reviewStatusSchema`, `stockUpdateSchema { items[{ variantId, stock }] }`
- **DTOs:** list and detail DTOs for each resource, `AdminOverviewDTO`, `SalesReportDTO`.
- **Pure helpers:**
  - `slugify(name)`
  - `promotionStatus({ isActive, startsAt, endsAt }, now)` returns `"scheduled" | "live" | "ended" | "paused"`
  - `bucketRevenue(orders, { from, to, by: "day" | "week" })` with IST day and week boundaries; buckets with zero sales are included
  - `percentChange(cur, prev)`
  - `toCsv(rows, columns)` with escaping and a formula guard
  - IST conversion: `istInputToIso("2026-10-14T18:00")` returns `"2026-10-14T12:30:00.000Z"`; `isoToIstInput(iso)` does the reverse
- [x] TDD each helper and schema edge case.

### Task 2: Admin API foundation: guard, revalidation, settings, uploads
**Files:**
- `server/src/modules/admin/admin.routes.ts`
- `server/src/lib/revalidate.ts`
- `server/src/modules/admin/uploads.ts`
- `server/src/app.ts` (static `/uploads`, mount)
- `client/src/app/revalidate/route.ts`
- env: `REVALIDATE_SECRET` (both apps), `CLIENT_INTERNAL_URL?`
- `server/test/admin.int.test.ts`

**Produces:**
- `adminRouter`, with `requireRole("ADMIN")` applied once.
- `revalidateStorefront()`: fire-and-forget POST with header `x-revalidate-secret`; it logs on failure and never throws.
- Settings: `GET|PUT /admin/settings`.
- `POST /admin/uploads`: multipart field `file`, returning `{ url, width, height }`.
- Test helper `signInAdmin(app)`: creates a test user and promotes it to admin.
- [x] Integration tests:
  - every admin route returns 401 for anonymous users and 403 for customers;
  - updating settings changes `/settings/public`;
  - an upload stores the file and reports its dimensions; a non-image is rejected with 400.

### Task 3: Catalog admin API: products, variants, images, categories, brands, inventory
**Files:** `server/src/modules/admin/{products,taxonomy,inventory}.service.ts` + routes, `server/test/admin-catalog.int.test.ts`.

**Produces:**
- **Products:**
  - `GET /admin/products?q&category&status=active|inactive&stock=low|out&page` (list)
  - `GET /admin/products/:id`
  - `POST /admin/products`
  - `PUT /admin/products/:id`, a full replace that diffs variants and images by id, never deletes variants that have orders (they're deactivated by setting stock 0 instead), and rejects duplicate SKUs with 409
  - `PATCH /admin/products/:id/active`
- **Categories and brands:** CRUD. Delete is blocked with 409 while products reference them.
- **Inventory:** `GET /admin/inventory?low=1&q` and `PATCH /admin/inventory` for bulk stock edits.
- Every write revalidates the storefront.
- [x] Integration tests:
  - create a product, then it appears in the public listing; edit the price, then the public price changes;
  - duplicate SKU or slug gives 409;
  - deactivating hides the product publicly;
  - category delete is blocked while in use;
  - a bulk stock update works.

### Task 4: Promotions, coupons, orders, customers, reviews, stats and reports API
**Files:** `server/src/modules/admin/{promotions,coupons,orders,customers,reviews,stats}.service.ts` + routes, `server/test/admin-ops.int.test.ts`.

**Produces:**
- **Promotions and coupons:** CRUD with status, usage counts and scope relations.
- **Orders:**
  - `GET /admin/orders?status&q&page` (list)
  - `GET /admin/orders/:id`
  - `PATCH /admin/orders/:id/status`, which follows `canTransition`. Cancelling a paid, unshipped order releases stock, reverses sold counts and marks any coupon redemption reversed.
- **Customers:**
  - `GET /admin/customers?q&page` (list)
  - `GET /admin/customers/:id` (orders, spend)
  - `PATCH /admin/customers/:id/role`, guarded against self-demotion and demoting the last admin
- **Reviews:** `GET /admin/reviews?status&q&page` and `PATCH /admin/reviews/:id/status`. Hiding or publishing adjusts rating totals incrementally.
- **Stats and reports:**
  - `GET /admin/stats/overview`: revenue, orders, AOV and customers for the last 30 days versus the previous 30; revenue by day; top products; low stock; recent orders
  - `GET /admin/reports/sales?range=7d|30d|90d|365d`: by day or week, by category, top products
  - `GET /admin/reports/orders.csv`
- [x] Integration tests:
  - advance an order through packed, shipped, out for delivery and delivered, with the events shown on the customer's tracking;
  - an illegal jump gives 409;
  - cancelling restores stock;
  - promotion create applies on the storefront price and delete removes it;
  - coupon CRUD;
  - hiding a review drops it from the public list and adjusts totals;
  - role-change guards;
  - overview and report numbers match the seeded paid orders;
  - CSV has a header, is escaped, and has the right content type.

### Task 5: Admin client shell + dashboard + reports
**Files:**
- `client/src/proxy.ts` (`/admin` matcher)
- `client/src/app/admin/layout.tsx`
- `client/src/components/admin/{AdminShell,AdminUI}.tsx`
- `client/src/lib/admin-client.ts`
- `client/src/app/admin/page.tsx`, `client/src/app/admin/reports/page.tsx`
- `client/src/components/admin/{Dashboard,Reports,charts}.tsx`

**Produces:**
- **Shell:** sidebar on desktop, drawer on phones. Non-admins see a "No access" page; guests are redirected by the proxy.
- **UI kit:** `DataTable`, `Pagination`, `StatusBadge`, `KpiTile`, `Toolbar`, `ConfirmButton`.
- **Dashboard:**
  - KPI tiles with change versus the previous 30 days
  - a revenue-by-day area chart (Recharts)
  - top products, low-stock alerts and recent orders
- **Reports:** range switcher, revenue chart, by-category bars, top products table, and "Download orders CSV".
- [x] Browser checks: guest is redirected, customer gets "No access", admin sees the dashboard with real numbers.

### Task 6: Catalog admin UI
**Files:** `client/src/app/admin/{products,products/new,products/[id],categories,brands,inventory}/page.tsx`, `client/src/components/admin/{ProductList,ProductEditor,TaxonomyManager,Inventory}.tsx`.

**Produces:**
- **Product list:** search, filters, status badges, and an activate/deactivate toggle.
- **Product editor:**
  - details and specs (key/value rows), tags
  - a variants table with add/remove, rupee inputs and a default selector
  - images with upload, alt text, reorder and remove
  - inline validation and a saved toast
- **Categories and brands:** inline create/edit/delete, ordering and home visibility.
- **Inventory:** a low-stock filter and inline stock edits saved in bulk.
- [x] Browser checks: create a product with an uploaded image, then it's visible on the storefront; edit a price, then the storefront updates; deactivate.

### Task 7: Promotions, coupons, orders, customers, reviews, settings UI
**Files:** `client/src/app/admin/{promotions,coupons,orders,orders/[id],customers,customers/[id],reviews,settings}/page.tsx`, `client/src/components/admin/{PromotionManager,CouponManager,OrderAdmin,Customers,ReviewModeration,SettingsForm}.tsx`.

**Produces:**
- **Promotions:** form with IST datetime inputs, scope pickers (categories/products), placement, linked coupon, CTA and theme, plus a status chip.
- **Coupons:** form plus usage display.
- **Orders:** list with a status filter and search. The detail page has items, payment and address, an "Advance to <next>" button, and Cancel with confirmation.
- **Customers:** list, and detail with orders, spend and a role toggle.
- **Reviews:** moderation table with hide/publish.
- **Settings:** form covering announcement, shipping threshold/fee, GST, hero copy, popular searches and support contacts.
- [x] Browser checks:
  - a promotion goes live on the storefront countdown/prices;
  - advance an order, then the customer's tracking timeline updates;
  - hide a review;
  - a settings change shows in the announcement bar.

### Task 8: Verification
- [x] Run all tests, typecheck, lint, Prettier and `next build`.
- [x] Browser: the admin flows above at desktop and 375 px; keyboard pass on the sidebar, tables and forms.
- [x] Mark the plan done, update the docs, report.

## Completion notes (2026-10-14)

All 8 tasks are done and verified.

**Automated checks**
- Tests: shared 31, client 49, server 148 (24 files, including the admin guard, catalog and operations integration suites). The local database is unchanged after a run.
- Typecheck, lint and Prettier are clean.
- `next build` passes (123 pages). Admin routes prerender as static shells.
- No instant-navigation validation errors on any admin route in development.

**Browser checks**
- **Products:** created a product with an uploaded image and two options. It appeared on its product page and in the Toys listing. A price edit showed on the storefront straight away (on-demand revalidation). Deactivating it removed it from listings, and its page shows "Product not found" (`noindex`).
- **Categories and brands:** create, nest, rename and delete. Deleting one that's in use is refused with a clear reason.
- **Inventory:** low-stock filter and a two-row bulk save.
- **Promotions:** a 40% Grooming offer immediately set the storefront price (₹549 → ₹329), with IST start and end times stored correctly. Pausing it restored the previous offer's price.
- **Coupons:** created, then edited from fixed to percent with a cap. The storefront cart applied it correctly. Deleted (allowed only while unused).
- **Orders:** advanced to Packed with a note, and the customer's tracking timeline showed it. Cancelling a paid order restored stock and recorded the demo refund.
- **Reviews:** hiding a review removed it from the product page and the rating count. Republishing restored both.
- **Settings:** an announcement showed first in the storefront bar. Field validation works.
- **Customers:** paid-order counts and spend; role toggle both ways; your own role is locked.
- **Access:** a demoted account sees "No access" and fires no admin requests. The API refuses straight away. The client frame catches up once Better Auth's 60-second session cookie cache expires.
- **375 px:** every admin route has no horizontal page scroll. The drawer nav works, and forms open as bottom sheets.
- **Keyboard:**
  - Tab order runs skip link → nav → page actions → table, with visible focus rings throughout.
  - Modals take focus, close on Escape and return focus to the trigger.
  - Confirm steps focus the safe choice.

**Decisions and deviations**
- The admin shell renders the frame and page skeletons while the session loads. Admin reads wait on an `AdminAccess` context, so non-admins never send them. This replaced `instant = false` on the admin layout, so admin navigation is now validated as instant. The active nav item streams inside `<Suspense>`, because the path is request data on dynamic routes.
- A failed session check shows "Couldn't check your session" with a retry, rather than telling a signed-in admin to sign in.
- `Modal` keeps its content mounted through the closing fade and remounts it on each open. `useModalTarget` keeps the title and form steady while closing. This also fixes the address modal from Stage 4.
- `DataTable` cells share horizontal padding, so headers line up with values. The table scroll area is `relative`, so `sr-only` inputs can't widen the page. Panels are `min-w-0` inside grids.
- The promotion and coupon product picker reuses the inventory endpoint as its product index, so no new API was needed.
- The announcement bar now shows the admin's announcement text first. It was previously stored but never rendered. The seeded text no longer repeats the free-shipping message.
- `AdminSettingsDTO` moved to `@nestama/shared`. Review search also matches the reviewer's name.
- Products are never hard-deleted from the admin; they're hidden instead, because they may have order history.
- Local uploads (no `CLOUDINARY_URL`) aren't resized. The image loader tags them with a width only to satisfy `next/image`. Production should set `CLOUDINARY_URL` (Stage 6).
- Hiding or republishing a review adjusts the stored average incrementally, so repeated toggles can drift by ±0.01.

**For Stage 6**
- The API logs a `pg` deprecation warning ("client.query() when the client is already executing a query"). Trace it, likely to a transaction issuing concurrent queries.
- Deploy configuration must set `CLOUDINARY_URL` and `REVALIDATE_SECRET` on both apps, plus `CLIENT_INTERNAL_URL` on the API.
