# NESTAMA — Your True Friend

[![CI](https://github.com/manideep311/nestama/actions/workflows/ci.yml/badge.svg)](https://github.com/manideep311/nestama/actions/workflows/ci.yml)

**Live demo: https://nestama.vercel.app**

A full-stack pet store for dogs and cats: a Next.js storefront, an Express + Prisma API, an admin dashboard, and a demo payment gateway.

> **Portfolio project.** The products are samples and checkout uses NestaPay, a simulated gateway. No real orders are placed and no money moves.

> **First visit may be slow.** The API runs on Render's free plan, which sleeps after 15 minutes without traffic. The first request after that takes about a minute while it wakes up; pages the storefront has already cached load straight away.

| Storefront                                                   | Product page                                                                              | Admin dashboard                                                                            |
| ------------------------------------------------------------ | ----------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------ |
| ![The storefront home page](docs/screenshots/storefront.jpg) | ![A product page with sizes, price and delivery check](docs/screenshots/product-page.jpg) | ![The admin dashboard with KPIs and a revenue chart](docs/screenshots/admin-dashboard.jpg) |

<sub>Captured at 1440×900 from a local run with the seeded catalogue. The dashboard shows that run's own (small) order history.</sub>

## Try it

- **As a shopper, on the live site.**
  - Create an account at https://nestama.vercel.app (and add a pet if you like).
  - Fill the cart and check out with a [NestaPay test value](#demo-values).
  - Each account can pay for three demo orders a day (see [Live demo protections](#live-demo-protections)).
- **As an admin, on your machine.** The live site's admin account isn't shared.
  - Run the store locally ([Running it locally](#running-it-locally)). The seed creates an admin account from the `ADMIN_EMAIL` and `ADMIN_PASSWORD` you choose in `server/.env`.
  - Sign in at http://localhost:3000/login with those details. Admins land on the dashboard at `/admin`: orders, products, inventory, promotions, reports and settings.

## Features

**Storefront**

- An intro film on the first visit that hands its logo off to the header (skippable, and off for reduced motion).
- **Search by meaning**: the typeahead blends keyword matches with semantic similarity from a small embedding model running inside the API, so "stop my dog pulling on walks" finds the no-pull harness. See [Semantic search](#semantic-search).
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

| Command                               | What it does                                                                                                |
| ------------------------------------- | ----------------------------------------------------------------------------------------------------------- |
| `pnpm dev`                            | API and storefront together, with reload                                                                    |
| `pnpm test`                           | All test suites (the API's integration tests need the database)                                             |
| `pnpm typecheck`                      | TypeScript across all packages                                                                              |
| `pnpm --filter client lint`           | ESLint for the storefront                                                                                   |
| `pnpm format` / `pnpm format:check`   | Prettier                                                                                                    |
| `pnpm build`                          | Production builds of the API and the storefront (the storefront build reads the catalog from a running API) |
| `pnpm --filter server db:migrate`     | Create a migration after a schema change                                                                    |
| `pnpm --filter server db:deploy`      | Apply pending migrations                                                                                    |
| `pnpm --filter server db:seed`        | Load the sample catalogue (safe to re-run)                                                                  |
| `pnpm --filter server embed:backfill` | Embed products that have no search vector (`--all` re-embeds every product). The API also does this at boot |
| `pnpm --filter server eval:search`    | Score keyword-only and hybrid search on the evaluation set (`--verbose` lists each query)                   |

### Testing

- **Unit tests** cover pricing, coupons, delivery dates, order status rules, recommendations, CSV export, URL handling and the shared schemas.
- **Integration tests** run the API against a real database with Supertest. They cover:
  - auth, carts, checkout and payment verification;
  - ownership checks between customers;
  - the admin API;
  - rate limits;
  - the access level of every documented route;
  - the OpenAPI document staying in sync with the code.
  - semantic search, with a stand-in embedder so tests never download the model.
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

   | Variable                                          | Value                                                                                                                                           |
   | ------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------- |
   | `DATABASE_URL`, `DIRECT_URL`                      | The Supabase session pooler string                                                                                                              |
   | `CLIENT_ORIGIN`, `BETTER_AUTH_URL`                | The storefront's URL                                                                                                                            |
   | `REVALIDATE_SECRET`                               | A random value of 32+ characters, the same one used in Vercel                                                                                   |
   | `PROXY_SECRET`                                    | A random value of 32+ characters, the same one used in Vercel. The API refuses requests without it, so it can't be called around the storefront |
   | `TRUST_PROXY`                                     | `2` (preset), for Vercel's rewrite plus Render's load balancer                                                                                  |
   | `DEMO_DAILY_ORDER_LIMIT`, `DEMO_RESET_HOURS`      | `3` and `24` (preset): see [Live demo protections](#live-demo-protections)                                                                      |
   | `SEARCH_SEMANTIC_WEIGHT`, `SEARCH_MIN_SIMILARITY` | Optional, default `0.5` and `0.3`: see [Semantic search](#semantic-search). `0` for the weight turns it off                                     |
   | `CLOUDINARY_URL`                                  | Optional, `cloudinary://<key>:<secret>@<cloud>`. Without it, uploads don't survive a redeploy.                                                  |
   | `RESEND_API_KEY`                                  | Optional, for real password-reset emails                                                                                                        |

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

## Live demo protections

Anyone can check out on the live demo, and every paid order lowers stock for good, so two guards keep it usable:

- **A daily cap per account.** Each account can pay for `DEMO_DAILY_ORDER_LIMIT` orders per day, counted in Indian time (default 3). After that, checkout says so and suggests coming back tomorrow.
- **A reset.** Every variant has a restock level, which the seed and any admin stock edit set. A reset puts stock back to that level, less what unpaid orders are still holding. It also gives the seeded promotions and coupons a fresh window once they've ended, so the demo's deals don't run out. It runs:
  - **On a schedule:** the API checks every hour, and resets once `DEMO_RESET_HOURS` have passed since the last one (default 24). On Render's free plan the instance sleeps when idle, so a due reset happens on its next wake-up.
  - **On demand:** **Admin → Inventory → Reset demo stock**.

Setting either variable to `0` turns that guard off.

## Semantic search

The header's typeahead understands what a shopper means, not just the words they type: "stop my dog pulling on walks" finds the no-pull harness, and "keep my cat from scratching the sofa" finds the scratchers.

- **How:** every product has an embedding of its name, species, category and description from [`all-MiniLM-L6-v2`](https://huggingface.co/sentence-transformers/all-MiniLM-L6-v2), stored with pgvector. The model runs inside the API through Transformers.js, so there's no API key and no per-query cost. Results blend keyword matches with cosine similarity; [docs/architecture.md](docs/architecture.md#search) has the details.
- **Settings:**
  - `SEARCH_SEMANTIC_WEIGHT` (default `0.5`): how much similarity counts against the keyword match. `0` is keyword search only, and the model is never loaded.
  - `SEARCH_MIN_SIMILARITY` (default `0.3`): the similarity a product found only by meaning needs to be shown.
- **Keeping vectors current:** the API embeds products without a vector at boot, and admin edits re-embed what they change. `pnpm --filter server embed:backfill --all` re-embeds everything.

### Evaluation

`pnpm --filter server eval:search` runs the 43 queries in [`server/eval/search-questions.json`](server/eval/search-questions.json) against the seeded catalogue, through three searches:

- **Keyword only:** the store's search with semantic search off. Every word must match.
- **Full-text:** a PostgreSQL full-text baseline, which the store doesn't use. Any word can match (stemmed, with English stop words dropped), ranked by `ts_rank`. The name weighs most, then brand, category, tags and species, then the description.
- **Hybrid:** the store's search, at `w = 0.5` and a minimum similarity of 0.3.

33 queries have answers, and each is scored on the first correct product in the top 10. The other 10 are off-catalogue, like "hamster wheel" or "laptop charger": the store sells nothing that fits, so any product shown for them is irrelevant. Results from a local run:

| Queries                                           | Keyword only          | Full-text (any word)  | Hybrid               |
| ------------------------------------------------- | --------------------- | --------------------- | -------------------- |
| 33 with answers: hit@1 / hit@5 / MRR              | 18.2% / 18.2% / 0.182 | 75.8% / 81.8% / 0.796 | 90.9% / 100% / 0.933 |
| 6 keyword-style                                   | 100% / 100% / 1.000   | 100% / 100% / 1.000   | 100% / 100% / 1.000  |
| 26 natural-language                               | 0% / 0% / 0.000       | 69.2% / 76.9% / 0.741 | 88.5% / 100% / 0.915 |
| 1 typo ("tenis ball")                             | 0% / 0% / 0.000       | 100% / 100% / 1.000   | 100% / 100% / 1.000  |
| 10 off-catalogue: queries that show any product   | 0%                    | 40%                   | 40%                  |
| 10 off-catalogue: products shown per query (of 6) | 0.0                   | 0.6                   | 1.4                  |

- **Full-text vs hybrid:** full-text missed "my dog eats too fast", "carry my cat on a flight", "reduce shedding" and "upset stomach dog" entirely. It found "tenis ball" through "ball".
- **Weight:** 0.2, 0.5 and 0.8 scored the same. On this set, the weight only reorders keyword matches, and none of the misses came down to order.
- **Repeatability:** the scores repeat across fresh re-embeds, because products are embedded one at a time (see [docs/architecture.md](docs/architecture.md#search)).

**Choosing `SEARCH_MIN_SIMILARITY`** (`eval:search --min-similarity=…`):

| `SEARCH_MIN_SIMILARITY` | 33 with answers: hit@1 / hit@5 / MRR | Off-catalogue: queries that show any product / products per query |
| ----------------------- | ------------------------------------ | ----------------------------------------------------------------- |
| 0.25                    | 90.9% / 100% / 0.933                 | 70% / 2.8                                                         |
| **0.30 (default)**      | 90.9% / 100% / 0.933                 | 40% / 1.4                                                         |
| 0.31                    | 87.9% / 93.9% / 0.895                | 40% / 1.3                                                         |
| 0.35                    | 87.9% / 90.9% / 0.889                | 30% / 0.6                                                         |
| 0.40                    | 81.8% / 81.8% / 0.818                | 20% / 0.2                                                         |
| 0.45                    | 75.8% / 75.8% / 0.758                | 10% / 0.1                                                         |
| 0.50                    | 72.7% / 72.7% / 0.727                | 0% / 0.0                                                          |

The default stays at 0.30, the highest value that keeps every answered query's correct product in the top 5:

- **Why recall wins:** a typeahead that hides the right product costs more than one that also shows a loosely related one.
- **Going lower** finds nothing new and doubles the irrelevant results.
- **Going higher** loses correct answers fast: 0.31 already drops two from the top 5.
- **It's a narrow edge.** Several correct answers score between 0.300 and 0.319. "reduce shedding", for one, finds the deshedding glove at 0.303. A different model build could move them.

### Limitations

- **A small, home-made test:**
  - The 43 queries and their answers were written for this project, with the catalogue in view, for 73 products. Each answered query is about 3 percentage points, and each off-catalogue query is 10.
  - Some off-catalogue queries were tried while the feature was being built.
  - The threshold was chosen on the same queries it's scored on.
  - So the scores show the approach works on this catalogue, not how it would do with real shoppers' queries.
- **The keyword baseline is strict.** The store's keyword search needs every word to match, so it scores 0 on natural-language queries by design. The full-text baseline is the fairer comparison.
- **Loose matches for things the store doesn't sell.** At the default threshold, 4 of the 10 off-catalogue queries show products:
  - "horse saddle" shows the dog saddlebag, a harness, the car seat cover and the booster bed;
  - "bird cage" shows the scratching lounge, the window hammock and a bowl.
- **Loose matches next to right ones, unmeasured.** Answered queries can also show loosely related products. "upset stomach dog" ranks cat treats first and the probiotic chews fifth, because the model doesn't weigh species strongly. The evaluation only scores where the first correct product lands.
- **English only.** The model was trained on English, so Hindi or Hinglish queries match poorly.
- **Typeahead only.** The `/shop?q=` listing still filters by keywords.
- **A model download.** The quantised model (about 23 MB) comes from the Hugging Face Hub. Render's build fetches it ahead of time (`model:fetch`); the Docker image downloads it on first start. If it can't be loaded, search falls back to keywords.
- **Memory.** Measured in the production Docker image (Linux, Node 24) after boot and the 43 evaluation searches:

  | Run                                                | API process RSS (peak) | Container memory (peak) |
  | -------------------------------------------------- | ---------------------- | ----------------------- |
  | `SEARCH_SEMANTIC_WEIGHT=0` (keywords only)         | 213 MB (213 MB)        | 166 MiB (174 MiB)       |
  | `0.5`, first boot (downloads the model, embeds 73) | 322 MB (322 MB)        | 242 MiB (270 MiB)       |
  | `0.5`, later boot (vectors already stored)         | 303 MB (303 MB)        | 222 MiB (235 MiB)       |
  - **What the model costs:** about 90 to 110 MB of RSS.
  - **The worst peak seen:** one earlier first boot reached 391 MiB of container memory (RSS peak 320 MB), and a repeat didn't reproduce it. That's still under the 512 MB of Render's free plan, but treat about 120 MB as the real headroom.
  - **Speed:** a search request took 46 to 51 ms with the model, and 28 to 39 ms without, across runs. Timings on this machine vary that much.
  - **Not measured on Render.** Its free instances have much less CPU, so expect slower searches there. If memory gets tight, set `SEARCH_SEMANTIC_WEIGHT=0`.

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
- **A large Docker image** (about 2 GB). Better Auth's optional framework integrations (including Next.js) are installed into it, and the search model's runtime adds about 450 MB: `onnxruntime-node` ships its macOS and Windows binaries too (about 220 MB), and Transformers.js brings `onnxruntime-web`, which the API doesn't use (140 MB). It works; a slimmer image needs those excluded.
- **The audit result.** `pnpm audit --prod` reports one low-severity advisory: an `esbuild` dev-server issue, reachable only through Better Auth's optional Vitest integration, which this project doesn't run in production.
