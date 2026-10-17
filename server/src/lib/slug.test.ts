import { describe, expect, it } from "vitest";
import { slugify } from "./slug";

describe("slugify", () => {
  it("makes readable URL slugs", () => {
    expect(slugify("Adventure No-Pull Harness")).toBe("adventure-no-pull-harness");
    expect(slugify("  Cats & Kittens!!  ")).toBe("cats-and-kittens");
    expect(slugify("Crème Brûlée Treats")).toBe("creme-brulee-treats");
    expect(slugify("---")).toBe("");
  });

  it("caps the length without a trailing dash", () => {
    const s = slugify("a ".repeat(100));
    expect(s.length).toBeLessThanOrEqual(80);
    expect(s.endsWith("-")).toBe(false);
  });
});
