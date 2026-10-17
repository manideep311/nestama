// Admin operations: fulfilment and cancellation, promotions and coupons on the live storefront,
// review moderation, roles, and the dashboard / report / CSV numbers.
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import request from "supertest";
import type {
  AddressDTO,
  AdminCouponDTO,
  AdminCustomerDetailDTO,
  AdminOrderDetailDTO,
  AdminOverviewDTO,
  AdminPromotionDTO,
  AdminReviewRowDTO,
  AuthorizeResultDTO,
  CheckoutOrderDTO,
  OrderDetailDTO,
  Paginated,
  AdminOrderRowDTO,
  ProductDetailDTO,
  ReviewDTO,
  ReviewListDTO,
  SalesReportDTO,
} from "@nestama/shared";
import { createApp } from "../src/app";
import { prisma } from "../src/lib/prisma";
import { deleteTestUsers, signInAdmin, signUp, type Agent } from "./helpers";

const hasDb = Boolean(process.env.DATABASE_URL);
const TAG = `T${Date.now().toString(36).toUpperCase()}`;
const home = {
  fullName: "Asha Rao",
  phone: "9876543210",
  line1: "12 Lake View Road",
  city: "Hyderabad",
  state: "Telangana",
  pincode: "500081",
};

describe.skipIf(!hasDb)("admin operations API", () => {
  const app = createApp();
  let admin: Agent;
  let adminId = "";
  let shopper: Agent;
  let shopperId = "";
  let biscuits: ProductDetailDTO;
  let harness: ProductDetailDTO;
  let ratingBefore = { ratingAvg: 0, ratingCount: 0 };
  const promotionIds: string[] = [];
  const couponIds: string[] = [];

  async function buy(agent: Agent, variantId: string, quantity = 1, coupon?: string): Promise<string> {
    const addresses = (await agent.get("/api/v1/account/addresses")).body as AddressDTO[];
    const addressId = addresses[0]?.id ?? ((await agent.post("/api/v1/account/addresses").send(home).expect(201)).body as AddressDTO).id;
    await agent.post("/api/v1/cart/items").send({ variantId, quantity }).expect(201);
    if (coupon) await agent.post("/api/v1/cart/coupon").send({ code: coupon }).expect(200);
    const order = (await agent.post("/api/v1/checkout/orders").send({ addressId }).expect(201)).body as CheckoutOrderDTO;
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
    return order.orderId;
  }

  const setStatus = (id: string, status: string, note?: string) => admin.patch(`/api/v1/admin/orders/${id}/status`).send({ status, note });

  beforeAll(async () => {
    const a = await signInAdmin(app);
    admin = a.agent;
    adminId = a.userId;
    const s = await signUp(app, { tag: "shopper", name: "Meera Iyer" });
    shopper = s.agent;
    shopperId = s.userId;
    biscuits = (await request(app).get("/api/v1/products/baked-peanut-butter-biscuits")).body as ProductDetailDTO;
    harness = (await request(app).get("/api/v1/products/adventure-no-pull-harness")).body as ProductDetailDTO;
    ratingBefore = await prisma.product.findUniqueOrThrow({ where: { id: biscuits.id }, select: { ratingAvg: true, ratingCount: true } });
  });

  afterAll(async () => {
    await prisma.promotion.deleteMany({ where: { id: { in: promotionIds } } });
    await deleteTestUsers(); // also returns stock, sold counts and coupon usage for test orders
    await prisma.coupon.deleteMany({ where: { id: { in: couponIds } } });
    await prisma.product.update({ where: { id: biscuits.id }, data: ratingBefore });
    await prisma.$disconnect();
  });

  it("moves an order through fulfilment one step at a time, visible on the customer's tracking", async () => {
    const orderId = await buy(shopper, biscuits.variants[0]!.id);
    const list = (await admin.get(`/api/v1/admin/orders?q=${encodeURIComponent("Meera")}`).expect(200)).body as Paginated<AdminOrderRowDTO>;
    expect(list.items.map((o) => o.id)).toContain(orderId);

    const detail = (await admin.get(`/api/v1/admin/orders/${orderId}`).expect(200)).body as AdminOrderDetailDTO;
    expect(detail).toMatchObject({ status: "CONFIRMED", nextStatus: "PACKED", canCancel: true, customer: { name: "Meera Iyer" } });

    expect((await setStatus(orderId, "SHIPPED")).status).toBe(409); // can't skip packing
    expect((await setStatus(orderId, "PACKED")).body.nextStatus).toBe("SHIPPED");
    const shipped = (await setStatus(orderId, "SHIPPED", "Shipped with BlueDart (demo)")).body as AdminOrderDetailDTO;
    expect(shipped).toMatchObject({ status: "SHIPPED", canCancel: false });
    expect((await setStatus(orderId, "CANCELLED")).status).toBe(409); // too late to cancel

    await setStatus(orderId, "OUT_FOR_DELIVERY").expect(200);
    const delivered = (await setStatus(orderId, "DELIVERED").expect(200)).body as AdminOrderDetailDTO;
    expect(delivered.nextStatus).toBeNull();

    const tracking = (await shopper.get(`/api/v1/orders/${orderId}`).expect(200)).body as OrderDetailDTO;
    expect(tracking.events.map((e) => e.status)).toEqual([
      "PENDING_PAYMENT",
      "CONFIRMED",
      "PACKED",
      "SHIPPED",
      "OUT_FOR_DELIVERY",
      "DELIVERED",
    ]);
    expect(tracking.events.find((e) => e.status === "SHIPPED")?.note).toBe("Shipped with BlueDart (demo)");
  });

  it("cancels a paid, unshipped order and puts back stock, sold count and coupon use", async () => {
    const variant = harness.variants[1]!;
    const before = {
      stock: (await prisma.productVariant.findUniqueOrThrow({ where: { id: variant.id } })).stock,
      sold: (await prisma.product.findUniqueOrThrow({ where: { id: harness.id } })).soldCount,
      used: (await prisma.coupon.findUniqueOrThrow({ where: { code: "NESTAMA20" } })).usedCount,
    };
    const orderId = await buy(shopper, variant.id, 1, "NESTAMA20");
    expect((await prisma.coupon.findUniqueOrThrow({ where: { code: "NESTAMA20" } })).usedCount).toBe(before.used + 1);

    const cancelled = (await setStatus(orderId, "CANCELLED").expect(200)).body as AdminOrderDetailDTO;
    expect(cancelled).toMatchObject({ status: "CANCELLED", canCancel: false, nextStatus: null });
    expect(cancelled.events.at(-1)?.note).toMatch(/refund/i);
    expect((await prisma.productVariant.findUniqueOrThrow({ where: { id: variant.id } })).stock).toBe(before.stock);
    expect((await prisma.product.findUniqueOrThrow({ where: { id: harness.id } })).soldCount).toBe(before.sold);
    expect((await prisma.coupon.findUniqueOrThrow({ where: { code: "NESTAMA20" } })).usedCount).toBe(before.used);
    expect(await prisma.couponRedemption.count({ where: { orderId } })).toBe(0);
    expect((await setStatus(orderId, "PACKED")).status).toBe(409);
  });

  it("runs a promotion on the live storefront and removes it again", async () => {
    const regular = biscuits.variants[0]!.pricing.price;
    const now = Date.now();
    const created = await admin.post("/api/v1/admin/promotions").send({
      name: `Biscuit bonanza ${TAG}`,
      headline: "Half-price biscuits",
      discountPercent: 50,
      startsAt: new Date(now - 60_000).toISOString(),
      endsAt: new Date(now + 3_600_000).toISOString(),
      scope: "PRODUCTS",
      productIds: [biscuits.id],
    });
    expect(created.status, JSON.stringify(created.body)).toBe(201);
    const promo = created.body as AdminPromotionDTO;
    promotionIds.push(promo.id);
    expect(promo).toMatchObject({ status: "live", productIds: [biscuits.id], categoryIds: [] });

    const onSale = (await request(app).get("/api/v1/products/baked-peanut-butter-biscuits").expect(200)).body as ProductDetailDTO;
    expect(onSale.variants[0]!.pricing.salePrice).toBe(Math.round(regular / 2 / 100) * 100);

    // Pausing it restores the regular price; so does deleting.
    const paused = (
      await admin
        .put(`/api/v1/admin/promotions/${promo.id}`)
        .send({ ...promo, isActive: false })
        .expect(200)
    ).body as AdminPromotionDTO;
    expect(paused.status).toBe("paused");
    await admin.delete(`/api/v1/admin/promotions/${promo.id}`).expect(200);
    promotionIds.pop();
    const after = (await request(app).get("/api/v1/products/baked-peanut-butter-biscuits").expect(200)).body as ProductDetailDTO;
    expect(after.variants[0]!.pricing.salePrice).toBe(biscuits.variants[0]!.pricing.salePrice);
  });

  it("manages coupons and protects ones that have been used", async () => {
    const window = { startsAt: new Date(Date.now() - 60_000).toISOString(), endsAt: new Date(Date.now() + 86_400_000).toISOString() };
    const coupon = (
      await admin
        .post("/api/v1/admin/coupons")
        .send({ code: `${TAG}X`, type: "FIXED", value: 5000, ...window })
        .expect(201)
    ).body as AdminCouponDTO;
    couponIds.push(coupon.id);
    expect(coupon).toMatchObject({ code: `${TAG}X`, status: "live", usedCount: 0 });
    expect((await admin.post("/api/v1/admin/coupons").send({ code: `${TAG}X`, type: "FIXED", value: 5000, ...window })).status).toBe(409);

    await buy(shopper, biscuits.variants[0]!.id, 1, `${TAG}X`);
    const blocked = await admin.delete(`/api/v1/admin/coupons/${coupon.id}`);
    expect(blocked.status).toBe(409);
    expect(blocked.body.error.code).toBe("COUPON_USED");
    const off = (
      await admin
        .put(`/api/v1/admin/coupons/${coupon.id}`)
        .send({ ...coupon, isActive: false })
        .expect(200)
    ).body as AdminCouponDTO;
    expect(off.status).toBe("paused");
  });

  it("hides and republishes a review, adjusting the product rating", async () => {
    const review = (
      await shopper
        .post("/api/v1/products/baked-peanut-butter-biscuits/reviews")
        .send({ rating: 1, title: "Not for us", body: "My dog sniffed it and walked away." })
        .expect(201)
    ).body as ReviewDTO;
    const shown = await prisma.product.findUniqueOrThrow({ where: { id: biscuits.id }, select: { ratingCount: true } });

    const hidden = (await admin.patch(`/api/v1/admin/reviews/${review.id}/status`).send({ status: "HIDDEN" }).expect(200))
      .body as AdminReviewRowDTO;
    expect(hidden.status).toBe("HIDDEN");
    const publicList = (await request(app).get("/api/v1/products/baked-peanut-butter-biscuits/reviews").expect(200)).body as ReviewListDTO;
    expect(publicList.items.map((r) => r.id)).not.toContain(review.id);
    expect((await prisma.product.findUniqueOrThrow({ where: { id: biscuits.id } })).ratingCount).toBe(shown.ratingCount - 1);

    await admin.patch(`/api/v1/admin/reviews/${review.id}/status`).send({ status: "PUBLISHED" }).expect(200);
    expect((await prisma.product.findUniqueOrThrow({ where: { id: biscuits.id } })).ratingCount).toBe(shown.ratingCount);
    const queue = (await admin.get("/api/v1/admin/reviews?q=walked%20away").expect(200)).body as Paginated<AdminReviewRowDTO>;
    expect(queue.items[0]).toMatchObject({ id: review.id, authorEmail: expect.stringContaining("@test.nestama.dev") });
    const byName = (await admin.get("/api/v1/admin/reviews?q=meera%20iyer").expect(200)).body as Paginated<AdminReviewRowDTO>;
    expect(byName.items.map((r) => r.id)).toContain(review.id);
  });

  it("changes roles but never removes an admin's own access", async () => {
    const promoted = (await admin.patch(`/api/v1/admin/customers/${shopperId}/role`).send({ role: "ADMIN" }).expect(200))
      .body as AdminCustomerDetailDTO;
    expect(promoted.role).toBe("ADMIN");
    const self = await admin.patch(`/api/v1/admin/customers/${adminId}/role`).send({ role: "CUSTOMER" });
    expect(self.status).toBe(409);
    expect(self.body.error.code).toBe("CANNOT_DEMOTE_SELF");
    await admin.patch(`/api/v1/admin/customers/${shopperId}/role`).send({ role: "CUSTOMER" }).expect(200);

    const detail = (await admin.get(`/api/v1/admin/customers/${shopperId}`).expect(200)).body as AdminCustomerDetailDTO;
    expect(detail.orderCount).toBeGreaterThanOrEqual(2); // delivered + coupon order (the cancelled one doesn't count)
    expect(detail.orders.length).toBeGreaterThanOrEqual(3);
  });

  it("reports dashboard numbers, sales and a CSV that include today's paid orders", async () => {
    const overview = (await admin.get("/api/v1/admin/stats/overview").expect(200)).body as AdminOverviewDTO;
    expect(overview.revenueByDay).toHaveLength(30);
    expect(overview.kpis.orders.value).toBeGreaterThanOrEqual(2);
    expect(overview.kpis.revenue.value).toBe(overview.revenueByDay.reduce((s, d) => s + d.revenue, 0));
    expect(overview.recentOrders.length).toBeGreaterThan(0);

    const week = (await admin.get("/api/v1/admin/reports/sales?range=7d").expect(200)).body as SalesReportDTO;
    expect(week).toMatchObject({ range: "7d", by: "day" });
    expect(week.buckets).toHaveLength(7);
    expect(week.totals.revenue).toBe(week.buckets.reduce((s, b) => s + b.revenue, 0));
    expect(week.byCategory.length).toBeGreaterThan(0);
    expect((await admin.get("/api/v1/admin/reports/sales?range=365d").expect(200)).body.by).toBe("week");

    const csv = await admin.get("/api/v1/admin/reports/orders.csv").expect(200);
    expect(csv.headers["content-type"]).toMatch(/text\/csv/);
    expect(csv.headers["content-disposition"]).toMatch(/attachment; filename="nestama-orders-/);
    const lines = csv.text.replace(/^﻿/, "").split("\r\n");
    expect(lines[0]).toMatch(/^Order,Placed \(IST\),Status,Customer,Email/);
    expect(csv.text).toContain("Meera Iyer");
  });
});
