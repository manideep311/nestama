// Pet profiles: CRUD with ownership, the five-pet limit, approximate ages, and per-pet picks.
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import request from "supertest";
import { istToday, type PetDTO, type PetRecommendationsDTO, type ProductDetailDTO } from "@nestama/shared";
import { createApp } from "../src/app";
import { prisma } from "../src/lib/prisma";
import { deleteTestUsers, signUp, type Agent } from "./helpers";

const hasDb = Boolean(process.env.DATABASE_URL);

describe.skipIf(!hasDb)("pets API", () => {
  const app = createApp();
  let owner: Agent;
  let stranger: Agent;
  let bruno: PetDTO;

  beforeAll(async () => {
    owner = (await signUp(app, { tag: "pet-owner" })).agent;
    stranger = (await signUp(app, { tag: "pet-stranger" })).agent;
  });

  afterAll(async () => {
    await deleteTestUsers(); // pets go with their owners
    await prisma.$disconnect();
  });

  it("requires sign-in", async () => {
    expect((await request(app).get("/api/v1/account/pets")).status).toBe(401);
    expect((await request(app).post("/api/v1/account/pets").send({ name: "Bo", species: "DOG", approxAgeYears: 2 })).status).toBe(401);
  });

  it("adds a pet with a birthday and derives its age and life stage", async () => {
    const year = Number(istToday().slice(0, 4));
    const res = await owner.post("/api/v1/account/pets").send({ name: " Bruno ", species: "DOG", birthDate: `${year - 3}-01-15` });
    expect(res.status).toBe(201);
    bruno = res.body as PetDTO;
    expect(bruno).toMatchObject({
      name: "Bruno",
      species: "DOG",
      birthDate: `${year - 3}-01-15`,
      birthDateEstimated: false,
      lifeStage: "ADULT",
    });
    expect([2, 3]).toContain(bruno.ageYears);
  });

  it("stores an approximate age as an estimated birthday", async () => {
    const res = await owner.post("/api/v1/account/pets").send({ name: "Misty", species: "CAT", approxAgeYears: 0 });
    expect(res.status).toBe(201);
    expect(res.body).toMatchObject({
      name: "Misty",
      species: "CAT",
      birthDateEstimated: true,
      ageYears: 0,
      lifeStage: "BABY",
      birthdaySoon: false,
    });
  });

  it("validates input", async () => {
    const both = await owner.post("/api/v1/account/pets").send({ name: "Rex", species: "DOG", birthDate: "2020-01-01", approxAgeYears: 5 });
    expect(both.status).toBe(400);
    const future = await owner
      .post("/api/v1/account/pets")
      .send({ name: "Rex", species: "DOG", birthDate: `${Number(istToday().slice(0, 4)) + 1}-01-01` });
    expect(future.status).toBe(400);
  });

  it("lists pets oldest first, edits and removes them", async () => {
    const list = (await owner.get("/api/v1/account/pets").expect(200)).body as PetDTO[];
    expect(list.map((p) => p.name)).toEqual(["Bruno", "Misty"]);

    const edited = await owner.patch(`/api/v1/account/pets/${bruno.id}`).send({ name: "Bruno", species: "DOG", approxAgeYears: 8 });
    expect(edited.status).toBe(200);
    expect(edited.body).toMatchObject({ birthDateEstimated: true, ageYears: 8, lifeStage: "SENIOR" });

    const misty = list[1]!;
    expect((await owner.delete(`/api/v1/account/pets/${misty.id}`)).body).toEqual({ deleted: true });
    expect(((await owner.get("/api/v1/account/pets")).body as PetDTO[]).map((p) => p.name)).toEqual(["Bruno"]);
  });

  it("keeps pets private to their owner", async () => {
    expect((await stranger.get("/api/v1/account/pets").expect(200)).body).toEqual([]);
    expect(
      (await stranger.patch(`/api/v1/account/pets/${bruno.id}`).send({ name: "Mine", species: "DOG", approxAgeYears: 1 })).status,
    ).toBe(404);
    expect((await stranger.delete(`/api/v1/account/pets/${bruno.id}`)).status).toBe(404);
    expect((await stranger.get(`/api/v1/account/pets/${bruno.id}/recommendations`)).status).toBe(404);
  });

  it("allows at most five pets", async () => {
    for (let i = 0; i < 5; i++) {
      expect((await stranger.post("/api/v1/account/pets").send({ name: `Pet ${i}`, species: "CAT", approxAgeYears: 2 })).status).toBe(201);
    }
    const sixth = await stranger.post("/api/v1/account/pets").send({ name: "One too many", species: "CAT", approxAgeYears: 2 });
    expect(sixth.status).toBe(409);
    expect(sixth.body.error.code).toBe("PET_LIMIT");
  });

  it("recommends in-stock products for the pet's species, varied and explained", async () => {
    const res = (await owner.get(`/api/v1/account/pets/${bruno.id}/recommendations`).expect(200)).body as PetRecommendationsDTO;
    expect(res.pet.id).toBe(bruno.id);
    expect(res.items.length).toBeGreaterThan(0);
    expect(res.items.length).toBeLessThanOrEqual(8);
    for (const { product, reason } of res.items) {
      expect(["DOG", "BOTH"]).toContain(product.petType);
      expect(product.stock).not.toBe("OUT_OF_STOCK");
      expect(reason).toMatch(/dogs|puppies|Birthday/);
    }
    // Bruno is now a senior: puppy-tagged products are never his top pick.
    const top = (await request(app).get(`/api/v1/products/${res.items[0]!.product.slug}`)).body as ProductDetailDTO;
    expect(top.tags).not.toContain("puppy");
  });
});
