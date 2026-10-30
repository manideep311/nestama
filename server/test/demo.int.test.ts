// Live-demo protections: a daily cap on paid orders per account, and the stock and deals reset.
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import request from "supertest";
import type { AddressDTO, AuthorizeResultDTO, CheckoutOrderDTO, DemoResetResultDTO, ProductDetailDTO } from "@nestama/shared";
import { createApp } from "../src/app";
import { prisma } from "../src/lib/prisma";
import { maybeResetDemoStore } from "../src/modules/demo/demo.service";
import { deleteTestUsers, signInAdmin, signUp, type Agent } from "./helpers";

const hasDb = Boolean(process.env.DATABASE_URL);
const HOUR = 3_600_000;

describe.skipIf(!hasDb)("live demo protections", () => {
  const app = createApp();
  let admin: Agent;
  let biscuits = { variantId: "" };

  beforeAll(async () => {
    admin = (await signInAdmin(app)).agent;
    const p = (await request(app).get("/api/v1/products/baked-peanut-butter-biscuits")).body as ProductDetailDTO;
    biscuits = { variantId: p.variants[0]!.id };
  });

  afterAll(async () => {
    await deleteTestUsers();
    await prisma.$disconnect();
  });

  async function shopper(tag: string) {
    const { agent } = await signUp(app, { tag });
    const address = (
      await agent
        .post("/api/v1/account/addresses")
        .send({ fullName: "Demo Tester", phone: "9876543210", line1: "1 Test Road", city: "Pune", state: "Maharashtra", pincode: "411001" })
        .expect(201)
    ).body as AddressDTO;
    return { agent, addressId: address.id };
  }

  async function checkout(agent: Agent, addressId: string) {
    await agent.post("/api/v1/cart/items").send({ variantId: biscuits.variantId, quantity: 1 }).expect(201);
    return agent.post("/api/v1/checkout/orders").send({ addressId });
  }

  async function payFor(agent: Agent, order: CheckoutOrderDTO) {
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

  it("caps paid demo orders per account each day", async () => {
    const { agent, addressId } = await shopper("demo-cap");
    for (let i = 0; i < 3; i++) {
      const placed = await checkout(agent, addressId);
      expect(placed.status, JSON.stringify(placed.body)).toBe(201);
      await payFor(agent, placed.body as CheckoutOrderDTO);
    }
    const fourth = await checkout(agent, addressId);
    expect(fourth.status).toBe(429);
    expect(fourth.body.error.code).toBe("DEMO_DAILY_LIMIT");
  });

  it("restores stock (less what unpaid orders hold) and renews ended seeded deals", async () => {
    const variant = await prisma.productVariant.findUniqueOrThrow({ where: { id: biscuits.variantId } });
    expect(variant.restockLevel).not.toBeNull();
    const level = variant.restockLevel!;

    // A drained shelf, one unit held by an unpaid order, and deals that have run out.
    const { agent, addressId } = await shopper("demo-reset");
    expect((await checkout(agent, addressId)).status).toBe(201);
    await prisma.productVariant.update({ where: { id: variant.id }, data: { stock: 0 } });
    const past = new Date(Date.now() - HOUR);
    await prisma.promotion.update({ where: { slug: "pawsome-deals" }, data: { endsAt: past } });
    await prisma.coupon.update({ where: { code: "NESTAMA20" }, data: { endsAt: past } });

    const result = (await admin.post("/api/v1/admin/demo/reset").expect(200)).body as DemoResetResultDTO;
    expect(result.restockedVariants).toBeGreaterThanOrEqual(1);
    expect(result.renewedDeals).toBeGreaterThanOrEqual(2);

    expect((await prisma.productVariant.findUniqueOrThrow({ where: { id: variant.id } })).stock).toBe(level - 1);
    expect((await prisma.promotion.findUniqueOrThrow({ where: { slug: "pawsome-deals" } })).endsAt.getTime()).toBeGreaterThan(Date.now());
    expect((await prisma.coupon.findUniqueOrThrow({ where: { code: "NESTAMA20" } })).endsAt.getTime()).toBeGreaterThan(Date.now());
  });

  it("runs on its own only once the interval has passed, and 0 turns it off", async () => {
    const now = new Date();
    await prisma.storeSettings.update({ where: { id: 1 }, data: { demoResetAt: new Date(now.getTime() - HOUR) } });
    expect(await maybeResetDemoStore(now, 24)).toBeNull();
    expect(await maybeResetDemoStore(now, 0)).toBeNull();

    await prisma.storeSettings.update({ where: { id: 1 }, data: { demoResetAt: new Date(now.getTime() - 25 * HOUR) } });
    expect(await maybeResetDemoStore(now, 24)).not.toBeNull();
    expect((await prisma.storeSettings.findUniqueOrThrow({ where: { id: 1 } })).demoResetAt?.getTime()).toBe(now.getTime());
  });

  it("treats an admin's stock edit as the new level to restore to", async () => {
    const before = await prisma.productVariant.findUniqueOrThrow({ where: { id: biscuits.variantId } });
    await admin
      .patch("/api/v1/admin/inventory")
      .send({ items: [{ variantId: before.id, stock: 77 }] })
      .expect(200);
    expect((await prisma.productVariant.findUniqueOrThrow({ where: { id: before.id } })).restockLevel).toBe(77);
    await admin
      .patch("/api/v1/admin/inventory")
      .send({ items: [{ variantId: before.id, stock: before.restockLevel! }] })
      .expect(200);
  });
});
