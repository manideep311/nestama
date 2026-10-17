// Account API: addresses (default rules, ownership, validation) and the orders list/detail guards.
import { afterAll, describe, expect, it } from "vitest";
import request from "supertest";
import type { AddressDTO, Paginated, OrderSummaryDTO } from "@nestama/shared";
import { createApp } from "../src/app";
import { prisma } from "../src/lib/prisma";
import { deleteTestUsers, signUp } from "./helpers";

const hasDb = Boolean(process.env.DATABASE_URL);

const home = {
  fullName: "Asha Rao",
  phone: "9876543210",
  line1: "12 Lake View Road",
  city: "Hyderabad",
  state: "Telangana",
  pincode: "500081",
};

describe.skipIf(!hasDb)("account API", () => {
  const app = createApp();

  afterAll(async () => {
    await deleteTestUsers();
    await prisma.$disconnect();
  });

  it("requires sign-in", async () => {
    expect((await request(app).get("/api/v1/account/addresses")).status).toBe(401);
    expect((await request(app).get("/api/v1/account/orders")).status).toBe(401);
    expect((await request(app).get("/api/v1/orders/anything")).status).toBe(401);
  });

  it("keeps exactly one default address through create, update and delete", async () => {
    const { agent } = await signUp(app, { tag: "addr" });
    const defaults = async () =>
      ((await agent.get("/api/v1/account/addresses")).body as AddressDTO[]).filter((a) => a.isDefault).map((a) => a.line1);

    const first = (await agent.post("/api/v1/account/addresses").send(home).expect(201)).body as AddressDTO;
    expect(first.isDefault).toBe(true); // the first address is always the default

    const office = (
      await agent
        .post("/api/v1/account/addresses")
        .send({ ...home, line1: "Office Tower 4", line2: "  " })
        .expect(201)
    ).body as AddressDTO;
    expect(office.isDefault).toBe(false);
    expect(office.line2).toBeNull();
    expect(await defaults()).toEqual(["12 Lake View Road"]);

    await agent
      .patch(`/api/v1/account/addresses/${office.id}`)
      .send({ ...home, line1: "Office Tower 4", isDefault: true })
      .expect(200);
    expect(await defaults()).toEqual(["Office Tower 4"]);

    // Un-ticking the current default does not leave the account without one.
    await agent
      .patch(`/api/v1/account/addresses/${office.id}`)
      .send({ ...home, line1: "Office Tower 4", isDefault: false })
      .expect(200);
    expect(await defaults()).toEqual(["Office Tower 4"]);

    const remaining = (await agent.delete(`/api/v1/account/addresses/${office.id}`).expect(200)).body as AddressDTO[];
    expect(remaining.map((a) => [a.line1, a.isDefault])).toEqual([["12 Lake View Road", true]]);
  });

  it("validates addresses and normalises phone numbers", async () => {
    const { agent } = await signUp(app, { tag: "addrval" });
    const bad = await agent.post("/api/v1/account/addresses").send({ ...home, pincode: "012345" });
    expect(bad.status).toBe(400);
    expect(bad.body.error.code).toBe("VALIDATION_ERROR");
    const ok = (
      await agent
        .post("/api/v1/account/addresses")
        .send({ ...home, phone: "+91 98765-43210" })
        .expect(201)
    ).body as AddressDTO;
    expect(ok.phone).toBe("9876543210");
  });

  it("hides other customers' addresses and orders", async () => {
    const { agent: alice } = await signUp(app, { tag: "alice" });
    const { agent: bob } = await signUp(app, { tag: "bob" });
    const address = (await alice.post("/api/v1/account/addresses").send(home).expect(201)).body as AddressDTO;

    expect((await bob.patch(`/api/v1/account/addresses/${address.id}`).send(home)).status).toBe(404);
    expect((await bob.delete(`/api/v1/account/addresses/${address.id}`)).status).toBe(404);
    expect((await bob.get("/api/v1/account/addresses")).body).toEqual([]);
    expect((await bob.get("/api/v1/orders/not-an-order")).status).toBe(404);
  });

  it("lists no orders for a new customer", async () => {
    const { agent } = await signUp(app, { tag: "orders" });
    const page = (await agent.get("/api/v1/account/orders").expect(200)).body as Paginated<OrderSummaryDTO>;
    expect(page).toMatchObject({ items: [], page: 1, total: 0, totalPages: 1 });
  });
});
