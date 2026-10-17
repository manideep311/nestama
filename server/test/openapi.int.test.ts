import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import request from "supertest";
import { createApp } from "../src/app";
import { buildOpenApi, ROUTES } from "../src/docs/openapi";

/** Routers mounted under a prefix inside /api/v1 (everything else is mounted at the root). */
const MOUNTS: Record<string, string> = { adminRouter: "/admin" };

function declaredRoutes(): string[] {
  const dir = join(__dirname, "../src/modules");
  const files = readdirSync(dir, { recursive: true, encoding: "utf8" }).filter((f) => f.endsWith(".routes.ts"));
  const found: string[] = [];
  for (const file of files) {
    const source = readFileSync(join(dir, file), "utf8");
    for (const m of source.matchAll(/(\w+Router)\.(get|post|put|patch|delete)\(\s*"([^"]+)"/g)) {
      found.push(`${m[2]!.toUpperCase()} /api/v1${MOUNTS[m[1]!] ?? ""}${m[3]}`);
    }
  }
  // A few routes live directly on the v1 router in app.ts.
  for (const m of readFileSync(join(__dirname, "../src/app.ts"), "utf8").matchAll(/\bv1\.(get|post|put|patch|delete)\(\s*"([^"]+)"/g)) {
    found.push(`${m[1]!.toUpperCase()} /api/v1${m[2]}`);
  }
  return found.sort();
}

const documented = () =>
  ROUTES.filter((r) => !r.path.startsWith("/api/auth"))
    .map((r) => `${r.method.toUpperCase()} ${r.path}`)
    .sort();

describe("OpenAPI document", () => {
  it("documents exactly the routes the API declares", () => {
    expect(documented()).toEqual(declaredRoutes());
  });

  it("builds a valid-looking 3.1 document with request schemas from Zod", () => {
    const doc = buildOpenApi() as {
      openapi: string;
      paths: Record<
        string,
        Record<
          string,
          {
            requestBody?: { content: Record<string, { schema: { properties?: object } }> };
            parameters?: { name: string; in: string }[];
            security?: unknown[];
          }
        >
      >;
    };
    expect(doc.openapi).toBe("3.1.0");
    const addItem = doc.paths["/api/v1/cart/items"]!.post!;
    expect(addItem.requestBody!.content["application/json"]!.schema.properties).toHaveProperty("variantId");
    const product = doc.paths["/api/v1/products/{slug}"]!.get!;
    expect(product.parameters).toContainEqual(expect.objectContaining({ name: "slug", in: "path" }));
    const list = doc.paths["/api/v1/products"]!.get!;
    expect(list.parameters!.map((p) => p.name)).toEqual(expect.arrayContaining(["category", "sort", "page"]));
    expect(doc.paths["/api/v1/admin/orders/{id}/status"]!.patch!.security).toEqual([{ session: [] }]);
  });

  it("serves the JSON and a docs page with its own content policy", async () => {
    const app = createApp();
    const json = await request(app).get("/api/docs/openapi.json").expect(200);
    expect(json.body.info.title).toBe("NESTAMA API");
    const page = await request(app).get("/api/docs").expect(200);
    expect(page.headers["content-type"]).toMatch(/text\/html/);
    expect(page.text).toContain('integrity="sha384-');
    expect(page.headers["content-security-policy"]).toContain("https://cdn.jsdelivr.net");
  });
});
