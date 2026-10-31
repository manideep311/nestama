export interface RankedQuery {
  /** Every product that would be a correct answer. */
  expected: string[];
  /** What the search returned, best first. */
  ranked: string[];
}

export interface SearchMetrics {
  queries: number;
  /** Share of queries whose top result is correct. */
  hitAt1: number;
  /** Share of queries with a correct result in the top five. */
  hitAt5: number;
  /** Mean reciprocal rank of the first correct result (0 when none is returned). */
  mrr: number;
}

/** Standard retrieval scores for the search evaluation (`pnpm --filter server eval:search`). */
export function searchMetrics(results: RankedQuery[]): SearchMetrics {
  if (results.length === 0) return { queries: 0, hitAt1: 0, hitAt5: 0, mrr: 0 };
  const ranks = results.map((r) => r.ranked.findIndex((slug) => r.expected.includes(slug)) + 1); // 0 = miss
  const share = (ok: (rank: number) => boolean) => ranks.filter(ok).length / ranks.length;
  return {
    queries: results.length,
    hitAt1: share((r) => r === 1),
    hitAt5: share((r) => r >= 1 && r <= 5),
    mrr: ranks.reduce((sum, r) => sum + (r ? 1 / r : 0), 0) / ranks.length,
  };
}

export interface OffCatalogueMetrics {
  queries: number;
  /** Share of queries that showed any product (every one of them is irrelevant). */
  withResults: number;
  /** Products shown per query, counting only what the typeahead displays. */
  avgShown: number;
}

/** For queries the store has no answer to: how often products are shown anyway, and how many. */
export function offCatalogueMetrics(results: string[][], shown = 6): OffCatalogueMetrics {
  if (results.length === 0) return { queries: 0, withResults: 0, avgShown: 0 };
  const counts = results.map((r) => Math.min(r.length, shown));
  return {
    queries: results.length,
    withResults: counts.filter((n) => n > 0).length / counts.length,
    avgShown: counts.reduce((a, b) => a + b, 0) / counts.length,
  };
}
