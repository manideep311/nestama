export interface HybridOptions {
  /** 0 = keyword order only, 1 = similarity only (keyword matches are still kept). */
  weight: number;
  /** Products found only by meaning need at least this cosine similarity. */
  minSimilarity: number;
  limit: number;
}

/**
 * Blends the keyword search's results with cosine similarity to the query:
 * `score = (1 - weight) * keyword + weight * similarity`.
 *
 * `keyword` is 1 for the top keyword match and steps down 0.01 per place (0 for a non-match),
 * so keyword matches stay ahead while similarity reorders them and adds products the words
 * missed. Pure, so it's unit tested; the search feeds it ids in their existing order.
 */
export function hybridRank(keywordIds: string[], semantic: { id: string; similarity: number }[], o: HybridOptions): string[] {
  if (o.weight <= 0) return keywordIds.slice(0, o.limit);

  const similarity = new Map(semantic.map((s) => [s.id, s.similarity]));
  const keywordScore = new Map(keywordIds.map((id, i) => [id, Math.max(0, 1 - i * 0.01)]));
  const order = new Map<string, number>();
  for (const id of [...keywordIds, ...semantic.map((s) => s.id)]) if (!order.has(id)) order.set(id, order.size);

  const candidates = [...order.keys()].filter((id) => keywordScore.has(id) || (similarity.get(id) ?? 0) >= o.minSimilarity);
  const score = (id: string) => (1 - o.weight) * (keywordScore.get(id) ?? 0) + o.weight * (similarity.get(id) ?? 0);

  return candidates.sort((a, b) => score(b) - score(a) || order.get(a)! - order.get(b)!).slice(0, o.limit);
}
