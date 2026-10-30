// The search evaluation's full-text baseline: PostgreSQL full-text search where any word can match.
import { afterAll, describe, expect, it } from "vitest";
import { fullTextSearch } from "../eval/full-text";
import { prisma } from "../src/lib/prisma";

const hasDb = Boolean(process.env.DATABASE_URL);

describe.skipIf(!hasDb)("full-text search baseline", () => {
  afterAll(async () => {
    await prisma.$disconnect();
  });

  it("matches any word of the query, stemmed, with name matches ranked first", async () => {
    // "pulling" stems to "pull": only the harness has it in its name (others in their description).
    const slugs = await fullTextSearch("stop my dog pulling on walks");
    expect(slugs[0]).toBe("adventure-no-pull-harness");
    expect(slugs.length).toBeGreaterThan(1);
  });

  it("returns nothing for stop words, punctuation or unknown words", async () => {
    expect(await fullTextSearch("the and of")).toEqual([]);
    expect(await fullTextSearch("!!! ???")).toEqual([]);
    expect(await fullTextSearch("xylophone")).toEqual([]);
  });

  it("respects the limit and only returns active products", async () => {
    expect(await fullTextSearch("dog", 3)).toHaveLength(3);
    const inactive = await prisma.product.findMany({ where: { isActive: false }, select: { slug: true } });
    const all = await fullTextSearch("dog cat", 100);
    expect(all.filter((s) => inactive.some((p) => p.slug === s))).toEqual([]);
  });
});
