import path from "node:path";

/** Turns text into unit-length vectors. Swappable so tests don't load a model. */
export interface Embedder {
  /** Stored next to each vector, so vectors from different embedders are never compared. */
  readonly id: string;
  readonly dimensions: number;
  embed(texts: string[]): Promise<number[][]>;
}

export const MODEL_ID = "Xenova/all-MiniLM-L6-v2";
export const DIMENSIONS = 384;

/**
 * all-MiniLM-L6-v2 running locally through Transformers.js (ONNX on the CPU). No API key and no
 * per-query cost. The quantised weights (~23 MB) are downloaded from the Hugging Face Hub on
 * first use and cached on disk; the pipeline is loaded once and shared.
 */
export function localMiniLm(cacheDir = path.resolve(process.cwd(), ".cache", "models")): Embedder {
  let extractor: Promise<(texts: string[], options: object) => Promise<{ tolist(): number[][] }>> | null = null;
  const load = async () => {
    const { pipeline, env } = await import("@huggingface/transformers");
    env.cacheDir = cacheDir;
    return (await pipeline("feature-extraction", MODEL_ID, { dtype: "q8" })) as unknown as (
      texts: string[],
      options: object,
    ) => Promise<{ tolist(): number[][] }>;
  };
  return {
    id: `${MODEL_ID}@q8`,
    dimensions: DIMENSIONS,
    async embed(texts) {
      if (texts.length === 0) return [];
      extractor ??= load().catch((err: unknown) => {
        extractor = null; // let a later call retry (e.g. after a network blip during the download)
        throw err;
      });
      // One text per run: the q8 model quantises activations with scales taken from the whole
      // batch, so a batched text's vector depends on its neighbours (cosine ≈ 0.99 to itself
      // alone, enough to reorder close results). Alone, a product embeds like a query does.
      const run = await extractor;
      const vectors: number[][] = [];
      for (const text of texts) vectors.push((await run([text], { pooling: "mean", normalize: true })).tolist()[0]!);
      return vectors;
    },
  };
}

/**
 * A deterministic stand-in for tests: hashed bag-of-words vectors, so texts that share words
 * score as similar. It knows nothing about meaning, which is the point: no download in CI.
 */
export function bagOfWordsEmbedder(dimensions = DIMENSIONS): Embedder {
  const words = (t: string) => t.toLowerCase().match(/[a-z0-9]+/g) ?? [];
  const hash = (w: string) => [...w].reduce((h, c) => (h * 31 + c.charCodeAt(0)) >>> 0, 7) % dimensions;
  return {
    id: "test-bag-of-words",
    dimensions,
    async embed(texts) {
      return texts.map((t) => {
        const v = new Array<number>(dimensions).fill(0);
        for (const w of words(t)) v[hash(w)]! += 1;
        const norm = Math.hypot(...v) || 1;
        return v.map((x) => x / norm);
      });
    },
  };
}

let active: Embedder | null = null;

/** The embedder search and indexing use (the local model unless a test swapped it). */
export function getEmbedder(): Embedder {
  active ??= localMiniLm();
  return active;
}

export function setEmbedder(embedder: Embedder): void {
  active = embedder;
}

/** The text a product is embedded from: name, description, species and category. */
export function productEmbeddingText(p: {
  name: string;
  description: string;
  petType: string;
  category: string;
  parentCategory?: string | null;
}): string {
  const species = p.petType === "DOG" ? "dogs" : p.petType === "CAT" ? "cats" : "dogs and cats";
  const category = p.parentCategory ? `${p.parentCategory} > ${p.category}` : p.category;
  return `${p.name}. For ${species}. Category: ${category}. ${p.description}`;
}

/** pgvector's text form, e.g. '[0.1,0.2,...]', for use with a ::vector cast in raw SQL. */
export function toVectorLiteral(vector: number[]): string {
  if (!vector.every(Number.isFinite)) throw new Error("Embedding contains a non-finite value");
  return `[${vector.join(",")}]`;
}
