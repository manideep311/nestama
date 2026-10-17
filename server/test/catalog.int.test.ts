// Integration tests against the seeded database. Skipped when DATABASE_URL is not configured.
import { describe, it, expect, afterAll } from "vitest";
import request from "supertest";
import type {
  HomeDTO,
  Paginated,
  ProductCardDTO,
  ProductDetailDTO,
  ProductListResponse,
  ReviewListDTO,
  SearchResultDTO,
} from "@nestama/shared";
import { createApp } from "../src/app";
import { prisma } from "../src/lib/prisma";

const hasDb = Boolean(process.env.DATABASE_URL);

describe.skipIf(!hasDb)("catalog API (seeded DB)", () => {
  const app = createApp();

  afterAll(async () => {
    await prisma.$disconnect();
  });

  it("GET /home returns every homepage section", async () => {
    const res = await request(app).get("/api/v1/home");
    expect(res.status).toBe(200);
    const home = res.body as HomeDTO;
    expect(home.categories.length).toBeGreaterThanOrEqual(8);
    expect(home.petCards).toHaveLength(2);
    expect(home.campaigns.length).toBeGreaterThanOrEqual(4);
    expect(home.countdownPromotion).not.toBeNull();
    expect(Date.parse(home.countdownPromotion!.endsAt)).toBeGreaterThan(Date.parse(home.serverTime));
    expect(home.countdownPromotion!.coupon).toEqual({ code: "NESTAMA20", label: "20% off" });
    expect(home.deals.length).toBeGreaterThanOrEqual(6);
    expect(home.deals.every((d) => d.pricing.discountPercent > 0)).toBe(true);
    expect(home.bestSellers).toHaveLength(8);
    expect(home.recommended.CAT.every((c) => c.petType !== "DOG")).toBe(true);
  });

  it("GET /products filters by pet and sorts by effective price", async () => {
    const res = await request(app).get("/api/v1/products?pet=dog&sort=price-asc&pageSize=48");
    expect(res.status).toBe(200);
    const page = res.body as Paginated<ProductCardDTO>;
    expect(page.items.length).toBeGreaterThan(10);
    expect(page.items.every((p) => p.petType === "DOG" || p.petType === "BOTH")).toBe(true);
    const prices = page.items.map((p) => p.pricing.salePrice);
    expect(prices).toEqual([...prices].sort((a, b) => a - b));
  });

  it("GET /products?category=accessories includes child categories", async () => {
    const res = await request(app).get("/api/v1/products?category=accessories&pageSize=48");
    const slugs = new Set((res.body as Paginated<ProductCardDTO>).items.map((p) => p.category.slug));
    expect(slugs.has("collars-leashes")).toBe(true);
    expect(slugs.has("clothing")).toBe(true);
  });

  it("GET /products combines brand, effective-price and on-sale filters with facets", async () => {
    const res = await request(app).get(
      "/api/v1/products?pet=dog&brand=trailtail&onSale=1&minPrice=400&maxPrice=1500&sort=price-asc&pageSize=48",
    );
    expect(res.status).toBe(200);
    const body = res.body as ProductListResponse;
    expect(body.items.length).toBeGreaterThan(0);
    for (const p of body.items) {
      expect(p.brand).toBe("Trailtail");
      expect(p.pricing.discountPercent).toBeGreaterThan(0);
      expect(p.pricing.salePrice).toBeGreaterThanOrEqual(40000);
      expect(p.pricing.salePrice).toBeLessThanOrEqual(150000);
    }
    // Brand facet ignores the brand filter, so other brands remain visible.
    expect(body.facets.brands.length).toBeGreaterThan(1);
    expect(body.facets.price.min).toBeLessThanOrEqual(body.facets.price.max);
  });

  it("GET /products?q= matches every word across name, brand and tags", async () => {
    const body = (await request(app).get("/api/v1/products?q=rope%20leash")).body as ProductListResponse;
    expect(body.items.map((p) => p.slug)).toContain("trailhead-rope-leash");
  });

  it("GET /search returns ranked product matches", async () => {
    const body = (await request(app).get("/api/v1/search?q=harness")).body as SearchResultDTO;
    expect(body.products.length).toBeGreaterThan(1);
    expect(body.products[0]!.name.toLowerCase()).toContain("harness");
    expect((await request(app).get("/api/v1/search?q=")).status).toBe(400);
  });

  it("GET /products/:slug/reviews returns a consistent summary and sample-labelled reviews", async () => {
    const body = (await request(app).get("/api/v1/products/cloud-bolster-dog-bed/reviews")).body as ReviewListDTO;
    const total = Object.values(body.summary.distribution).reduce((a, b) => a + b, 0);
    expect(total).toBe(body.summary.count);
    expect(body.items.length).toBeGreaterThan(0);
    expect(body.items.every((r) => r.isSample)).toBe(true);
  });

  it("GET /delivery-estimate validates the pincode", async () => {
    const ok = await request(app).get("/api/v1/delivery-estimate?pincode=560001");
    expect(ok.body).toMatchObject({ metro: true, minDays: 2, maxDays: 3 });
    expect((await request(app).get("/api/v1/delivery-estimate?pincode=0123")).status).toBe(400);
  });

  it("rejects invalid pagination with VALIDATION_ERROR", async () => {
    const res = await request(app).get("/api/v1/products?page=0");
    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe("VALIDATION_ERROR");
  });

  it("GET /products/:slug returns variants, images and the category trail", async () => {
    const res = await request(app).get("/api/v1/products/adventure-no-pull-harness");
    expect(res.status).toBe(200);
    const p = res.body as ProductDetailDTO;
    expect(p.variants).toHaveLength(4);
    expect(p.images.length).toBeGreaterThanOrEqual(1);
    expect(p.categoryTrail.map((c) => c.slug)).toEqual(["accessories", "collars-leashes"]);
    // Deal product: the 25% Paw-some Deals promotion applies.
    expect(p.pricing.discountPercent).toBe(25);
  });

  it("unknown product slug is a 404 NOT_FOUND", async () => {
    const res = await request(app).get("/api/v1/products/does-not-exist");
    expect(res.status).toBe(404);
    expect(res.body.error.code).toBe("NOT_FOUND");
  });

  it("POST /newsletter subscribes once and is idempotent", async () => {
    const email = `test-${Date.now()}@example.com`;
    const first = await request(app).post("/api/v1/newsletter").send({ email });
    expect(first.status).toBe(201);
    const again = await request(app).post("/api/v1/newsletter").send({ email });
    expect(again.status).toBe(200);
    expect(again.body.alreadySubscribed).toBe(true);
    await prisma.newsletterSubscriber.delete({ where: { email } });
  });
});
