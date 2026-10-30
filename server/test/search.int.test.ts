// Semantic search: products found by meaning, the keyword-only switch, re-embedding on admin edits
// and the backfill. A hand-made embedder stands in for the model, so similarities are exact.
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import request from "supertest";
import type { AdminBrandDTO, AdminCategoryDTO, AdminProductDTO, AdminProductInput, SearchResultDTO } from "@nestama/shared";
import { createApp } from "../src/app";
import { DIMENSIONS, setEmbedder, type Embedder } from "../src/lib/embeddings";
import { prisma } from "../src/lib/prisma";
import { rankSearch } from "../src/modules/catalog/catalog.service";
import { backfillEmbeddings } from "../src/modules/catalog/semantic";
import { deleteTestUsers, signInAdmin, type Agent } from "./helpers";

const hasDb = Boolean(process.env.DATABASE_URL);
const TAG = `s${Date.now().toString(36)}`;
const QUERY = "stop my dog tugging on walks";

/** Texts about pulling on walks point one way, everything else another (similarity 1 or 0). */
function topicEmbedder(onEmbed: () => void = () => undefined): Embedder {
  const axis = (i: number) => Array.from({ length: DIMENSIONS }, (_, j) => (j === i ? 1 : 0));
  return {
    id: "test-topic",
    dimensions: DIMENSIONS,
    async embed(texts) {
      onEmbed();
      return texts.map((t) => axis(/no-pull harness|tugging/i.test(t) ? 0 : 1));
    },
  };
}

const failingEmbedder: Embedder = {
  id: "test-failing",
  dimensions: DIMENSIONS,
  embed: () => Promise.reject(new Error("model unavailable")),
};

describe.skipIf(!hasDb)("semantic search", () => {
  const app = createApp();
  let admin: Agent;
  let toys: AdminCategoryDTO;
  let brand: AdminBrandDTO;
  const createdProducts: string[] = [];

  const draft = (overrides: Partial<AdminProductInput> = {}): AdminProductInput => ({
    name: `Rope Tug ${TAG}`,
    description: "A braided cotton rope for tugging games in the yard.",
    petType: "DOG",
    categoryId: toys.id,
    brandId: brand.id,
    tags: ["rope"],
    variants: [{ sku: `${TAG}-R`, label: "One size", options: { Size: "One size" }, price: 29900, stock: 10, isDefault: true }],
    images: [{ url: "https://images.unsplash.com/photo-1601758228041-f3b2795255f1", alt: "A rope toy", width: 1200, height: 1200 }],
    ...overrides,
  });
  const search = async (q: string) =>
    (
      (
        await request(app)
          .get(`/api/v1/search?q=${encodeURIComponent(q)}`)
          .expect(200)
      ).body as SearchResultDTO
    ).products.map((p) => p.slug);
  const modelOf = async (id: string) =>
    (await prisma.product.findUniqueOrThrow({ where: { id }, select: { embeddingModel: true } })).embeddingModel;

  beforeAll(async () => {
    setEmbedder(topicEmbedder());
    await backfillEmbeddings({ all: true });
    admin = (await signInAdmin(app)).agent;
    toys = ((await admin.get("/api/v1/admin/categories").expect(200)).body as AdminCategoryDTO[]).find((c) => c.slug === "toys")!;
    brand = ((await admin.get("/api/v1/admin/brands").expect(200)).body as AdminBrandDTO[])[0]!;
  });

  afterAll(async () => {
    await prisma.product.deleteMany({ where: { id: { in: createdProducts } } });
    await deleteTestUsers();
    await prisma.$disconnect();
  });

  it("finds a product by meaning when no keyword matches", async () => {
    expect(await rankSearch(QUERY, { weight: 0 })).toEqual([]);
    expect(await search(QUERY)).toEqual(["adventure-no-pull-harness"]);
    // Keyword matches still lead.
    expect((await search("harness"))[0]).toBe("adventure-no-pull-harness");
  });

  it("stays keyword-only, without embedding the query, at weight 0", async () => {
    let calls = 0;
    setEmbedder(topicEmbedder(() => calls++));
    try {
      const slugs = (await rankSearch("harness", { weight: 0 })).map((i) => i.card.slug);
      expect(slugs).toContain("adventure-no-pull-harness");
      expect(calls).toBe(0);
    } finally {
      setEmbedder(topicEmbedder());
    }
  });

  it("re-embeds a product when the admin creates or edits it", async () => {
    const created = (await admin.post("/api/v1/admin/products").send(draft()).expect(201)).body as AdminProductDTO;
    createdProducts.push(created.id);
    expect(await modelOf(created.id)).toBe("test-topic");
    expect(await search(QUERY)).toContain(created.slug);

    await admin
      .put(`/api/v1/admin/products/${created.id}`)
      .send(draft({ description: "A braided cotton rope for fetch in the yard." }))
      .expect(200);
    expect(await search(QUERY)).not.toContain(created.slug);
  });

  it("backfills products that have no vector", async () => {
    const harness = await prisma.product.findUniqueOrThrow({ where: { slug: "adventure-no-pull-harness" }, select: { id: true } });
    await prisma.$executeRaw`UPDATE products SET embedding = NULL, "embeddingModel" = NULL WHERE id = ${harness.id}`;
    expect(await search(QUERY)).not.toContain("adventure-no-pull-harness");

    expect(await backfillEmbeddings()).toBe(1);
    expect(await modelOf(harness.id)).toBe("test-topic");
    expect(await search(QUERY)).toContain("adventure-no-pull-harness");
  });

  it("falls back to keywords, and still saves admin edits, when the model fails", async () => {
    setEmbedder(failingEmbedder);
    try {
      expect((await search("harness"))[0]).toBe("adventure-no-pull-harness");
      const saved = (
        await admin
          .post("/api/v1/admin/products")
          .send(
            draft({
              name: `Rope Tug Two ${TAG}`,
              variants: [{ sku: `${TAG}-R2`, label: "One size", options: { Size: "One size" }, price: 29900, stock: 3, isDefault: true }],
            }),
          )
          .expect(201)
      ).body as AdminProductDTO;
      createdProducts.push(saved.id);
      expect(await modelOf(saved.id)).toBeNull();
    } finally {
      setEmbedder(topicEmbedder());
    }
  });
});
