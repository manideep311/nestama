import { describe, expect, it } from "vitest";
import { recommendForPet, type Candidate } from "./recommend";

const c = (id: string, over: Partial<Candidate> = {}): Candidate => ({
  id,
  petType: "DOG",
  tags: [],
  categoryKey: `cat-${id}`,
  ratingAvg: 4.5,
  ratingCount: 50,
  soldCount: 100,
  inStock: true,
  ...over,
});

const adultDog = { species: "DOG" as const, lifeStage: "ADULT" as const, birthdaySoon: false };
const ids = (r: { id: string }[]) => r.map((x) => x.id);

describe("recommendForPet", () => {
  it("only picks in-stock products for the pet's species or both", () => {
    const picks = recommendForPet(
      [c("dog"), c("both", { petType: "BOTH" }), c("cat", { petType: "CAT" }), c("gone", { inStock: false })],
      adultDog,
    );
    expect(ids(picks).sort()).toEqual(["both", "dog"]);
  });

  it("favours products tagged for the pet's life stage and buries the opposite stage", () => {
    const candidates = [
      c("popular", { ratingAvg: 4.9, ratingCount: 500, soldCount: 5000 }),
      c("puppy-food", { tags: ["puppy", "dry food"] }),
      c("senior-food", { tags: ["senior"] }),
    ];
    const puppy = recommendForPet(candidates, { ...adultDog, lifeStage: "BABY" });
    expect(ids(puppy)[0]).toBe("puppy-food");
    expect(ids(puppy).at(-1)).toBe("senior-food");
    expect(puppy[0]!.reason).toBe("Great for puppies");

    const senior = recommendForPet(candidates, { ...adultDog, lifeStage: "SENIOR" });
    expect(ids(senior)[0]).toBe("senior-food");
    expect(ids(senior).at(-1)).toBe("puppy-food");
    expect(senior[0]!.reason).toBe("Made for senior dogs");
  });

  it("matches kittens and senior cats too", () => {
    const cat = { species: "CAT" as const, lifeStage: "BABY" as const, birthdaySoon: false };
    const picks = recommendForPet([c("k", { petType: "CAT", tags: ["kitten"] }), c("x", { petType: "CAT" })], cat);
    expect(picks[0]).toEqual({ id: "k", reason: "Great for kittens" });
    expect(recommendForPet([c("s", { petType: "CAT", tags: ["senior"] })], { ...cat, lifeStage: "SENIOR" })[0]!.reason).toBe(
      "Made for senior cats",
    );
  });

  it("suggests treats and toys when a birthday is coming, but not everyday food", () => {
    const candidates = [
      c("bed", { ratingAvg: 4.9, ratingCount: 400, categoryKey: "beds-furniture" }),
      c("biscuits", { categoryKey: "food-treats", tags: ["treats"] }),
      c("ball", { categoryKey: "toys" }),
      c("kibble", { categoryKey: "food-treats", tags: ["dry food"] }),
    ];
    const picks = recommendForPet(candidates, { ...adultDog, birthdaySoon: true });
    expect(ids(picks).slice(0, 2).sort()).toEqual(["ball", "biscuits"]);
    expect(picks.find((p) => p.id === "biscuits")!.reason).toBe("Birthday treat idea");
    expect(picks.find((p) => p.id === "ball")!.reason).toBe("Birthday gift idea");
    expect(picks.find((p) => p.id === "kibble")!.reason).toBe("Top rated for dogs");
    expect(recommendForPet(candidates, adultDog)[0]!.id).toBe("bed");
  });

  it("keeps at most two picks per category and respects the limit", () => {
    const candidates = Array.from({ length: 12 }, (_, i) =>
      c(`t${i}`, { categoryKey: i < 6 ? "toys" : `other-${i}`, soldCount: 1000 - i }),
    );
    const picks = recommendForPet(candidates, adultDog, 5);
    expect(picks).toHaveLength(5);
    expect(picks.filter((p) => Number(p.id.slice(1)) < 6)).toHaveLength(2);
  });

  it("gives a general reason otherwise and a stable order on ties", () => {
    const picks = recommendForPet([c("b"), c("a")], adultDog);
    expect(ids(picks)).toEqual(["a", "b"]);
    expect(picks[0]!.reason).toBe("Top rated for dogs");
  });

  it("damps ratings with few reviews", () => {
    const picks = recommendForPet(
      [c("one-review", { ratingAvg: 5, ratingCount: 1, soldCount: 0 }), c("proven", { ratingAvg: 4.6, ratingCount: 300, soldCount: 0 })],
      adultDog,
    );
    expect(ids(picks)[0]).toBe("proven");
  });
});
