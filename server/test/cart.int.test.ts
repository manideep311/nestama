// Cart integration tests against the seeded database (skipped without DATABASE_URL).
// A Supertest agent keeps the guest cart cookie between requests, like a browser.
import { describe, it, expect, afterAll, beforeAll } from "vitest";
import request from "supertest";
import type { CartDTO, ProductDetailDTO } from "@nestama/shared";
import { createApp } from "../src/app";
import { prisma } from "../src/lib/prisma";

const hasDb = Boolean(process.env.DATABASE_URL);

describe.skipIf(!hasDb)("cart API (guest)", () => {
  const app = createApp();
  let cheapVariantId = ""; // well under the free-shipping threshold
  let lowStockVariantId = "";
  let lowStock = 0;
  const createdCartIds: string[] = [];

  beforeAll(async () => {
    const biscuits = (await request(app).get("/api/v1/products/baked-peanut-butter-biscuits")).body as ProductDetailDTO;
    cheapVariantId = biscuits.variants[0]!.id;
    const lamb = (await request(app).get("/api/v1/products/cuddle-lamb-comfort-toy")).body as ProductDetailDTO;
    lowStockVariantId = lamb.variants[0]!.id;
    lowStock = lamb.variants[0]!.available;
  });

  afterAll(async () => {
    await prisma.cart.deleteMany({ where: { id: { in: createdCartIds } } });
    await prisma.$disconnect();
  });

  it("starts empty without creating a cart", async () => {
    const res = await request(app).get("/api/v1/cart");
    expect(res.status).toBe(200);
    expect((res.body as CartDTO).id).toBeNull();
    expect(res.headers["set-cookie"]).toBeUndefined();
  });

  it("adds, increments, updates and removes lines with server-priced totals", async () => {
    const agent = request.agent(app);

    const first = await agent.post("/api/v1/cart/items").send({ variantId: cheapVariantId, quantity: 1 });
    expect(first.status).toBe(201);
    expect(String(first.headers["set-cookie"])).toMatch(/nst_cart=.*HttpOnly/i);
    const cart1 = first.body as CartDTO;
    createdCartIds.push(cart1.id!);
    expect(cart1.summary.itemCount).toBe(1);
    expect(cart1.summary.shipping).toBe(7900); // ₹349 is below the ₹999 threshold
    expect(cart1.summary.total).toBe(cart1.summary.subtotal + 7900);

    const second = (await agent.post("/api/v1/cart/items").send({ variantId: cheapVariantId, quantity: 2 })).body as CartDTO;
    expect(second.id).toBe(cart1.id);
    expect(second.lines).toHaveLength(1);
    expect(second.lines[0]!.quantity).toBe(3);
    expect(second.summary.subtotal).toBe(second.lines[0]!.unitPrice * 3);

    const lineId = second.lines[0]!.id;
    const bigger = (await agent.patch(`/api/v1/cart/items/${lineId}`).send({ quantity: 3 })).body as CartDTO;
    expect(bigger.summary.itemCount).toBe(3);

    const removed = (await agent.patch(`/api/v1/cart/items/${lineId}`).send({ quantity: 0 })).body as CartDTO;
    expect(removed.lines).toHaveLength(0);
    expect(removed.summary.shipping).toBe(0);
  });

  it("ships free once the goods total reaches the threshold", async () => {
    const agent = request.agent(app);
    const res = await agent.post("/api/v1/cart/items").send({ variantId: cheapVariantId, quantity: 3 });
    const cart = res.body as CartDTO;
    createdCartIds.push(cart.id!);
    expect(cart.summary.subtotal).toBeGreaterThanOrEqual(99900);
    expect(cart.summary.shipping).toBe(0);
    expect(cart.summary.amountToFreeShipping).toBe(0);
  });

  it("refuses more than the available stock", async () => {
    const agent = request.agent(app);
    const res = await agent.post("/api/v1/cart/items").send({ variantId: lowStockVariantId, quantity: lowStock + 1 });
    expect(res.status).toBe(409);
    expect(res.body.error.code).toBe("STOCK_LIMIT");
    expect(res.body.error.details.available).toBe(lowStock);
  });

  it("returns 404 for an unknown variant and 400 for an invalid quantity", async () => {
    const unknown = await request(app).post("/api/v1/cart/items").send({ variantId: "nope", quantity: 1 });
    expect(unknown.status).toBe(404);
    expect(unknown.body.error.code).toBe("VARIANT_NOT_FOUND");
    const invalid = await request(app).post("/api/v1/cart/items").send({ variantId: cheapVariantId, quantity: 0 });
    expect(invalid.status).toBe(400);
  });

  it("does not let one guest touch another guest's line", async () => {
    const owner = request.agent(app);
    const cart = (await owner.post("/api/v1/cart/items").send({ variantId: cheapVariantId, quantity: 1 })).body as CartDTO;
    createdCartIds.push(cart.id!);
    const stranger = request.agent(app);
    const res = await stranger.patch(`/api/v1/cart/items/${cart.lines[0]!.id}`).send({ quantity: 5 });
    expect(res.status).toBe(404);
  });
});

describe.skipIf(!hasDb)("cart coupons", () => {
  const app = createApp();
  const cartIds: string[] = [];
  let biscuitsVariant = "";

  beforeAll(async () => {
    const biscuits = (await request(app).get("/api/v1/products/baked-peanut-butter-biscuits")).body as ProductDetailDTO;
    biscuitsVariant = biscuits.variants[0]!.id;
  });

  afterAll(async () => {
    await prisma.cart.deleteMany({ where: { id: { in: cartIds } } });
  });

  it("rejects codes on an empty cart and unknown codes", async () => {
    const agent = request.agent(app);
    expect((await agent.post("/api/v1/cart/coupon").send({ code: "NESTAMA20" })).body.error.code).toBe("CART_EMPTY");
    const cart = (await agent.post("/api/v1/cart/items").send({ variantId: biscuitsVariant, quantity: 1 })).body as CartDTO;
    cartIds.push(cart.id!);
    const unknown = await agent.post("/api/v1/cart/coupon").send({ code: "nope123" });
    expect(unknown.status).toBe(422);
    expect(unknown.body.error.details.reason).toBe("NOT_FOUND");
  });

  it("explains the minimum order, then applies, re-validates and removes the code", async () => {
    const agent = request.agent(app);
    const small = (await agent.post("/api/v1/cart/items").send({ variantId: biscuitsVariant, quantity: 1 })).body as CartDTO;
    cartIds.push(small.id!);

    const tooSmall = await agent.post("/api/v1/cart/coupon").send({ code: "nestama20" });
    expect(tooSmall.status).toBe(422);
    expect(tooSmall.body.error.details.reason).toBe("MIN_ORDER_NOT_MET");
    expect(tooSmall.body.error.message).toMatch(/^Add ₹[\d,]+ more to use NESTAMA20\.$/);

    const lineId = small.lines[0]!.id;
    await agent.patch(`/api/v1/cart/items/${lineId}`).send({ quantity: 4 });
    const applied = (await agent.post("/api/v1/cart/coupon").send({ code: "NESTAMA20" })).body as CartDTO;
    expect(applied.summary.couponCode).toBe("NESTAMA20");
    expect(applied.summary.couponDiscount).toBe(Math.min(50000, Math.round(applied.summary.subtotal * 0.2)));
    expect(applied.summary.total).toBe(applied.summary.subtotal - applied.summary.couponDiscount + applied.summary.shipping);

    // Shrink the cart below the minimum: the code stays, stops discounting, and says why.
    const shrunk = (await agent.patch(`/api/v1/cart/items/${lineId}`).send({ quantity: 1 })).body as CartDTO;
    expect(shrunk.summary.couponCode).toBe("NESTAMA20");
    expect(shrunk.summary.couponDiscount).toBe(0);
    expect(shrunk.summary.couponNotice).toMatch(/more to use NESTAMA20/);

    const removed = (await agent.delete("/api/v1/cart/coupon")).body as CartDTO;
    expect(removed.summary.couponCode).toBeNull();
    expect(removed.summary.couponNotice).toBeNull();
  });
});
