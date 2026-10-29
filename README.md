# NESTAMA — Your True Friend

[![CI](https://github.com/manideep311/nestama/actions/workflows/ci.yml/badge.svg)](https://github.com/manideep311/nestama/actions/workflows/ci.yml)

A full-stack pet store for dogs and cats: a Next.js storefront, an Express + Prisma API, an admin dashboard, and a demo payment gateway.

> **Portfolio project.** The products are samples and checkout uses NestaPay, a simulated gateway. No real orders are placed and no money moves.

## Features

**Storefront**

- An intro film on the first visit that hands its logo off to the header (skippable, and off for reduced motion).
- Filterable, sortable listings with shareable URLs, typeahead search, quick view, and product pages with galleries, variants, delivery estimates by pincode, and reviews.
- A cart that works for guests and merges into the account on sign-in, with coupons and stock limits.
- Checkout with saved addresses and NestaPay (UPI, card or netbanking, with a "simulate a failed payment" switch), then order confirmation and tracking.
- Accounts: profile, addresses, order history, and a wishlist that syncs a guest list on sign-in.
- **Pet profiles**: add up to five dogs or cats at sign-up or under _My pets_. Each gets product picks for its life stage (puppy, kitten, adult, senior), with treat and gift ideas when its birthday is near, and the homepage switches to those picks.

**Admin** (`/admin`)

- A dashboard with KPIs and revenue charts, plus reports by day, week and category, with CSV export.
- Products with variants, stock and image uploads; categories, brands and inventory.
- Order fulfilment with status history, coupons and promotions, review moderation, customers, and store settings.

**Engineering**

- One set of Zod schemas validates both the API and the forms.
- An OpenAPI 3.1 reference at `/api/docs`, kept in sync with the routes by a test.
- Accessibility work: keyboard-operable throughout, labelled controls, focus management in dialogs, live regions for the cart and toasts, and reduced-motion support.
- Security headers, rate limits and cross-site write protection, with every route's access level covered by tests (see [Security](#security)).

## Architecture

```mermaid
flowchart LR
  B[Browser] --> V["Next.js storefront<br/>(Vercel)"]
  V -- "/api/* and /uploads/* rewrites" --> A["Express API<br/>(Render or Docker)"]
  A --> D[("PostgreSQL<br/>(Supabase)")]
  A -. optional .-> C[Cloudinary images]
  A -. optional .-> R[Resend email]
  A -- "cache revalidation" --> V
```

The browser only ever talks to the storefront's origin: Next.js rewrites `/api/*` to the API, so session cookies stay first-party. Catalog pages are prerendered and refreshed on demand when an admin changes something.

| Area       | Stack                                                                                                 |
| ---------- | ----------------------------------------------------------------------------------------------------- |
| Storefront | Next.js 16 (App Router, cache components), React 19, Tailwind CSS 4, Motion, TanStack Query, Recharts |
| API        | Express 5, Prisma 7 with the `pg` adapter, Better Auth, Zod 4, helmet, express-rate-limit             |
| Database   | PostgreSQL 17 (Supabase in production, Docker locally)                                                |
| Tooling    | pnpm workspaces, TypeScript, Vitest, Supertest, ESLint, Prettier, GitHub Actions                      |

```text
client/   Next.js storefront and admin dashboard
server/   Express API, Prisma schema, migrations and seed data
shared/   Types, Zod schemas and helpers used by both
docs/     Architecture notes (docs/architecture.md) and brand assets
```

## Running it locally

You need **Node.js 24** or newer, **pnpm 11** (`corepack enable` on Node 24, or `npm install -g pnpm`), and **Docker** for the local database. A Supabase project works instead of Docker.

1. **Install**

   ```bash
   pnpm install
   ```

2. **Start PostgreSQL**

   ```bash
   docker compose up -d db
   ```

3. **Create the env files** from the examples:

   ```bash
   cp server/.env.example server/.env
   cp client/.env.example client/.env.local
   ```

   In `server/.env`:
   - Point both database URLs at the local container:
     `DATABASE_URL="postgresql://nestama:nestama@localhost:5440/nestama"` (and the same for `DIRECT_URL`).
   - Fill each `<random 32+ chars>` with its own random value. This command prints one:
     ```bash
     node -e "console.log(require('crypto').randomBytes(32).toString('base64url'))"
     ```
   - Use the same `REVALIDATE_SECRET` in both files.
   - Choose the `ADMIN_PASSWORD` for the seeded admin account.

4. **Create the tables and load the sample catalogue** (73 products, 182 reviews, coupons and promotions, and the admin account):

   ```bash
   pnpm --filter server db:deploy
   pnpm --filter server db:seed
   ```

5. **Run both apps**

   ```bash
   pnpm dev
   ```

   - The store runs at http://localhost:3000. Add `?intro=1` to replay the intro film.
   - The API runs at http://localhost:4000, with its reference at http://localhost:4000/api/docs.
   - The admin dashboard is at http://localhost:3000/admin. Sign in with `ADMIN_EMAIL` and `ADMIN_PASSWORD` from `server/.env`.

Without `RESEND_API_KEY`, emails such as password resets are printed in the API's console. Without `CLOUDINARY_URL`, admin uploads are saved to `server/uploads/`.

### Demo values

| What             | Value                                                                |
| ---------------- | -------------------------------------------------------------------- |
| NestaPay UPI     | `success@nestapay`                                                   |
| NestaPay card    | `4111 1111 1111 1111`, any future expiry (MM/YY) and any 3-digit CVV |
| A failed payment | Tick "Simulate a failed payment" in the payment window               |
| `NESTAMA20`      | 20% off orders above ₹999 (up to ₹500)                               |
| `WELCOME10`      | 10% off a first order above ₹499 (up to ₹300)                        |
| `FLAT150`        | ₹150 off orders above ₹1,499                                         |

## Scripts

Run from the repository root:

| Command                             | What it does                                                                                                |
| ----------------------------------- | ----------------------------------------------------------------------------------------------------------- |
| `pnpm dev`                          | API and storefront together, with reload                                                                    |
| `pnpm test`                         | All test suites (the API's integration tests need the database)                                             |
| `pnpm typecheck`                    | TypeScript across all packages                                                                              |
| `pnpm --filter client lint`         | ESLint for the storefront                                                                                   |
| `pnpm format` / `pnpm format:check` | Prettier                                                                                                    |
| `pnpm build`                        | Production builds of the API and the storefront (the storefront build reads the catalog from a running API) |
| `pnpm --filter server db:migrate`   | Create a migration after a schema change                                                                    |
| `pnpm --filter server db:deploy`    | Apply pending migrations                                                                                    |
| `pnpm --filter server db:seed`      | Load the sample catalogue (safe to re-run)                                                                  |

### Testing

- **Unit tests** cover pricing, coupons, delivery dates, order status rules, recommendations, CSV export, URL handling and the shared schemas.
- **Integration tests** run the API against a real database with Supertest. They cover:
  - auth, carts, checkout and payment verification;
  - ownership checks between customers;
  - the admin API;
  - rate limits;
  - the access level of every documented route;
  - the OpenAPI document staying in sync with the code.
- **CI** runs formatting, typecheck, lint and all tests against a PostgreSQL service, then builds both apps.

## Deploying

The API goes first, because the storefront build prerenders catalog pages from it.

1. **Database: Supabase.**
   - Create a project.
   - From **Connect → Session pooler**, copy the connection string. Use it for both `DATABASE_URL` and `DIRECT_URL`: the pooler is IPv4, and Render can't reach the IPv6-only direct host.
   - From your machine, with those two values in `server/.env`, load the schema and catalogue:
     ```bash
     pnpm --filter server db:deploy
     pnpm --filter server db:seed
     ```

2. **API: Render.**
   - **New → Blueprint** → this repository. [`render.yaml`](render.yaml) defines the service: build, health check, and migrations on start.
   - Render asks for the values below. It generates `BETTER_AUTH_SECRET` and `DEMO_GATEWAY_SECRET` itself.
   - Until the storefront exists, set `CLIENT_ORIGIN` and `BETTER_AUTH_URL` to the URL Vercel will give it (e.g. `https://nestama.vercel.app`), and update them if that changes.

   | Variable                           | Value                                                                                                                                           |
   | ---------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------- |
   | `DATABASE_URL`, `DIRECT_URL`       | The Supabase session pooler string                                                                                                              |
   | `CLIENT_ORIGIN`, `BETTER_AUTH_URL` | The storefront's URL                                                                                                                            |
   | `REVALIDATE_SECRET`                | A random value of 32+ characters, the same one used in Vercel                                                                                   |
   | `PROXY_SECRET`                     | A random value of 32+ characters, the same one used in Vercel. The API refuses requests without it, so it can't be called around the storefront |
   | `TRUST_PROXY`                      | `2` (preset), for Vercel's rewrite plus Render's load balancer                                                                                  |
   | `CLOUDINARY_URL`                   | Optional, `cloudinary://<key>:<secret>@<cloud>`. Without it, uploads don't survive a redeploy.                                                  |
   | `RESEND_API_KEY`                   | Optional, for real password-reset emails                                                                                                        |

3. **Storefront: Vercel.**
   - **Add New → Project** → this repository, with **Root Directory** set to `client`. [`client/vercel.json`](client/vercel.json) sets the install and build commands.
   - Then redeploy the API if its URLs changed.

   | Variable               | Value                                                                 |
   | ---------------------- | --------------------------------------------------------------------- |
   | `API_URL`              | The Render service URL, e.g. `https://nestama-api.onrender.com`       |
   | `NEXT_PUBLIC_SITE_URL` | The storefront's own URL (used for metadata, the sitemap and JSON-LD) |
   | `REVALIDATE_SECRET`    | The same value as on Render                                           |
   | `PROXY_SECRET`         | The same value as on Render (server-side only, never `NEXT_PUBLIC_`)  |

**Docker instead of Render.** [`server/Dockerfile`](server/Dockerfile) builds a production image that applies pending migrations, then starts the API as a non-root user with a health check. Give it the same variables as the Render table above, plus `BETTER_AUTH_SECRET` and `DEMO_GATEWAY_SECRET` (32+ random characters each), in a `KEY=value` file without quotes (`docker run --env-file` keeps quotes as part of the value):

```bash
docker build -f server/Dockerfile -t nestama-api .
docker run --env-file api.env -p 4000:4000 nestama-api
```

## Security

- **Sessions:** Better Auth cookies are `httpOnly`, `SameSite=Lax`, and `Secure` in production. Roles are re-read from the database on every admin request, and sign-up and profile updates can't set a role.
- **Access control:**
  - Every route's guard matches its documented level (public, customer or admin), and a test enforces it.
  - Customers get a 404 for anyone else's orders, addresses, payments or pets.
- **Input:**
  - Request bodies are parsed with Zod, and unknown fields are dropped.
  - Uploads are accepted by their bytes (JPG, PNG, WebP or AVIF, 5 MB at most), never by file name or MIME type.
  - CSV exports neutralise spreadsheet formulas.
- **Cross-site requests:**
  - In production the API only answers the storefront: its proxy adds a shared secret (`PROXY_SECRET`) to every forwarded request, and direct calls to the API host get a 403. That also keeps the rate limits keyed on the shopper's real IP, which a forged `X-Forwarded-For` can't change.
  - API writes from another origin get a 403.
  - Sign-in redirects only go to paths in the store.
  - Password-reset links only go to the store's own origin.
- **Headers:** a Content Security Policy, HSTS, `nosniff`, `frame-ancestors 'none'` and a strict referrer policy on the storefront, plus helmet on the API.
- **Rate limits:**
  - sign-in and sign-up: 10 a minute per IP;
  - checkout and payments: 20 a minute per customer;
  - search: 60 a minute per IP;
  - reviews and newsletter sign-ups: 10 a minute.
- **Secrets:** they live only in env files and platform settings, and a scan of the storefront build found none of them.

## Known issues

- **A deprecation warning from `pg`.** Prisma's `pg` adapter sometimes runs overlapping queries on one connection, which logs a warning ("Calling client.query() when the client is already executing a query is deprecated"). It's harmless on `pg` 8 and needs a Prisma fix before `pg` 9.
- **A 500 during database outages.** The session lookup fails first and reports a 500 instead of the API's usual 503 "database unavailable". The storefront shows its retry state either way.
- **A large Docker image.** Better Auth's optional framework integrations (including Next.js) are installed into it, so it's bigger than it needs to be (about 1.4 GB). It works; a slimmer image needs those peers excluded.
- **The audit result.** `pnpm audit --prod` reports one low-severity advisory: an `esbuild` dev-server issue, reachable only through Better Auth's optional Vitest integration, which this project doesn't run in production.
