// Catalog admin: products (variants, images, slugs, SKUs), categories, brands and inventory —
// checked through the public storefront API as well.
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import request from "supertest";
import type {
  AdminBrandDTO,
  AdminCategoryDTO,
  AdminInventoryRowDTO,
  AdminProductDTO,
  AdminProductInput,
  ProductDetailDTO,
  ProductListResponse,
} from "@nestama/shared";
import { createApp } from "../src/app";
import { prisma } from "../src/lib/prisma";
import { revalidateLog } from "../src/lib/revalidate";
import { deleteTestUsers, signInAdmin, type Agent } from "./helpers";

const hasDb = Boolean(process.env.DATABASE_URL);
const TAG = `t${Date.now().toString(36)}`;

describe.skipIf(!hasDb)("catalog admin API", () => {
  const app = createApp();
  let admin: Agent;
  let toys: AdminCategoryDTO;
  let brand: AdminBrandDTO;
  const createdProducts: string[] = [];
  const createdCategories: string[] = [];
  const createdBrands: string[] = [];

  const draft = (overrides: Partial<AdminProductInput> = {}): AdminProductInput => ({
    name: `Squeaky Carrot ${TAG}`,
    description: "A crinkly, squeaky carrot plush that survives enthusiastic chewing.",
    petType: "DOG",
    categoryId: toys.id,
    brandId: brand.id,
    tags: ["plush", "squeaky"],
    variants: [
      { sku: `${TAG}-S`, label: "Small", options: { Size: "Small" }, price: 34900, mrp: 39900, stock: 12, isDefault: true },
      { sku: `${TAG}-L`, label: "Large", options: { Size: "Large" }, price: 49900, stock: 4 },
    ],
    images: [
      { url: "https://images.unsplash.com/photo-1601758228041-f3b2795255f1", alt: "Dog with a carrot toy", width: 1200, height: 1200 },
    ],
    ...overrides,
  });

  beforeAll(async () => {
    admin = (await signInAdmin(app)).agent;
    const categories = (await admin.get("/api/v1/admin/categories").expect(200)).body as AdminCategoryDTO[];
    toys = categories.find((c) => c.slug === "toys")!;
    brand = ((await admin.get("/api/v1/admin/brands").expect(200)).body as AdminBrandDTO[])[0]!;
  });

  afterAll(async () => {
    await prisma.product.deleteMany({ where: { id: { in: createdProducts } } });
    await prisma.category.deleteMany({ where: { id: { in: createdCategories } } });
    await prisma.brand.deleteMany({ where: { id: { in: createdBrands } } });
    await deleteTestUsers();
    await prisma.$disconnect();
  });

  it("creates a product that the storefront shows, with a slug made from its name", async () => {
    revalidateLog.length = 0;
    const res = await admin.post("/api/v1/admin/products").send(draft());
    expect(res.status, JSON.stringify(res.body)).toBe(201);
    const product = res.body as AdminProductDTO;
    createdProducts.push(product.id);
    expect(product.slug).toBe(`squeaky-carrot-${TAG}`);
    expect(product.variants.map((v) => [v.sku, v.isDefault])).toEqual([
      [`${TAG}-S`.toUpperCase(), true],
      [`${TAG}-L`.toUpperCase(), false],
    ]);
    expect(revalidateLog.length).toBeGreaterThan(0);

    const pdp = (await request(app).get(`/api/v1/products/${product.slug}`).expect(200)).body as ProductDetailDTO;
    expect(pdp.variants).toHaveLength(2);
    const listing = (await request(app).get(`/api/v1/products?q=${TAG}`).expect(200)).body as ProductListResponse;
    expect(listing.items.map((p) => p.id)).toContain(product.id);
  });

  it("edits prices, options and images in place", async () => {
    const product = (await admin.get(`/api/v1/admin/products/${createdProducts[0]}`).expect(200)).body as AdminProductDTO;
    const [small] = product.variants;
    const res = await admin.put(`/api/v1/admin/products/${product.id}`).send({
      ...draft(),
      name: product.name,
      variants: [
        {
          id: small!.id,
          sku: small!.sku,
          label: "Small",
          options: { Size: "Small" },
          price: 29900,
          mrp: 39900,
          stock: 20,
          isDefault: true,
        },
        { sku: `${TAG}-XL`, label: "Extra large", options: { Size: "XL" }, price: 59900, stock: 2 },
      ],
      images: [
        { id: product.images[0]!.id, url: product.images[0]!.url, alt: "Updated alt text", width: 1200, height: 1200 },
        { url: "/uploads/2026-10/example.webp", alt: "Second angle", width: 800, height: 800 },
      ],
    });
    expect(res.status, JSON.stringify(res.body)).toBe(200);
    const updated = res.body as AdminProductDTO;
    expect(updated.variants.map((v) => v.label)).toEqual(["Small", "Extra large"]); // Large was removed
    expect(updated.variants[0]!.id).toBe(small!.id);
    expect(updated.images.map((i) => i.alt)).toEqual(["Updated alt text", "Second angle"]);

    const pdp = (await request(app).get(`/api/v1/products/${updated.slug}`).expect(200)).body as ProductDetailDTO;
    expect(pdp.variants.find((v) => v.label === "Small")!.pricing.price).toBe(29900);
  });

  it("refuses duplicate SKUs and taken URLs", async () => {
    const seededSku = (await prisma.productVariant.findFirstOrThrow({ where: { product: { slug: "adventure-no-pull-harness" } } })).sku;
    const dupSku = await admin
      .post("/api/v1/admin/products")
      .send(draft({ name: `Other ${TAG}`, variants: [{ sku: seededSku, label: "One", price: 10000, stock: 1, isDefault: true }] }));
    expect(dupSku.status).toBe(409);
    expect(dupSku.body.error.code).toBe("SKU_TAKEN");

    const takenSlug = draft({
      name: `Other ${TAG}`,
      slug: "adventure-no-pull-harness",
      variants: [{ sku: `${TAG}-Z`, label: "One", price: 10000, stock: 1, isDefault: true }],
    });
    const dupSlug = await admin.post("/api/v1/admin/products").send(takenSlug);
    expect(dupSlug.status).toBe(409);
    expect(dupSlug.body.error.code).toBe("SLUG_TAKEN");

    const invalid = await admin.post("/api/v1/admin/products").send(draft({ variants: [] }));
    expect(invalid.status).toBe(400);
  });

  it("hides a deactivated product from the storefront", async () => {
    const id = createdProducts[0]!;
    const off = (await admin.patch(`/api/v1/admin/products/${id}/active`).send({ isActive: false }).expect(200)).body as AdminProductDTO;
    expect((await request(app).get(`/api/v1/products/${off.slug}`)).status).toBe(404);
    const list = (await admin.get(`/api/v1/admin/products?q=${TAG}&status=inactive`).expect(200)).body;
    expect(list.items.map((p: { id: string }) => p.id)).toContain(id);
    await admin.patch(`/api/v1/admin/products/${id}/active`).send({ isActive: true }).expect(200);
  });

  it("manages categories and blocks deleting one that is in use", async () => {
    const created = await admin.post("/api/v1/admin/categories").send({
      name: `Chew Toys ${TAG}`,
      imageUrl: "https://images.unsplash.com/photo-1",
      parentId: toys.id,
      showOnHome: false,
    });
    expect(created.status).toBe(201);
    const chew = (created.body as AdminCategoryDTO[]).find((c) => c.name === `Chew Toys ${TAG}`)!;
    createdCategories.push(chew.id);
    expect(chew).toMatchObject({ parentId: toys.id, slug: `chew-toys-${TAG}` });

    // Only one level of nesting.
    const tooDeep = await admin
      .post("/api/v1/admin/categories")
      .send({ name: `Deep ${TAG}`, imageUrl: "https://images.unsplash.com/photo-2", parentId: chew.id });
    expect(tooDeep.status).toBe(422);

    // A category with products can't be deleted.
    const product = (
      await admin
        .post("/api/v1/admin/products")
        .send(
          draft({
            name: `Rope ${TAG}`,
            categoryId: chew.id,
            variants: [{ sku: `${TAG}-R`, label: "One", price: 19900, stock: 3, isDefault: true }],
          }),
        )
        .expect(201)
    ).body as AdminProductDTO;
    createdProducts.push(product.id);
    const blocked = await admin.delete(`/api/v1/admin/categories/${chew.id}`);
    expect(blocked.status).toBe(409);
    expect(blocked.body.error.code).toBe("CATEGORY_IN_USE");
    expect(blocked.body.error.message).toBe(`“${chew.name}” still has 1 product. Move them first.`);
    const parent = await admin.delete(`/api/v1/admin/categories/${toys.id}`);
    expect(parent.status).toBe(409);
    expect(parent.body.error.message).toMatch(/still has \d+ products and 1 sub-category\. Move them first\.$/);
  });

  it("manages brands", async () => {
    const list = (
      await admin
        .post("/api/v1/admin/brands")
        .send({ name: `Wagwell ${TAG}`, description: "Test brand" })
        .expect(201)
    ).body as AdminBrandDTO[];
    const wagwell = list.find((b) => b.name === `Wagwell ${TAG}`)!;
    createdBrands.push(wagwell.id);
    const renamed = (
      await admin
        .put(`/api/v1/admin/brands/${wagwell.id}`)
        .send({ name: `Wagwell Co ${TAG}` })
        .expect(200)
    ).body as AdminBrandDTO[];
    expect(renamed.find((b) => b.id === wagwell.id)!.slug).toBe(`wagwell-co-${TAG}`);
    expect((await admin.delete(`/api/v1/admin/brands/${brand.id}`)).status).toBe(409); // in use by seeded products
    await admin.delete(`/api/v1/admin/brands/${wagwell.id}`).expect(200);
    createdBrands.pop();
  });

  it("lists low stock and updates stock in bulk", async () => {
    const product = (await admin.get(`/api/v1/admin/products/${createdProducts[0]}`).expect(200)).body as AdminProductDTO;
    const xl = product.variants.find((v) => v.label === "Extra large")!; // stock 2, threshold 5
    const low = (await admin.get("/api/v1/admin/inventory?low=1").expect(200)).body as AdminInventoryRowDTO[];
    expect(low.map((r) => r.variantId)).toContain(xl.id);

    await admin
      .patch("/api/v1/admin/inventory")
      .send({ items: [{ variantId: xl.id, stock: 40 }] })
      .expect(200);
    const after = (await admin.get(`/api/v1/admin/inventory?q=${xl.sku}`).expect(200)).body as AdminInventoryRowDTO[];
    expect(after[0]).toMatchObject({ variantId: xl.id, stock: 40 });
    expect((await admin.patch("/api/v1/admin/inventory").send({ items: [{ variantId: "nope", stock: 1 }] })).status).toBe(404);
  });
});
