-- Semantic product search: pgvector, available on Supabase and in the pgvector/pgvector images.
CREATE EXTENSION IF NOT EXISTS vector;

-- AlterTable
ALTER TABLE "products" ADD COLUMN     "embedding" vector(384),
ADD COLUMN     "embeddingModel" TEXT;

-- Cosine-distance index for nearest-neighbour lookups (the search uses the <=> operator).
CREATE INDEX "products_embedding_idx" ON "products" USING hnsw ("embedding" vector_cosine_ops);
