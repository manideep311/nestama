import { describe, expect, it } from "vitest";
import request from "supertest";
import { createApp } from "../src/app";
import { env } from "../src/config/env";

const app = createApp();

describe("cross-site write protection", () => {
  it("refuses writes sent from another site", async () => {
    const res = await request(app).post("/api/v1/newsletter").set("Origin", "https://evil.example").send({ email: "a@b.co" });
    expect(res.status).toBe(403);
    expect(res.body.error.code).toBe("FORBIDDEN_ORIGIN");
  });

  it("refuses an opaque (null) origin on writes", async () => {
    const res = await request(app).delete("/api/v1/cart/coupon").set("Origin", "null");
    expect(res.status).toBe(403);
  });

  it("lets the store's own origin and origin-less callers through", async () => {
    const same = await request(app).post("/api/v1/newsletter").set("Origin", env.CLIENT_ORIGIN).send({ email: "not-an-email" });
    expect(same.status).toBe(400);
    const none = await request(app).post("/api/v1/newsletter").send({ email: "not-an-email" });
    expect(none.status).toBe(400);
  });

  it("never blocks reads", async () => {
    const res = await request(app).get("/api/v1/health").set("Origin", "https://evil.example");
    expect(res.status).toBe(200);
  });
});

describe("health", () => {
  it("reports the database as up", async () => {
    const res = await request(app).get("/api/v1/health");
    expect(res.status).toBe(200);
    expect(res.body).toEqual({ ok: true, db: "up" });
  });
});

describe("rate limits", () => {
  it("allows 60 searches a minute per address, then answers 429", async () => {
    const search = () => request(app).get("/api/v1/search").query({ q: "dog" });
    const statuses = await Promise.all(Array.from({ length: 60 }, () => search().then((r) => r.status)));
    expect(statuses.every((s) => s === 200)).toBe(true);
    const over = await search();
    expect(over.status).toBe(429);
    expect(over.headers["ratelimit-policy"]).toBeDefined();
  });
});
