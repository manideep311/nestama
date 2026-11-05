# NESTAMA API tests

Black-box tests for the NESTAMA REST API, written in Java with **REST Assured** and **JUnit 5**. They call the running API over HTTP the same way the storefront does, so they test what a client actually sees: status codes, response bodies, cookies, headers and error messages.

The server also has its own TypeScript integration tests (Vitest + Supertest, in `server/test`). This suite sits outside the code. It only knows the URL, so it could just as well point at a staging server.

## What it covers

65 tests in 7 classes:

| Class                    | What it checks                                                                                                                                                                                                                               |
| ------------------------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `GatewayAndPlatformTest` | Health check; the proxy gate refuses calls without (or with a wrong) shared secret; 404 and bad-JSON responses use the standard error envelope; security headers are set and `X-Powered-By` is not                                           |
| `CatalogTest`            | Pagination maths (`totalPages = ceil(total / pageSize)`), pages don't overlap, page-size limits, pet filter, `price-asc` ordering, product pages, unknown and invalid slugs, categories, search, delivery estimates and pincode validation   |
| `AuthTest`               | Sign-up returns a `CUSTOMER` and never the password; duplicate email, short password and one-letter name are rejected; a wrong password and an unknown email get the same message; sign-in, session and sign-out; cross-site sign-up blocked |
| `CartTest`               | Guest cart, line total = unit price × quantity, subtotal and total add up, quantity limits (1–20), quantity 0 removes the line, unknown variant, two guests never share a cart, `WELCOME10` maths (10% capped at ₹300), unknown coupons      |
| `CheckoutFlowTest`       | Full purchase: address → cart → order → demo payment → signature check → order confirmed, listed in the account and cart emptied. Also: a forged signature is rejected, a declined payment closes the order, empty cart, extra body fields   |
| `AccessControlTest`      | 401 for anonymous calls, 403 for customers on admin routes, and no IDOR: a customer can't read another's order, ship to another's address or delete it. Cross-site writes are blocked                                                        |
| `AccountTest`            | Address create, list, update and delete (with phone-number normalisation), field-level validation errors, wishlist add and remove                                                                                                            |

Response shapes are also checked against JSON schemas in `src/test/resources/schemas` (product list, product page, cart, checkout order and the error envelope).

## How the tests are written

- **No hard-coded ids.** Products and variants are looked up from the live catalogue at run time (`support/Catalog.java`).
- **Every test makes its own data.** Each customer is a fresh sign-up with a unique `@test.nestama.dev` email, so tests don't depend on each other or on run order.
- **One cookie jar per user.** `support/Session.java` wraps a REST Assured `CookieFilter`, so a session behaves like one browser (guest cart cookie, then the Better Auth session cookie).
- **Money is in paise.** Prices are integers (₹1 = 100), so cart and coupon checks compare exact numbers.
- **Failures are readable.** Each test has a plain-English `@DisplayName`, and REST Assured prints the full request and response only when a check fails.

## Running it

You need Java 21+, Maven, and the API running with a seeded database. From the repository root:

```bash
docker compose up -d db
pnpm --filter server db:deploy && pnpm --filter server db:seed
NODE_ENV=test SEARCH_SEMANTIC_WEIGHT=0 pnpm --filter server dev
```

`NODE_ENV=test` raises the sign-in and checkout rate limits, which a suite that creates dozens of accounts a minute would otherwise hit. `SEARCH_SEMANTIC_WEIGHT=0` uses keyword search, so no embedding model is downloaded.

Then, in another terminal:

```bash
cd api-tests
mvn test
```

| Setting               | System property   | Environment variable    | Default                 |
| --------------------- | ----------------- | ----------------------- | ----------------------- |
| API base URL          | `-Dapi.url`       | `NESTAMA_API_URL`       | `http://localhost:4000` |
| Proxy secret, if set  | `-Dproxy.secret`  | `NESTAMA_PROXY_SECRET`  | none                    |
| Trusted client origin | `-Dclient.origin` | `NESTAMA_CLIENT_ORIGIN` | `http://localhost:3000` |

If the API was started without `PROXY_SECRET`, the two proxy-gate tests are skipped (the gate is open in that case), and everything else still runs.

Reports are written to `target/surefire-reports/`.

## CI

`.github/workflows/api-tests.yml` runs the suite on every push and pull request. It starts PostgreSQL with pgvector, migrates and seeds it, builds and starts the API with a proxy secret, runs `mvn test`, and uploads the Surefire reports as a build artifact.
