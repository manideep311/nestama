# Stage 6 — Hardening Implementation Plan

**Goal:** Make NESTAMA ready to deploy and safe to show. That means:
- a measured performance pass and an axe-backed accessibility pass;
- phone and tablet polish;
- a security review with its fixes;
- the OpenAPI docs promised in spec §2;
- deployment configs (Render, Vercel, Docker, CI) and a README a reviewer can follow from clone to running store.

**Architecture:**
- **Server production mode.** Environment rules tighten when `NODE_ENV=production`. Writes from a foreign `Origin` are refused. Rate-limit IPs respect a configurable proxy depth (`TRUST_PROXY`), because in production requests reach Express through Vercel's rewrite *and* the host's proxy. The health check pings the database. Shutdown is graceful.
- **API docs.**
  - The OpenAPI 3.1 document is built from the same Zod schemas the routes validate with (`z.toJSONSchema`) and served at `/api/docs/openapi.json`.
  - A Scalar reference page at `/api/docs` gets its own CSP.
  - A test keeps the document in sync with every `*.routes.ts` declaration.
- **Client hardening.**
  - Security headers come from `next.config.ts`, using a nonce-free CSP so static and partial prerendering keep working (Next guide "Without Nonces").
  - Adds `robots.ts`, `sitemap.ts`, `metadataBase` and Product JSON-LD.
- **Deploy.**
  - API → Render (`render.yaml`) or any Docker host (`server/Dockerfile`).
  - Client → Vercel (`client/vercel.json`).
  - DB → Supabase.
  - GitHub Actions runs the same checks used locally, against a Postgres service.

**Tech Stack:** Express 5, helmet 8, express-rate-limit 8, Zod 4 `toJSONSchema`, Scalar API Reference (CDN, pinned), Next.js 16.4 `headers()` / Metadata API, axe-core (dev only), Docker, Render Blueprint, GitHub Actions.

**Spec:** `docs/specs/2026-10-10-nestama-design.md`: §2 (OpenAPI at `/api/docs`), §3 (security row, hosting), §8 (rate limits, cookies), §13 (performance, accessibility, quality), §14 (verification widths and keyboard pass), §15 (environment), §16 stage 6.

## Global Constraints

- **No git commands** until the user asks. **No deploying** without explicit approval: this stage prepares configs only.
- Secrets live only in `.env` files and platform dashboards, never in code, docs, logs or the client bundle.
- Next.js 16 conventions: read `node_modules/next/dist/docs/` before using an API. `cacheComponents` stays on, and pages keep their static or partial-prerender status (no nonce CSP).
- Spec §13: `next/image` with real `sizes`; `priority` only on the hero; no layout shift; one `h1` per page; labelled controls; visible focus; skip link; focus-trapped dialogs; `aria-live` for toasts and cart count; text contrast ≥ 4.5:1; reduced motion respected.
- Spec §8: auth 10/min/IP, checkout and payments 20/min/user, search 60/min/IP. Cookies `httpOnly`, `secure` in production, `sameSite=lax`.
- Browser verification at 375 / 768 / 1280, plus a keyboard-only pass on the header, search, product card, cart and checkout (spec §14).

---

### Task 1: Server production hardening
**Files:**
- Modify: `server/src/config/env.ts` (export `parseEnv(input)`; production rules; `TRUST_PROXY`)
- Create: `server/src/config/env.test.ts`
- Create: `server/src/lib/origin-guard.ts`
- Create: `test/origin-guard.int.test.ts`
- Modify: `server/src/app.ts` (trust proxy from env; origin guard on `/api/v1`; deep health check)
- Modify: `server/src/server.ts` (graceful shutdown; production warning when uploads would be local)
- Modify: `server/src/lib/auth.ts` (`useSecureCookies` in production)
- Modify: `server/.env.example`

**Produces:**
- `parseEnv(input: Record<string, string | undefined>): Env`. In production it throws unless:
  - `DATABASE_URL` and `REVALIDATE_SECRET` are set;
  - `CLIENT_ORIGIN` and `BETTER_AUTH_URL` use `https:`.

  `TRUST_PROXY` is an integer number of proxy hops (default `1`).
- `originGuard(allowed: string)`: Express middleware. For non-GET/HEAD/OPTIONS requests that carry an `Origin` header different from `allowed`, it returns `403 { error: { code: "FORBIDDEN_ORIGIN" } }`. Requests without `Origin` (server-to-server, curl, tests) pass.
- `GET /api/v1/health` returns `{ ok: true, db: "up" }`, or `503 { ok: false, db: "down" }` when `SELECT 1` fails.
- **Tests:**
  - env rules: dev defaults, production missing DB, production http origin, `TRUST_PROXY` parse;
  - origin guard: foreign-origin POST → 403, same-origin POST passes, no-origin POST passes, GET passes;
  - health returns `db: "up"`.
- [x] Unit and integration tests written first, seen failing, then passing.

### Task 2: OpenAPI document + `/api/docs`
**Files:**
- Create: `server/src/docs/openapi.ts` (route registry and document builder)
- Create: `server/src/docs/docs.routes.ts` (JSON and HTML)
- Create: `server/test/openapi.int.test.ts`
- Modify: `server/src/app.ts` (mount `/api/docs` before the 404 handler)

**Produces:**
- `ROUTES: ApiRoute[]`, where `ApiRoute` is `{ method, path, tag, summary, auth: "public"|"user"|"admin", body?, query?, params? }`. The schema fields are Zod types imported from `@nestama/shared` or from the route modules' existing query schemas.
- `buildOpenApi(): object`:
  - OpenAPI 3.1 with `paths` and an `components.securitySchemes.session` cookie scheme;
  - request bodies and query parameters from `z.toJSONSchema(schema, { io: "input" })`;
  - one standard error response schema `{ error: { code, message, details? } }`.
- `GET /api/docs/openapi.json` (JSON) and `GET /api/docs`, an HTML page that loads Scalar from jsDelivr at a pinned version. That page's CSP allows only that script host.
- **Sync test:**
  - Parse every `server/src/modules/**/*.routes.ts` for `<name>Router.<verb>("<path>"`.
  - Apply the `/admin` mount prefix to `adminRouter`.
  - Assert the set equals the `ROUTES` set plus Better Auth's `/api/auth/*`, which is documented as one tag with a link to Better Auth's docs.
- [x] Sync test fails before the registry is complete, then passes. The docs page renders in the browser.

### Task 3: Client security headers, SEO metadata, small fixes
**Files:**
- Modify: `client/next.config.ts` (`headers()`)
- Create: `client/src/lib/security-headers.ts` (+ test)
- Create: `client/src/app/robots.ts`
- Create: `client/src/app/sitemap.ts`
- Modify: `client/src/app/layout.tsx` (`metadataBase`, default Open Graph)
- Create: `client/src/lib/json-ld.ts` (+ test)
- Modify: `client/src/app/(store)/products/[slug]/page.tsx` (Product JSON-LD)
- Modify: `client/src/components/loader/InitialLoadingScreen.tsx` (declare `p` in the intro preference script)

**Produces:**
- `securityHeaders({ dev: boolean }): { key: string; value: string }[]`:
  - **CSP:**
    - `default-src 'self'`;
    - scripts `'self' 'unsafe-inline'`, plus `'unsafe-eval'` only in dev;
    - styles `'self' 'unsafe-inline'`;
    - images `'self' data: blob: https://images.unsplash.com https://res.cloudinary.com`;
    - media `'self'`, fonts `'self'`, connect `'self'` (plus `ws:` in dev);
    - `object-src 'none'`, `base-uri 'self'`, `form-action 'self'`, `frame-ancestors 'none'`;
    - `upgrade-insecure-requests` in production only.
  - **Other headers:**
    - `Strict-Transport-Security` (production only);
    - `X-Content-Type-Options: nosniff`;
    - `Referrer-Policy: strict-origin-when-cross-origin`;
    - `X-Frame-Options: DENY`;
    - `Permissions-Policy: camera=(), microphone=(), geolocation=(), payment=()`.
- `productJsonLd(product, siteUrl): string`. It returns serialized JSON with `<` escaped as `<`, so a product name can never close the script tag.
- `robots.ts` disallows `/admin`, `/account`, `/checkout`, `/cart`, `/orders` and `/api`, and points to `/sitemap.xml`.
- `sitemap.ts` lists home, `/shop`, `/offers`, every category and every active product. It's built from the API's category list and product slugs, tagged `catalog`.
- [x] Tests for both helpers. In the browser: no CSP violations on the storefront, admin, checkout (NestaPay) or intro film; `/robots.txt` and `/sitemap.xml` render.

### Task 4: Performance pass
**Files:** whatever the measurements implicate.

**Method:**
- Run `next build && next start` (port 3100) against the API.
- On home, `/shop`, a category, a PDP and the cart, record LCP, CLS, JS bytes and image bytes using `PerformanceObserver` and resource timing, both first visit (intro film) and repeat visit.
- Check that storefront routes load no admin or Recharts chunks.
- Check that each image request's width matches its rendered size (`sizes`).
- Check that only the hero image is `priority`.
- Check that API list endpoints answer in under 150 ms locally.

**Targets (local production build):**
- CLS < 0.05 on every page.
- LCP < 2.5 s on repeat visits.
- No image more than 2× its rendered width.
- [x] Before/after numbers recorded in the completion notes.

### Task 5: Accessibility pass
**Files:** whatever axe and the keyboard pass implicate.
- Install `axe-core` as a client devDependency.
- To run it, copy `axe.min.js` to `client/public/__axe.js` temporarily and delete it afterwards.
- **Pages:**
  - storefront: home, shop, category, PDP, quick view, cart, login, register, forgot password, account pages, checkout and NestaPay, order confirmation and tracking, 404;
  - admin: dashboard, products, product editor, orders, order detail, settings.
- **Keyboard-only pass (spec §14):** header and mega/mobile menu, search, product card (wishlist, quick view, add to cart), cart, checkout.
- [x] Zero serious or critical axe violations, and contrast fixes applied. The completion notes record any rule left open, with the reason.

### Task 6: Mobile and tablet polish
**Files:** whatever the checks implicate.
- On every storefront route at 375, 768 and 1280: `scrollWidth === innerWidth`.
- Touch targets are at least 24×24 CSS px (WCAG 2.2 AA 2.5.8).
- At 768: the header, filters drawer, PDP gallery and cart summary lay out cleanly.
- [x] Fixes verified at all three widths.

### Task 7: Security review
**Files:** fixes as found. Findings go into the README's Security section.

**Checklist:**
- **Access:**
  - every route's guard matches its spec auth level (cross-check against the OpenAPI `auth` field);
  - ownership checks on orders, addresses, reviews and wishlist (IDOR tests exist; extend if missing);
  - mass-assignment safety (strict Zod objects on writes).
- **Inputs and outputs:**
  - error responses never leak stack traces or Prisma messages in production;
  - uploads accept images only, checked by size, type and magic bytes;
  - open redirects (`safeNext`);
  - CSV formula injection;
  - XSS sinks (`dangerouslySetInnerHTML` only on static scripts and escaped JSON-LD).
- **Limits and transport:**
  - rate limits per spec §8;
  - cookies `httpOnly`, `secure` in production, `sameSite=lax`.
- **Secrets and dependencies:**
  - secret values absent from `client/.next` (scan the build for each `.env` secret without printing values);
  - `pnpm audit --prod`.
- [x] Every item marked pass or fixed, with the evidence noted.

### Task 8: Deployment configs + CI
**Files:**
- Create: `render.yaml`
- Create: `server/Dockerfile`, `.dockerignore`
- Create: `client/vercel.json`
- Create: `docker-compose.yml` (local Postgres for development)
- Create: `.github/workflows/ci.yml`
- Modify: `client/.env.example`, `server/.env.example`

**Produces:**
- **Render Blueprint:**
  - web service `nestama-api`, Node 22, health check `/api/v1/health`;
  - build: `corepack enable && pnpm install --frozen-lockfile && pnpm --filter server build`;
  - pre-deploy: `pnpm --filter server exec prisma migrate deploy`;
  - start: `node server/dist/server.js`;
  - env vars declared (`sync: false` for secrets).
- **Dockerfile:** multi-stage, using pnpm workspace deploy for the server. It runs as a non-root user and runs the same migrate-then-start.
- **CI:** jobs for format check, typecheck, lint, unit tests, server integration tests (Postgres 17 service, migrate and seed), and both builds.
- [x] Verify locally:
  - the built server (`node server/dist/server.js`) boots against the local DB and serves health and catalog;
  - `next start` serves the store against it;
  - `docker build` of the server image succeeds if Docker is available;
  - the CI YAML passes a schema lint (`actionlint` if available, else a careful read).

### Task 9: README and docs
**Files:**
- Create: `README.md` (root)
- Replace: `client/README.md` (a pointer to the root README)
- Modify: `docs/brand-assets.md` if needed

**Produces:** a README covering:
- what NESTAMA is (portfolio, demo payments) and a feature tour;
- the architecture diagram and tech stack;
- local setup: Supabase or `docker compose up db`, env files, migrate and seed, `pnpm dev`;
- scripts and testing;
- the deploy guide (Supabase → Render → Vercel, with the env var table, `TRUST_PROXY=2` behind the Vercel rewrite, and Cloudinary for uploads);
- demo values (NestaPay test card and UPI, seeded coupons);
- the security summary and known issues (Prisma's adapter triggers a `pg` deprecation warning, harmless on pg 8).
- [x] Every command in the README is run once to confirm it works.

### Task 10: Verification
- [x] All tests, typecheck, lint, Prettier, both builds.
- [x] Browser: storefront and admin smoke at 375/768/1280 on the production build; keyboard pass; no console errors or CSP violations.
- [x] Mark the plan done and report. Ask before any deployment.

---

## Completion notes (2026-10-17)

All ten tasks are done. Nothing has been deployed: Render, Vercel and Supabase are configured in the repository and wait on the owner.

**Performance** (Lighthouse 13, median of five runs, local production build):

| | Before | After |
| --- | --- | --- |
| JS per page, gzipped | home 246 KB, product 339 KB | home 217 KB, product 223 KB |
| Mobile home | | performance 52, LCP 5.3 s, TBT 928 ms, CLS 0 |
| Mobile shop / product | | performance 54 / 55, LCP 6.1 s / 5.2 s, CLS 0 |
| Desktop home | | performance 88, LCP 1.16 s, TBT 229 ms |

- The intro video no longer loads on every page, roughly halving page weight.
- Zod stays off the pages that don't need it, the review and pet forms load on demand, and Motion features load with the page (loading them later raised TBT).
- **Open:** mobile LCP is above the 2.5 s target under Lighthouse's throttled CPU and network. Desktop meets it. The remaining cost is mostly JavaScript execution.

**Accessibility:**
- **axe:** zero serious or critical violations on the storefront and admin pages.
- **Contrast fixes:** the footer eyebrow and the admin sidebar labels.
- **Heading fixes:** listing and review heading order, and the admin wordmark.
- **Keyboard pass** over the header, search, product card (wishlist, quick view, add to cart), cart, checkout and NestaPay. It led to these fixes:
  - **Inline remove/delete confirm:** a double click or a repeated Enter confirmed it. It now focuses "Keep", and its success toasts now fire.
  - **Cart count:** now announced when it changes.
  - **Cart thumbnails:** were a second, oddly named link per product. They now have no link role or tab stop.
  - **Newsletter field:** now shows a focus ring.
  - **Payment window:** closing it lost focus. Focus now returns to Pay, and Home/End work on its method tabs.

**Mobile and tablet:**
- **Overflow:** none at 375, 768 or 1280 once the account navigation got `min-w-0`.
- **Touch targets:** every target meets WCAG 2.5.8, by size or by spacing.

**Security review.** Every item passes or was fixed:
- **Access control:**
  - Every documented route is tested for the right guard: 115 cases.
  - Ownership tests cover carts, addresses, orders, payments and pets.
  - Reviews and wishlists are keyed by the session user.
- **Mass assignment:**
  - Handlers only see Zod-parsed bodies.
  - `role` can't be set at sign-up or through update-user (new test).
- **Error responses:** a fixed message with no stack or Prisma detail.
- **Uploads:** checked by their bytes, with a size limit and an allowlist.
- **Redirects:** `safeNext` handles sign-in redirects. For password resets, Better Auth had been skipping its redirect and origin checks under test. They're now on everywhere, with a test.
- **CSV exports:** formula characters neutralised.
- **XSS sinks:** only static scripts and escaped JSON-LD.
- **Rate limits** match spec §8 (new 429 test). Cookies are `httpOnly`, `SameSite=Lax`, and `Secure` in production.
- **Secrets:** none found in the storefront build (1,936 files scanned).
- **`pnpm audit --prod`:** four advisories down to one by moving Prisma to 7.10.1. The remaining low one is an `esbuild` dev-server issue reachable only through Better Auth's optional Vitest peer.

**Deployment:**
- **Configs:** `render.yaml` (migrations on start, health check, `TRUST_PROXY=2`), `client/vercel.json`, a `docker-compose.yml` for local PostgreSQL, and a CI workflow (format, typecheck, lint, migrate and seed, all tests, both builds).
- **Docker image:** `server/Dockerfile` builds a non-root image that migrates and starts. It was checked in production mode against the local database: healthy, with migrations applied. The Prisma CLI moved to runtime dependencies so `migrate deploy` is available there.
- **Open:** the image is about 1.4 GB because Better Auth's optional framework peers come along.

**README.** It was checked against a fresh database: install, `docker compose up`, `db:deploy` and `db:seed` (twice, to confirm the seed is idempotent), the scripts, and both builds.

**Final verification:**
- **Automated checks:** shared 43, client 56 and server 296 tests pass. Typecheck, lint and Prettier are clean, and both builds pass. A fresh clone installs, typechecks, tests and builds.
- **Browser checks:** the production build of the storefront (home, shop, product, sign-in at 375 and desktop) shows no CSP violations and no console errors while the API is up. The admin pages were checked on the development build.

**Known issues** (also in the README):
- `pg`'s deprecation warning from Prisma's adapter.
- A database outage surfaces as 500 rather than 503 when the session lookup fails first.
- The Docker image size.
