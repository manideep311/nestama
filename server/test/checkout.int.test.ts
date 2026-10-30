// Checkout → NestaPay demo authorize → verify, against the seeded database (skipped without DATABASE_URL).
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import request from "supertest";
import type {
  AddressDTO,
  AuthorizeResultDTO,
  CartDTO,
  CheckoutOrderDTO,
  OrderDetailDTO,
  Paginated,
  OrderSummaryDTO,
  ProductDetailDTO,
} from "@nestama/shared";
import { createApp } from "../src/app";
import { prisma } from "../src/lib/prisma";
import { expireStaleOrders } from "../src/modules/orders/order-expiry";
import { deleteTestUsers, signUp, type Agent } from "./helpers";

const hasDb = Boolean(process.env.DATABASE_URL);

const home = {
  fullName: "Asha Rao",
  phone: "9876543210",
  line1: "12 Lake View Road",
  city: "Hyderabad",
  state: "Telangana",
  pincode: "500081",
};

describe.skipIf(!hasDb)("checkout and NestaPay demo payments", () => {
  const app = createApp();
  let harness = { variantId: "", productId: "" }; // ₹1,349 on sale — clears NESTAMA20's ₹999 minimum
  let biscuits = { variantId: "", productId: "" };
  let lamb = { variantId: "", productId: "" }; // a low-stock toy

  const product = async (slug: string, index = 0) => {
    const p = (await request(app).get(`/api/v1/products/${slug}`)).body as ProductDetailDTO;
    return { variantId: p.variants[index]!.id, productId: p.id };
  };

  beforeAll(async () => {
    harness = await product("adventure-no-pull-harness", 1);
    biscuits = await product("baked-peanut-butter-biscuits");
    lamb = await product("cuddle-lamb-comfort-toy");
  });

  afterAll(async () => {
    await deleteTestUsers();
    await prisma.coupon.deleteMany({ where: { code: { startsWith: "QA-RACE-" } } });
    await prisma.$disconnect();
  });

  const stockOf = async (variantId: string) => (await prisma.productVariant.findUniqueOrThrow({ where: { id: variantId } })).stock;
  const soldOf = async (productId: string) => (await prisma.product.findUniqueOrThrow({ where: { id: productId } })).soldCount;

  async function shopper(tag: string) {
    const { agent, userId } = await signUp(app, { tag });
    const address = (await agent.post("/api/v1/account/addresses").send(home).expect(201)).body as AddressDTO;
    return { agent, userId, addressId: address.id };
  }

  async function addToCart(agent: Agent, variantId: string, quantity = 1) {
    await agent.post("/api/v1/cart/items").send({ variantId, quantity }).expect(201);
  }

  async function placeOrder(agent: Agent, addressId: string) {
    const res = await agent.post("/api/v1/checkout/orders").send({ addressId });
    expect(res.status, JSON.stringify(res.body)).toBe(201);
    return res.body as CheckoutOrderDTO;
  }

  const authorize = (agent: Agent, order: CheckoutOrderDTO, outcome: "success" | "failure" = "success", method = "UPI") =>
    agent.post("/api/v1/payments/demo/authorize").send({ gatewayOrderId: order.gatewayOrderId, method, outcome });

  const verify = (agent: Agent, order: CheckoutOrderDTO, auth: { gatewayPaymentId: string; signature: string }) =>
    agent.post("/api/v1/payments/verify").send({
      orderId: order.orderId,
      gatewayOrderId: order.gatewayOrderId,
      gatewayPaymentId: auth.gatewayPaymentId,
      signature: auth.signature,
    });

  const getOrder = async (agent: Agent, id: string) => (await agent.get(`/api/v1/orders/${id}`).expect(200)).body as OrderDetailDTO;

  it("places an order, takes payment and settles stock, coupon, sold counts and cart", async () => {
    const { agent, addressId } = await shopper("happy");
    await addToCart(agent, harness.variantId, 1);
    await addToCart(agent, biscuits.variantId, 2);
    const cart = (await agent.post("/api/v1/cart/coupon").send({ code: "NESTAMA20" }).expect(200)).body as CartDTO;
    expect(cart.summary.couponDiscount).toBeGreaterThan(0);

    const before = {
      harness: await stockOf(harness.variantId),
      biscuits: await stockOf(biscuits.variantId),
      soldHarness: await soldOf(harness.productId),
      couponUsed: (await prisma.coupon.findUniqueOrThrow({ where: { code: "NESTAMA20" } })).usedCount,
    };

    const order = await placeOrder(agent, addressId);
    expect(order.orderNumber).toMatch(/^NST-[2-9A-HJ-NP-Z]{6}$/);
    expect(order.amount).toBe(cart.summary.total);
    expect(await stockOf(harness.variantId)).toBe(before.harness - 1);
    expect(await stockOf(biscuits.variantId)).toBe(before.biscuits - 2);

    const pending = await getOrder(agent, order.orderId);
    expect(pending).toMatchObject({
      status: "PENDING_PAYMENT",
      canPay: true,
      couponCode: "NESTAMA20",
      total: cart.summary.total,
      itemCount: 3,
    });
    expect(pending.shippingAddress).toMatchObject({ line1: home.line1, pincode: home.pincode });
    expect(pending.events.map((e) => e.status)).toEqual(["PENDING_PAYMENT"]);

    const auth = (await authorize(agent, order).expect(200)).body as AuthorizeResultDTO;
    if (auth.status !== "authorized") throw new Error("expected an authorised payment");
    expect(auth.signature).toMatch(/^[0-9a-f]{64}$/);

    const paid = (await verify(agent, order, auth).expect(200)).body as OrderDetailDTO;
    expect(paid).toMatchObject({ status: "CONFIRMED", canPay: false });
    expect(paid.paidAt).toBeTruthy();
    expect(paid.payment).toMatchObject({ status: "CAPTURED", method: "UPI" });
    expect(paid.events.map((e) => e.status)).toEqual(["PENDING_PAYMENT", "CONFIRMED"]);

    const after = (await agent.get("/api/v1/cart").expect(200)).body as CartDTO;
    expect(after.lines).toEqual([]);
    expect(after.summary.couponCode).toBeNull();
    expect(await soldOf(harness.productId)).toBe(before.soldHarness + 1);
    expect((await prisma.coupon.findUniqueOrThrow({ where: { code: "NESTAMA20" } })).usedCount).toBe(before.couponUsed + 1);
    expect(await prisma.couponRedemption.count({ where: { orderId: order.orderId } })).toBe(1);

    // Verifying again (e.g. a retried request) is harmless.
    const again = (await verify(agent, order, auth).expect(200)).body as OrderDetailDTO;
    expect(again.status).toBe("CONFIRMED");
    expect((await prisma.coupon.findUniqueOrThrow({ where: { code: "NESTAMA20" } })).usedCount).toBe(before.couponUsed + 1);
    expect(await stockOf(harness.variantId)).toBe(before.harness - 1);

    const history = (await agent.get("/api/v1/account/orders").expect(200)).body as Paginated<OrderSummaryDTO>;
    expect(history.items[0]).toMatchObject({ id: order.orderId, status: "CONFIRMED", itemCount: 3 });
  });

  it("never lets concurrent payments use a coupon past its limit", async () => {
    const code = `QA-RACE-${Date.now().toString(36).toUpperCase()}`;
    const now = Date.now();
    await prisma.coupon.create({
      data: { code, type: "FIXED", value: 5000, startsAt: new Date(now - 60_000), endsAt: new Date(now + 3_600_000), usageLimit: 1 },
    });

    // Both shoppers pass the pricing check (the coupon is still unused) and reach the gateway.
    const ready = [];
    for (const tag of ["race-a", "race-b"]) {
      const s = await shopper(tag);
      await addToCart(s.agent, biscuits.variantId, 1);
      await s.agent.post("/api/v1/cart/coupon").send({ code }).expect(200);
      const order = await placeOrder(s.agent, s.addressId);
      const auth = (await authorize(s.agent, order).expect(200)).body as Extract<AuthorizeResultDTO, { status: "authorized" }>;
      ready.push({ agent: s.agent, order, auth });
    }
    const stockBefore = await stockOf(biscuits.variantId);

    const results = await Promise.all(ready.map(({ agent, order, auth }) => verify(agent, order, auth)));
    expect(results.map((r) => r.status).sort()).toEqual([200, 409]);
    const lost = results.findIndex((r) => r.status === 409);
    expect(results[lost]!.body.error.code).toBe("COUPON_EXHAUSTED");

    expect((await prisma.coupon.findUniqueOrThrow({ where: { code } })).usedCount).toBe(1);
    expect(await prisma.couponRedemption.count({ where: { coupon: { code } } })).toBe(1);
    // The shopper who lost the race isn't charged: the order is closed and its stock is back.
    const loser = await prisma.order.findUniqueOrThrow({ where: { id: ready[lost]!.order.orderId }, include: { payments: true } });
    expect(loser.status).toBe("PAYMENT_FAILED");
    expect(loser.payments.every((p) => p.status !== "CAPTURED")).toBe(true);
    expect(await stockOf(biscuits.variantId)).toBe(stockBefore + 1);
  });

  it("rejects a tampered signature and leaves the order unpaid", async () => {
    const { agent, addressId } = await shopper("tamper");
    await addToCart(agent, biscuits.variantId);
    const order = await placeOrder(agent, addressId);
    const auth = (await authorize(agent, order).expect(200)).body as Extract<AuthorizeResultDTO, { status: "authorized" }>;

    const flipped = (auth.signature[0] === "a" ? "b" : "a") + auth.signature.slice(1);
    const bad = await verify(agent, order, { ...auth, signature: flipped });
    expect(bad.status).toBe(400);
    expect(bad.body.error.code).toBe("SIGNATURE_INVALID");
    expect((await verify(agent, order, { ...auth, gatewayPaymentId: "pay_forged0000000000" })).status).toBe(400);

    expect(await getOrder(agent, order.orderId)).toMatchObject({ status: "PENDING_PAYMENT", canPay: true });
  });

  it("releases the stock immediately when a payment is declined", async () => {
    const { agent, addressId } = await shopper("declined");
    await addToCart(agent, biscuits.variantId, 2);
    const before = await stockOf(biscuits.variantId);
    const order = await placeOrder(agent, addressId);
    expect(await stockOf(biscuits.variantId)).toBe(before - 2);

    const result = (await authorize(agent, order, "failure", "CARD").expect(200)).body as AuthorizeResultDTO;
    expect(result).toMatchObject({ status: "failed" });
    expect(await stockOf(biscuits.variantId)).toBe(before);

    const failed = await getOrder(agent, order.orderId);
    expect(failed).toMatchObject({ status: "PAYMENT_FAILED", canPay: false });
    expect(failed.payment).toMatchObject({ status: "FAILED", method: "CARD" });
    expect((await authorize(agent, order).expect(409)).body.error.code).toBe("PAYMENT_CLOSED");

    // The cart is untouched, so the shopper can simply try again.
    expect(((await agent.get("/api/v1/cart")).body as CartDTO).lines).toHaveLength(1);
  });

  it("cancels an earlier unpaid order when the shopper checks out again", async () => {
    const { agent, addressId } = await shopper("again");
    await addToCart(agent, biscuits.variantId, 1);
    const before = await stockOf(biscuits.variantId);
    const first = await placeOrder(agent, addressId);
    const second = await placeOrder(agent, addressId);

    expect((await getOrder(agent, first.orderId)).status).toBe("CANCELLED");
    expect((await getOrder(agent, second.orderId)).status).toBe("PENDING_PAYMENT");
    expect(await stockOf(biscuits.variantId)).toBe(before - 1); // one reservation, not two
  });

  it("expires unpaid orders after their window and returns the stock", async () => {
    const { agent, addressId } = await shopper("expiry");
    await addToCart(agent, biscuits.variantId, 1);
    const before = await stockOf(biscuits.variantId);

    // A late payment attempt is refused…
    const late = await placeOrder(agent, addressId);
    await prisma.order.update({ where: { id: late.orderId }, data: { expiresAt: new Date(Date.now() - 60_000) } });
    expect((await authorize(agent, late).expect(409)).body.error.code).toBe("ORDER_EXPIRED");
    expect(await stockOf(biscuits.variantId)).toBe(before);

    // …and the background sweep closes the rest.
    const idle = await placeOrder(agent, addressId);
    await prisma.order.update({ where: { id: idle.orderId }, data: { expiresAt: new Date(Date.now() - 60_000) } });
    expect(await expireStaleOrders()).toBeGreaterThanOrEqual(1);
    const closed = await getOrder(agent, idle.orderId);
    expect(closed).toMatchObject({ status: "CANCELLED", canPay: false });
    expect(closed.payment?.failureReason).toBe("EXPIRED");
    expect(await stockOf(biscuits.variantId)).toBe(before);
  });

  it("refuses to check out lines that are no longer in stock", async () => {
    const { agent, addressId } = await shopper("stock");
    const original = await stockOf(lamb.variantId);
    expect(original).toBeGreaterThan(1);
    await addToCart(agent, lamb.variantId, Math.min(original, 20));
    try {
      await prisma.productVariant.update({ where: { id: lamb.variantId }, data: { stock: original - 1 } }); // someone else bought one
      const res = await agent.post("/api/v1/checkout/orders").send({ addressId });
      expect(res.status).toBe(409);
      expect(res.body.error.code).toBe("OUT_OF_STOCK");
      expect(res.body.error.details.lines[0]).toMatchObject({ variantId: lamb.variantId, available: original - 1 });
      expect(
        await prisma.order.count({
          where: {
            items: { some: { variantId: lamb.variantId } },
            user: { email: { endsWith: "@test.nestama.dev" } },
            status: "PENDING_PAYMENT",
          },
        }),
      ).toBe(0);
    } finally {
      await prisma.productVariant.update({ where: { id: lamb.variantId }, data: { stock: original } });
    }
  });

  it("only lets the owner pay for or view an order", async () => {
    const alice = await shopper("alice");
    const bob = await shopper("bob");
    await addToCart(alice.agent, biscuits.variantId);
    const order = await placeOrder(alice.agent, alice.addressId);
    const auth = (await authorize(alice.agent, order).expect(200)).body as Extract<AuthorizeResultDTO, { status: "authorized" }>;

    expect((await authorize(bob.agent, order)).status).toBe(404);
    expect((await verify(bob.agent, order, auth)).status).toBe(404);
    expect((await bob.agent.get(`/api/v1/orders/${order.orderId}`)).status).toBe(404);
    await addToCart(bob.agent, biscuits.variantId);
    expect((await bob.agent.post("/api/v1/checkout/orders").send({ addressId: alice.addressId })).status).toBe(404);
  });

  it("needs a signed-in shopper, items and a known address", async () => {
    expect((await request(app).post("/api/v1/checkout/orders").send({ addressId: "x" })).status).toBe(401);
    const { agent, addressId } = await shopper("guards");
    const empty = await agent.post("/api/v1/checkout/orders").send({ addressId });
    expect(empty.status).toBe(422);
    expect(empty.body.error.code).toBe("CART_EMPTY");
    await addToCart(agent, biscuits.variantId);
    expect((await agent.post("/api/v1/checkout/orders").send({ addressId: "missing" })).status).toBe(404);
    expect((await agent.post("/api/v1/checkout/orders").send({ addressId, cardNumber: "4111111111111111" })).status).toBe(400);
  });
});
