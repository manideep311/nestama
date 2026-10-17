// Shared integration-test helpers: signed-in Supertest agents and clean-up of test accounts.
import crypto from "node:crypto";
import type { Express } from "express";
import request from "supertest";
import { prisma } from "../src/lib/prisma";

export const ORIGIN = "http://localhost:3000";
export const TEST_EMAIL_DOMAIN = "test.nestama.dev";
export const TEST_PASSWORD = "Wag-tail-2026!";

// Each test file runs in its own module scope, so this tracks only the accounts this file made
// (files run in parallel against the same database).
const createdEmails: string[] = [];

export function testEmail(tag: string): string {
  const email = `t-${tag}-${crypto.randomBytes(4).toString("hex")}@${TEST_EMAIL_DOMAIN}`;
  createdEmails.push(email);
  return email;
}

export type Agent = ReturnType<typeof request.agent>;

/** Registers a fresh customer and returns a cookie-carrying agent signed in as them. */
export async function signUp(app: Express, opts: { tag?: string; name?: string; email?: string; password?: string; agent?: Agent } = {}) {
  const agent = opts.agent ?? request.agent(app);
  const email = opts.email ?? testEmail(opts.tag ?? "user");
  const res = await agent
    .post("/api/auth/sign-up/email")
    .set("Origin", ORIGIN)
    .send({ name: opts.name ?? "Test Pawrent", email, password: opts.password ?? TEST_PASSWORD });
  if (res.status !== 200) throw new Error(`sign-up failed (${res.status}): ${JSON.stringify(res.body)}`);
  return { agent, email, userId: (res.body as { user: { id: string } }).user.id };
}

export async function signIn(agent: Agent, email: string, password = TEST_PASSWORD) {
  return agent.post("/api/auth/sign-in/email").set("Origin", ORIGIN).send({ email, password });
}

const STOCK_HOLDING = ["PENDING_PAYMENT", "CONFIRMED", "PACKED", "SHIPPED", "OUT_FOR_DELIVERY", "DELIVERED"] as const;
const PAID = ["CONFIRMED", "PACKED", "SHIPPED", "OUT_FOR_DELIVERY", "DELIVERED"] as const;

/**
 * Deletes the test accounts this file created, and their orders. Stock still held by those orders (reserved or sold),
 * sold counts and coupon usage are put back, so repeated runs leave the seeded catalog unchanged.
 */
export async function deleteTestUsers(): Promise<void> {
  const users = await prisma.user.findMany({ where: { email: { in: createdEmails } }, select: { id: true } });
  const userIds = users.map((u) => u.id);
  if (userIds.length === 0) return;

  const orders = await prisma.order.findMany({
    where: { userId: { in: userIds } },
    include: { items: true, couponRedemption: true },
  });
  for (const order of orders) {
    const holdsStock = (STOCK_HOLDING as readonly string[]).includes(order.status);
    const paid = (PAID as readonly string[]).includes(order.status);
    for (const item of order.items) {
      if (holdsStock && item.variantId)
        await prisma.productVariant.update({ where: { id: item.variantId }, data: { stock: { increment: item.quantity } } });
      if (paid && item.productId)
        await prisma.product.update({ where: { id: item.productId }, data: { soldCount: { decrement: item.quantity } } });
    }
    if (order.couponRedemption)
      await prisma.coupon.update({ where: { id: order.couponRedemption.couponId }, data: { usedCount: { decrement: 1 } } });
  }
  await prisma.order.deleteMany({ where: { userId: { in: userIds } } });
  await prisma.user.deleteMany({ where: { id: { in: userIds } } });
}

/** A fresh test account promoted to admin, signed in again so its session reflects the role. */
export async function signInAdmin(app: Express) {
  const user = await signUp(app, { tag: "admin", name: "Test Admin" });
  await prisma.user.update({ where: { id: user.userId }, data: { role: "ADMIN" } });
  const res = await signIn(user.agent, user.email);
  if (res.status !== 200) throw new Error(`admin sign-in failed (${res.status})`);
  return user;
}
