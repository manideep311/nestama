// Admin foundation: the role gate on every admin route, settings, and image uploads.
import fs from "node:fs/promises";
import path from "node:path";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import request from "supertest";
import { createApp } from "../src/app";
import { prisma } from "../src/lib/prisma";
import { revalidateLog } from "../src/lib/revalidate";
import { UPLOAD_DIR } from "../src/modules/admin/uploads";
import { deleteTestUsers, signInAdmin, signUp, type Agent } from "./helpers";

const hasDb = Boolean(process.env.DATABASE_URL);

// A valid 1×1 PNG.
const PNG_1X1 = Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==", "base64");

// Representative routes from every admin area; the gate sits in front of all of them.
export const ADMIN_GETS = [
  "/api/v1/admin/settings",
  "/api/v1/admin/products",
  "/api/v1/admin/categories",
  "/api/v1/admin/brands",
  "/api/v1/admin/inventory",
  "/api/v1/admin/promotions",
  "/api/v1/admin/coupons",
  "/api/v1/admin/orders",
  "/api/v1/admin/customers",
  "/api/v1/admin/reviews",
  "/api/v1/admin/stats/overview",
  "/api/v1/admin/reports/sales",
  "/api/v1/admin/reports/orders.csv",
];

describe.skipIf(!hasDb)("admin foundation", () => {
  const app = createApp();
  let admin: Agent;
  let customer: Agent;
  let settingsBefore: Awaited<ReturnType<typeof prisma.storeSettings.findUniqueOrThrow>>;
  const uploaded: string[] = [];

  beforeAll(async () => {
    admin = (await signInAdmin(app)).agent;
    customer = (await signUp(app, { tag: "notadmin" })).agent;
    settingsBefore = await prisma.storeSettings.findUniqueOrThrow({ where: { id: 1 } });
  });

  afterAll(async () => {
    const { id: _id, updatedAt: _u, ...restore } = settingsBefore;
    await prisma.storeSettings.update({ where: { id: 1 }, data: restore });
    for (const url of uploaded) await fs.rm(path.join(UPLOAD_DIR, url.replace(/^\/uploads\//, "")), { force: true });
    await deleteTestUsers();
    await prisma.$disconnect();
  });

  it("rejects guests (401) and customers (403) on every admin route", async () => {
    for (const url of ADMIN_GETS) {
      expect((await request(app).get(url)).status, url).toBe(401);
      expect((await customer.get(url)).status, url).toBe(403);
    }
    expect((await customer.put("/api/v1/admin/settings").send({})).status).toBe(403);
    expect((await customer.post("/api/v1/admin/uploads")).status).toBe(403);
  });

  it("drops admin rights the moment the role is removed", async () => {
    const demoted = await signInAdmin(app);
    expect((await demoted.agent.get("/api/v1/admin/settings")).status).toBe(200);
    await prisma.user.update({ where: { id: demoted.userId }, data: { role: "CUSTOMER" } });
    expect((await demoted.agent.get("/api/v1/admin/settings")).status).toBe(403);
  });

  it("updates store settings, refreshes the storefront and validates input", async () => {
    const current = (await admin.get("/api/v1/admin/settings").expect(200)).body;
    revalidateLog.length = 0;
    const next = { ...current, announcementText: "Monsoon sale — up to 30% off", popularSearches: ["Raincoats", "Dog beds"] };
    delete next.updatedAt;
    const saved = (await admin.put("/api/v1/admin/settings").send(next).expect(200)).body;
    expect(saved.announcementText).toBe("Monsoon sale — up to 30% off");
    expect(revalidateLog).toEqual([["catalog"]]);

    const pub = (await request(app).get("/api/v1/settings/public").expect(200)).body;
    expect(pub.announcementText).toBe("Monsoon sale — up to 30% off");
    expect(pub.popularSearches).toEqual(["Raincoats", "Dog beds"]);

    const bad = await admin.put("/api/v1/admin/settings").send({ ...next, gstRatePercent: 50, supportEmail: "x" });
    expect(bad.status).toBe(400);
  });

  it("stores image uploads and rejects anything else", async () => {
    const ok = await admin.post("/api/v1/admin/uploads").attach("file", PNG_1X1, { filename: "paw.png", contentType: "image/png" });
    expect(ok.status).toBe(201);
    expect(ok.body).toMatchObject({ width: 1, height: 1 });
    expect(ok.body.url).toMatch(/^\/uploads\/\d{4}-\d{2}\/[\w-]+\.png$/);
    uploaded.push(ok.body.url);

    const served = await request(app).get(ok.body.url);
    expect(served.status).toBe(200);
    expect(served.headers["content-type"]).toMatch(/image\/png/);

    // A text file dressed up as an image is rejected by its bytes, not its name or MIME type.
    const fake = await admin
      .post("/api/v1/admin/uploads")
      .attach("file", Buffer.from("hello"), { filename: "x.png", contentType: "image/png" });
    expect(fake.status).toBe(400);
    expect(fake.body.error.code).toBe("UNSUPPORTED_FILE");
    expect((await admin.post("/api/v1/admin/uploads")).status).toBe(400);
  });
});
