import { afterAll, beforeAll, describe, expect, it } from "vitest";
import request from "supertest";
import { createApp } from "../src/app";
import { ROUTES, type ApiRoute } from "../src/docs/openapi";
import { deleteTestUsers, signUp, type Agent } from "./helpers";

const app = createApp();

// Every documented route, checked against the auth level the docs promise. Better Auth's own
// routes are its responsibility; params get a placeholder so the guard, not a lookup, answers.
const routes = ROUTES.filter((r) => r.path.startsWith("/api/v1/"));
const label = (r: ApiRoute) => `${r.method.toUpperCase()} ${r.path}`;
const call = (agent: ReturnType<typeof request> | Agent, r: ApiRoute) => {
  const path = r.path.replace(/:(\w+)/g, "guard-check-$1");
  const req = agent[r.method](path);
  return r.method === "get" || r.method === "delete" ? req : req.send({});
};

let customer: Agent;

beforeAll(async () => {
  ({ agent: customer } = await signUp(app, { tag: "guards" }));
});

afterAll(async () => {
  await deleteTestUsers();
});

describe("route guards match the documented auth level", () => {
  it("covers every kind of route", () => {
    const kinds = new Set(routes.map((r) => r.auth));
    expect([...kinds].sort()).toEqual(["admin", "public", "user"]);
  });

  it.each(routes.filter((r) => r.auth !== "public").map((r) => [label(r), r] as const))("%s refuses anonymous callers", async (_, r) => {
    const res = await call(request(app), r);
    expect(res.status).toBe(401);
    expect(res.body.error.code).toBe("UNAUTHENTICATED");
  });

  it.each(routes.filter((r) => r.auth === "admin").map((r) => [label(r), r] as const))("%s refuses customers", async (_, r) => {
    const res = await call(customer, r);
    expect(res.status).toBe(403);
    expect(res.body.error.code).toBe("FORBIDDEN");
  });

  it.each(routes.filter((r) => r.auth === "public").map((r) => [label(r), r] as const))("%s needs no sign-in", async (_, r) => {
    const res = await call(request(app), r);
    expect([401, 403]).not.toContain(res.status);
  });
});
