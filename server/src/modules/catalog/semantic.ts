import { env } from "../../config/env";
import { getEmbedder, productEmbeddingText, toVectorLiteral } from "../../lib/embeddings";
import { prisma } from "../../lib/prisma";

/*
 * Semantic search: each product stores a 384-number embedding of its name, description, species
 * and category (pgvector), and a query is matched by cosine similarity to it. The keyword search
 * still runs; `hybridRank` blends the two.
 */

const BATCH = 16;
/** Products the vector query hands to the blend; the typeahead shows far fewer. */
const CANDIDATES = 24;
/** Shorter queries ("ca", "ha") are still being typed, and their nearest products are noise. */
const MIN_QUERY_LENGTH = 3;

/** Embeds the given products and stores the vectors (with the embedder's id). Returns the count. */
export async function embedProducts(ids: string[]): Promise<number> {
  if (ids.length === 0) return 0;
  const embedder = getEmbedder();
  const rows = await prisma.product.findMany({
    where: { id: { in: ids } },
    select: {
      id: true,
      name: true,
      description: true,
      petType: true,
      category: { select: { name: true, parent: { select: { name: true } } } },
    },
  });
  for (let i = 0; i < rows.length; i += BATCH) {
    const batch = rows.slice(i, i + BATCH);
    const vectors = await embedder.embed(
      batch.map((p) =>
        productEmbeddingText({
          name: p.name,
          description: p.description,
          petType: p.petType,
          category: p.category.name,
          parentCategory: p.category.parent?.name,
        }),
      ),
    );
    for (const [j, p] of batch.entries()) {
      await prisma.$executeRaw`
        UPDATE products SET embedding = ${toVectorLiteral(vectors[j]!)}::vector, "embeddingModel" = ${embedder.id} WHERE id = ${p.id}`;
    }
  }
  return rows.length;
}

/** Embeds products with no vector, or one from a different embedder (`all` re-embeds everything). */
export async function backfillEmbeddings(options: { all?: boolean } = {}): Promise<number> {
  const embedder = getEmbedder();
  const rows = options.all
    ? await prisma.product.findMany({ select: { id: true } })
    : await prisma.$queryRaw<{ id: string }[]>`
        SELECT id FROM products WHERE embedding IS NULL OR "embeddingModel" IS DISTINCT FROM ${embedder.id}`;
  return embedProducts(rows.map((r) => r.id));
}

/**
 * Keeps vectors in step with an admin edit. With semantic search off, the stale vectors are
 * cleared instead, so the boot backfill re-embeds them once search is switched back on; a failed
 * embed clears them too. Never throws: the edit itself has already been saved.
 */
export async function refreshProductEmbeddings(ids: string[], weight = env.SEARCH_SEMANTIC_WEIGHT): Promise<void> {
  if (ids.length === 0) return;
  try {
    if (weight > 0) {
      await embedProducts(ids);
      return;
    }
  } catch (err) {
    console.warn("[search] Couldn't embed the edited product(s):", err instanceof Error ? err.message : err);
  }
  await prisma.product.updateMany({ where: { id: { in: ids } }, data: { embeddingModel: null } }).catch(() => undefined);
}

/** Active products nearest the query by cosine similarity (1 = same direction), best first. */
export async function semanticCandidates(q: string, limit = CANDIDATES): Promise<{ id: string; similarity: number }[]> {
  if (q.trim().length < MIN_QUERY_LENGTH) return [];
  const embedder = getEmbedder();
  const [vector] = await embedder.embed([q]);
  const literal = toVectorLiteral(vector!);
  return prisma.$queryRaw<{ id: string; similarity: number }[]>`
    SELECT id, 1 - (embedding <=> ${literal}::vector) AS similarity
    FROM products
    WHERE "isActive" AND "embeddingModel" = ${embedder.id}
    ORDER BY embedding <=> ${literal}::vector
    LIMIT ${limit}`;
}
