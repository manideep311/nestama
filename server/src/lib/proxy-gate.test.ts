import { describe, expect, it } from "vitest";
import express from "express";
import request from "supertest";
import { errorHandler } from "./errors";
import { PROXY_HEADER, proxyGate } from "./proxy-gate";

const SECRET = "storefront-proxy-secret-for-tests-0123456789";

function appWith(secret: string | undefined) {
  const app = express();
  app.set("trust proxy", 2);
  app.use(proxyGate(secret));
  app.get("/api/v1/health", (_req, res) => void res.json({ ok: true }));
  app.post("/api/auth/sign-in/email", (req, res) => void res.json({ ip: req.ip }));
  app.use(errorHandler);
  return app;
}

describe("proxyGate", () => {
  it("refuses direct calls when a secret is configured, even with a forged X-Forwarded-For", async () => {
    const res = await request(appWith(SECRET)).post("/api/auth/sign-in/email").set("X-Forwarded-For", "203.0.113.7, 198.51.100.2");
    expect(res.status).toBe(403);
    expect(res.body.error.code).toBe("DIRECT_ACCESS");
  });

  it("refuses a wrong or partial secret", async () => {
    for (const value of ["wrong", SECRET.slice(0, -1), `${SECRET}x`]) {
      const res = await request(appWith(SECRET)).post("/api/auth/sign-in/email").set(PROXY_HEADER, value);
      expect(res.status).toBe(403);
    }
  });

  it("lets the storefront's requests through", async () => {
    const res = await request(appWith(SECRET))
      .post("/api/auth/sign-in/email")
      .set(PROXY_HEADER, SECRET)
      .set("X-Forwarded-For", "203.0.113.7, 198.51.100.2");
    expect(res.status).toBe(200);
    // Two trusted hops (Vercel, then the host's load balancer): the shopper's address is the key.
    expect(res.body.ip).toBe("203.0.113.7");
  });

  it("keeps the health check open for the host's load balancer", async () => {
    expect((await request(appWith(SECRET)).get("/api/v1/health")).status).toBe(200);
  });

  it("is a no-op without a secret (local development and tests)", async () => {
    expect((await request(appWith(undefined)).post("/api/auth/sign-in/email")).status).toBe(200);
  });
});
