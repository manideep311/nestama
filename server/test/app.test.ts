import { describe, it, expect } from "vitest";
import request from "supertest";
import express from "express";
import { z } from "zod";
import { createApp } from "../src/app";
import { validate } from "../src/lib/validate";
import { errorHandler } from "../src/lib/errors";

describe("app skeleton", () => {
  it("serves health", async () => {
    const res = await request(createApp()).get("/api/v1/health");
    expect(res.status).toBe(200);
    expect(res.body.ok).toBe(true);
  });

  it("returns JSON 404 for unknown routes", async () => {
    const res = await request(createApp()).get("/api/v1/nope");
    expect(res.status).toBe(404);
    expect(res.body.error.code).toBe("NOT_FOUND");
  });

  it("returns 400 VALIDATION_ERROR with field details", async () => {
    const app = express();
    app.get("/t", validate({ query: z.object({ page: z.coerce.number().int().min(1) }) }), (_req, res) => {
      res.json(res.locals.query);
    });
    app.use(errorHandler);

    const bad = await request(app).get("/t?page=0");
    expect(bad.status).toBe(400);
    expect(bad.body.error.code).toBe("VALIDATION_ERROR");
    expect(bad.body.error.details).toBeDefined();

    const ok = await request(app).get("/t?page=2");
    expect(ok.body).toEqual({ page: 2 });
  });
});

describe("database outages", () => {
  it("maps connection failures to 503 DB_UNAVAILABLE", async () => {
    const app = express();
    app.get("/t", () => {
      throw Object.assign(new Error("connect ECONNREFUSED 127.0.0.1:5432"), { code: "ECONNREFUSED" });
    });
    app.use(errorHandler);
    const res = await request(app).get("/t");
    expect(res.status).toBe(503);
    expect(res.body.error.code).toBe("DB_UNAVAILABLE");
  });
});
