// Better Auth integration: sign-up/in, profile validation, password reset and the guest-cart merge.
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import request from "supertest";
import type { CartDTO, ProductDetailDTO } from "@nestama/shared";
import { createApp } from "../src/app";
import { prisma } from "../src/lib/prisma";
import { testOutbox } from "../src/lib/mailer";
import { deleteTestUsers, ORIGIN, signIn, signUp, testEmail, TEST_PASSWORD } from "./helpers";

const hasDb = Boolean(process.env.DATABASE_URL);

describe.skipIf(!hasDb)("auth API", () => {
  const app = createApp();
  let biscuitsVariant = "";
  let harnessVariant = "";

  beforeAll(async () => {
    biscuitsVariant = ((await request(app).get("/api/v1/products/baked-peanut-butter-biscuits")).body as ProductDetailDTO).variants[0]!.id;
    harnessVariant = ((await request(app).get("/api/v1/products/adventure-no-pull-harness")).body as ProductDetailDTO).variants[1]!.id;
  });

  afterAll(async () => {
    await deleteTestUsers();
    await prisma.$disconnect();
  });

  it("signs up a customer, sets an httpOnly session cookie and reports the session", async () => {
    const { agent, email } = await signUp(app, { tag: "signup", name: "  Asha   Rao " });
    const session = await agent.get("/api/auth/get-session");
    expect(session.status).toBe(200);
    expect(session.body.user).toMatchObject({ email, name: "Asha Rao", role: "CUSTOMER" });

    const fresh = request.agent(app);
    const res = await signIn(fresh, email);
    expect(res.status).toBe(200);
    expect(String(res.headers["set-cookie"])).toMatch(/nst\.session_token=[^;]+;.*HttpOnly/i);
  });

  it("never lets sign-up choose a role", async () => {
    const email = testEmail("role");
    const res = await request(app)
      .post("/api/auth/sign-up/email")
      .set("Origin", ORIGIN)
      .send({ name: "Sneaky", email, password: TEST_PASSWORD, role: "ADMIN" });
    if (res.status === 200) {
      const user = await prisma.user.findUniqueOrThrow({ where: { email } });
      expect(user.role).toBe("CUSTOMER");
    } else {
      expect(res.status).toBe(400);
    }
  });

  it("never lets a signed-in customer promote themselves", async () => {
    const { agent, email } = await signUp(app, { tag: "role-update" });
    const res = await agent.post("/api/auth/update-user").set("Origin", ORIGIN).send({ name: "Still Sneaky", role: "ADMIN" });
    expect([200, 400]).toContain(res.status);
    const user = await prisma.user.findUniqueOrThrow({ where: { email } });
    expect(user.role).toBe("CUSTOMER");
  });

  it("only sends password-reset links back to the store", async () => {
    const reset = (redirectTo: string) =>
      request(app).post("/api/auth/request-password-reset").set("Origin", ORIGIN).send({ email: testEmail("redirect"), redirectTo });
    for (const foreign of ["https://evil.example/steal", "//evil.example/steal"]) {
      expect((await reset(foreign)).status).toBe(403);
    }
    expect((await reset("/reset-password")).status).toBe(200);
  });

  it("validates name, phone and password length", async () => {
    const send = (body: object) => request(app).post("/api/auth/sign-up/email").set("Origin", ORIGIN).send(body);
    expect((await send({ name: "A", email: testEmail("v1"), password: TEST_PASSWORD })).status).toBe(400);
    expect((await send({ name: "Asha", email: testEmail("v2"), password: TEST_PASSWORD, phone: "12345" })).status).toBe(400);
    expect((await send({ name: "Asha", email: testEmail("v3"), password: "short" })).status).toBe(400);

    const email = testEmail("phone");
    expect((await send({ name: "Asha", email, password: TEST_PASSWORD, phone: "+91 98765 43210" })).status).toBe(200);
    expect((await prisma.user.findUniqueOrThrow({ where: { email } })).phone).toBe("9876543210");
  });

  it("rejects a wrong password", async () => {
    const { email } = await signUp(app, { tag: "wrongpw" });
    const res = await signIn(request.agent(app), email, "not-the-password");
    expect(res.status).toBe(401);
  });

  it("resets a password with the emailed token", async () => {
    const { email } = await signUp(app, { tag: "reset" });
    const ask = await request(app)
      .post("/api/auth/request-password-reset")
      .set("Origin", ORIGIN)
      .send({ email, redirectTo: "/reset-password" });
    expect(ask.status).toBe(200);

    const mail = testOutbox.findLast((m) => m.to === email);
    expect(mail?.subject).toMatch(/reset/i);
    const token = /reset-password\/([^?"\s]+)/.exec(mail!.text)?.[1];
    expect(token).toBeTruthy();

    const reset = await request(app)
      .post("/api/auth/reset-password")
      .set("Origin", ORIGIN)
      .send({ token, newPassword: "Brand-new-bark-1" });
    expect(reset.status).toBe(200);
    expect((await signIn(request.agent(app), email)).status).toBe(401);
    expect((await signIn(request.agent(app), email, "Brand-new-bark-1")).status).toBe(200);
  });

  it("merges the guest cart into the account cart on the first request after sign-in", async () => {
    // An account that already has a harness in its cart…
    const { agent: owner, email } = await signUp(app, { tag: "merge" });
    await owner.post("/api/v1/cart/items").send({ variantId: harnessVariant, quantity: 1 }).expect(201);

    // …and a guest browser with biscuits ×2 and one more harness.
    const browser = request.agent(app);
    await browser.post("/api/v1/cart/items").send({ variantId: biscuitsVariant, quantity: 2 }).expect(201);
    await browser.post("/api/v1/cart/items").send({ variantId: harnessVariant, quantity: 1 }).expect(201);
    const guestCartCount = await prisma.cart.count({
      where: { guestToken: { not: null }, items: { some: { variantId: biscuitsVariant } } },
    });
    expect(guestCartCount).toBeGreaterThan(0);

    expect((await signIn(browser, email)).status).toBe(200);
    const merged = await browser.get("/api/v1/cart");
    expect(String(merged.headers["set-cookie"])).toMatch(/nst_cart=;/);
    const cart = merged.body as CartDTO;
    const qty = Object.fromEntries(cart.lines.map((l) => [l.variantId, l.quantity]));
    expect(qty).toEqual({ [harnessVariant]: 2, [biscuitsVariant]: 2 });

    // The same cart is visible from the account's other session, and the guest cart is gone.
    const fromOwner = (await owner.get("/api/v1/cart")).body as CartDTO;
    expect(fromOwner.id).toBe(cart.id);
    const user = await prisma.user.findUniqueOrThrow({ where: { email }, include: { cart: true } });
    expect(user.cart?.id).toBe(cart.id);
  });
});
