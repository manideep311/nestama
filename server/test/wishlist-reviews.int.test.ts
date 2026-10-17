// Wishlist sync and customer reviews (create/update, rating totals, verified purchase).
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import request from "supertest";
import type {
  AddressDTO,
  AuthorizeResultDTO,
  CheckoutOrderDTO,
  ProductDetailDTO,
  ReviewDTO,
  ReviewListDTO,
  WishlistDTO,
} from "@nestama/shared";
import { createApp } from "../src/app";
import { prisma } from "../src/lib/prisma";
import { deleteTestUsers, signUp, type Agent } from "./helpers";

const hasDb = Boolean(process.env.DATABASE_URL);
const SLUG = "baked-peanut-butter-biscuits";

describe.skipIf(!hasDb)("wishlist and reviews API", () => {
  const app = createApp();
  let biscuits: ProductDetailDTO;
  let harness: ProductDetailDTO;
  let ratingBefore = { ratingAvg: 0, ratingCount: 0 };

  beforeAll(async () => {
    biscuits = (await request(app).get(`/api/v1/products/${SLUG}`)).body as ProductDetailDTO;
    harness = (await request(app).get("/api/v1/products/adventure-no-pull-harness")).body as ProductDetailDTO;
    ratingBefore = await prisma.product.findUniqueOrThrow({ where: { id: biscuits.id }, select: { ratingAvg: true, ratingCount: true } });
  });

  afterAll(async () => {
    await deleteTestUsers(); // reviews go with their authors
    await prisma.product.update({ where: { id: biscuits.id }, data: ratingBefore });
    await prisma.$disconnect();
  });

  const rating = () => prisma.product.findUniqueOrThrow({ where: { id: biscuits.id }, select: { ratingAvg: true, ratingCount: true } });

  it("requires sign-in", async () => {
    expect((await request(app).get("/api/v1/wishlist")).status).toBe(401);
    expect((await request(app).post("/api/v1/wishlist/sync").send({ productIds: [] })).status).toBe(401);
    expect(
      (await request(app).post(`/api/v1/products/${SLUG}/reviews`).send({ rating: 5, title: "Great", body: "Lovely treats for my dog." }))
        .status,
    ).toBe(401);
  });

  it("syncs a guest wishlist, ignoring unknown ids and duplicates", async () => {
    const { agent } = await signUp(app, { tag: "wish" });
    await agent.post("/api/v1/wishlist").send({ productId: harness.id }).expect(201);

    const synced = (
      await agent
        .post("/api/v1/wishlist/sync")
        .send({ productIds: [biscuits.id, "no-such-product", harness.id, biscuits.id] })
        .expect(200)
    ).body as WishlistDTO;
    expect([...synced.productIds].sort()).toEqual([biscuits.id, harness.id].sort());

    const removed = (await agent.delete(`/api/v1/wishlist/${harness.id}`).expect(200)).body as WishlistDTO;
    expect(removed.productIds).toEqual([biscuits.id]);
    expect((await agent.post("/api/v1/wishlist").send({ productId: "no-such-product" })).status).toBe(404);
  });

  it("creates then updates a review, adjusting the product's rating totals", async () => {
    const { agent } = await signUp(app, { tag: "review", name: "Asha Rao" });
    const start = await rating();

    const created = await agent
      .post(`/api/v1/products/${SLUG}/reviews`)
      .send({ rating: 1, title: "Not for us", body: "My dog didn't like the taste at all." });
    expect(created.status).toBe(201);
    const review = created.body as ReviewDTO;
    expect(review).toMatchObject({ rating: 1, author: "Asha R.", isVerifiedPurchase: false, isSample: false });

    const afterCreate = await rating();
    expect(afterCreate.ratingCount).toBe(start.ratingCount + 1);
    expect(afterCreate.ratingAvg).toBeCloseTo((start.ratingAvg * start.ratingCount + 1) / (start.ratingCount + 1), 2);

    const list = (await agent.get(`/api/v1/products/${SLUG}/reviews`).expect(200)).body as ReviewListDTO;
    expect(list.items[0]).toMatchObject({ id: review.id, title: "Not for us" });

    const updated = await agent
      .post(`/api/v1/products/${SLUG}/reviews`)
      .send({ rating: 5, title: "Changed our mind", body: "Second try and now she begs for these!" });
    expect(updated.status).toBe(200);
    expect((updated.body as ReviewDTO).id).toBe(review.id);
    const afterUpdate = await rating();
    expect(afterUpdate.ratingCount).toBe(afterCreate.ratingCount);
    expect(afterUpdate.ratingAvg).toBeCloseTo((afterCreate.ratingAvg * afterCreate.ratingCount + 4) / afterCreate.ratingCount, 2);

    const mine = (await agent.get(`/api/v1/products/${SLUG}/reviews/mine`).expect(200)).body as { review: ReviewDTO | null };
    expect(mine.review).toMatchObject({ rating: 5, title: "Changed our mind" });
  });

  it("validates reviews", async () => {
    const { agent } = await signUp(app, { tag: "reviewval" });
    expect(
      (await agent.post(`/api/v1/products/${SLUG}/reviews`).send({ rating: 7, title: "Great", body: "Lovely treats for my dog." })).status,
    ).toBe(400);
    expect((await agent.post(`/api/v1/products/${SLUG}/reviews`).send({ rating: 5, title: "Great", body: "Short" })).status).toBe(400);
    expect(
      (await agent.post("/api/v1/products/no-such-product/reviews").send({ rating: 5, title: "Great", body: "Lovely treats for my dog." }))
        .status,
    ).toBe(404);
  });

  it("marks reviews from paying customers as verified purchases", async () => {
    const { agent } = await signUp(app, { tag: "verified" });
    await buy(agent, biscuits.variants[0]!.id);
    const res = await agent
      .post(`/api/v1/products/${SLUG}/reviews`)
      .send({ rating: 5, title: "Crunchy hit", body: "Gone within a week, ordering again." });
    expect(res.status).toBe(201);
    expect((res.body as ReviewDTO).isVerifiedPurchase).toBe(true);
  });

  async function buy(agent: Agent, variantId: string) {
    const address = (
      await agent
        .post("/api/v1/account/addresses")
        .send({
          fullName: "Test Pawrent",
          phone: "9876543210",
          line1: "1 Bark Street",
          city: "Pune",
          state: "Maharashtra",
          pincode: "411001",
        })
        .expect(201)
    ).body as AddressDTO;
    await agent.post("/api/v1/cart/items").send({ variantId, quantity: 1 }).expect(201);
    const order = (await agent.post("/api/v1/checkout/orders").send({ addressId: address.id }).expect(201)).body as CheckoutOrderDTO;
    const auth = (
      await agent
        .post("/api/v1/payments/demo/authorize")
        .send({ gatewayOrderId: order.gatewayOrderId, method: "UPI", outcome: "success" })
        .expect(200)
    ).body as Extract<AuthorizeResultDTO, { status: "authorized" }>;
    await agent
      .post("/api/v1/payments/verify")
      .send({
        orderId: order.orderId,
        gatewayOrderId: order.gatewayOrderId,
        gatewayPaymentId: auth.gatewayPaymentId,
        signature: auth.signature,
      })
      .expect(200);
  }
});
