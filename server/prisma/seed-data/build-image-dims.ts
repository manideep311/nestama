// One-off helper: records real pixel dimensions for every Unsplash image used in the seed.
// Run: pnpm exec tsx prisma/seed-data/build-image-dims.ts
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const here = path.dirname(fileURLToPath(import.meta.url));
const sources = ["products.ts", "catalog-meta.ts", "promotions.ts"]
  .map((f) => path.join(here, f))
  .filter((f) => fs.existsSync(f))
  .map((f) => fs.readFileSync(f, "utf8"))
  .join("\n");

const ids = [...new Set(sources.match(/\d{10,13}-[0-9a-f]{12}/g) ?? [])];
const dims: Record<string, [number, number]> = {};

await Promise.all(
  ids.map(async (id) => {
    const res = await fetch(`https://images.unsplash.com/photo-${id}?fm=json`);
    if (!res.ok) throw new Error(`Image ${id} returned ${res.status}`);
    const meta = (await res.json()) as { PixelWidth: number; PixelHeight: number };
    dims[id] = [meta.PixelWidth, meta.PixelHeight];
  }),
);

const sorted = Object.fromEntries(Object.entries(dims).sort(([a], [b]) => a.localeCompare(b)));
fs.writeFileSync(path.join(here, "image-dims.json"), JSON.stringify(sorted, null, 2) + "\n");
console.log(`Recorded ${ids.length} images`);
