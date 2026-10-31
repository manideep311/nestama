/**
 * Embeds products for semantic search: those with no vector, or one from another model.
 *   pnpm --filter server embed:backfill          # only what's missing (the API also does this at boot)
 *   pnpm --filter server embed:backfill --all    # re-embed every product
 * Uses the database in DATABASE_URL.
 */
import { getEmbedder } from "../src/lib/embeddings";
import { prisma } from "../src/lib/prisma";
import { backfillEmbeddings } from "../src/modules/catalog/semantic";

const started = performance.now();
const embedded = await backfillEmbeddings({ all: process.argv.includes("--all") });
console.log(`Embedded ${embedded} product(s) with ${getEmbedder().id} in ${((performance.now() - started) / 1000).toFixed(1)}s.`);
await prisma.$disconnect();
