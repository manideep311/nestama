/**
 * Search evaluation: runs every query in search-questions.json through three searches and scores
 * them.
 *   - keyword only: the store's search with semantic search off (every word must match);
 *   - full-text: PostgreSQL full-text search where any word can match (a baseline, see full-text.ts);
 *   - hybrid: the store's search with semantic search on.
 * Queries with answers get hit@1, hit@5 and MRR over the top 10. Off-catalogue queries (nothing in
 * the store fits) report how often products are shown anyway, among the 6 the typeahead displays.
 *
 *   pnpm --filter server eval:search                               # hybrid at the configured settings
 *   pnpm --filter server eval:search --weights=0.3,0.7             # compare weights
 *   pnpm --filter server eval:search --min-similarity=0.3,0.4,0.5  # compare thresholds
 *   pnpm --filter server eval:search --verbose                     # each query's result
 *
 * It uses the database in DATABASE_URL and embeds any products that are missing a vector first.
 */
import { readFileSync } from "node:fs";
import { env } from "../src/config/env";
import { getEmbedder } from "../src/lib/embeddings";
import { prisma } from "../src/lib/prisma";
import { offCatalogueMetrics, searchMetrics } from "../src/lib/search-metrics";
import { rankSearch } from "../src/modules/catalog/catalog.service";
import { backfillEmbeddings } from "../src/modules/catalog/semantic";
import { fullTextSearch } from "./full-text";

interface Question {
  q: string;
  kind: string;
  expected: string[];
}

const TOP = 10;
const OFF = "off-catalogue";
const { queries } = JSON.parse(readFileSync(new URL("./search-questions.json", import.meta.url), "utf8")) as { queries: Question[] };
const listArg = (name: string, fallback: number) => {
  const arg = process.argv.find((a) => a.startsWith(`--${name}=`));
  return arg
    ? arg
        .slice(name.length + 3)
        .split(",")
        .map(Number)
    : [fallback];
};
const weights = listArg("weights", env.SEARCH_SEMANTIC_WEIGHT || 0.5);
const thresholds = listArg("min-similarity", env.SEARCH_MIN_SIMILARITY);
const verbose = process.argv.includes("--verbose");

const embedded = await backfillEmbeddings();
console.log(`Embedder: ${getEmbedder().id} (embedded ${embedded} product(s) first)`);
console.log(`Queries: ${queries.length} (${countBy(queries.map((q) => q.kind))})\n`);

const modes: { label: string; search: (q: string) => Promise<string[]> }[] = [
  { label: "keyword only", search: async (q) => slugs(await rankSearch(q, { weight: 0, limit: TOP })) },
  { label: "full-text", search: (q) => fullTextSearch(q, TOP) },
  ...weights.flatMap((weight) =>
    thresholds.map((minSimilarity) => ({
      label: `hybrid w=${weight} s=${minSimilarity}`,
      search: async (q: string) => slugs(await rankSearch(q, { weight, minSimilarity, limit: TOP })),
    })),
  ),
];
const runs: { label: string; ranked: string[][]; ms: number }[] = [];
for (const mode of modes) {
  const ranked: string[][] = [];
  const started = performance.now();
  for (const { q } of queries) ranked.push(await mode.search(q));
  runs.push({ label: mode.label, ranked, ms: (performance.now() - started) / queries.length });
}

const answered = queries.filter((q) => q.kind !== OFF);
const kinds = [...new Set(answered.map((q) => q.kind))];
const pct = (x: number) => `${(x * 100).toFixed(1)}%`.padStart(7);
const w = Math.max(...runs.map((r) => r.label.length)) + 2;
console.log(`${"mode".padEnd(w)}${"queries".padEnd(20)}  hit@1   hit@5     MRR   ms/query`);
for (const run of runs) {
  const pick = (kind?: string) =>
    queries.flatMap((q, i) => (q.kind !== OFF && (!kind || q.kind === kind) ? [{ expected: q.expected, ranked: run.ranked[i]! }] : []));
  for (const kind of [undefined, ...kinds]) {
    const m = searchMetrics(pick(kind));
    const label = kind ? `${kind} (${m.queries})` : `with answers (${m.queries})`;
    const ms = kind ? "" : run.ms.toFixed(1).padStart(9);
    console.log(
      `${(kind ? "" : run.label).padEnd(w)}${label.padEnd(20)}${pct(m.hitAt1)} ${pct(m.hitAt5)} ${m.mrr.toFixed(3).padStart(7)}  ${ms}`,
    );
  }
  const off = offCatalogueMetrics(queries.flatMap((q, i) => (q.kind === OFF ? [run.ranked[i]!] : [])));
  if (off.queries) {
    console.log(
      `${"".padEnd(w)}${`${OFF} (${off.queries})`.padEnd(20)}products shown for ${pct(off.withResults).trim()} of queries, ${off.avgShown.toFixed(1)} per query`,
    );
  }
}

if (verbose) {
  console.log(`\nRank of the first correct product (- = not in the top ${TOP}); off-catalogue: products shown (n=…):`);
  const cw = w;
  console.log(`${runs.map((r) => r.label.padStart(cw)).join("")}  query`);
  for (const [i, { q, kind, expected }] of queries.entries()) {
    const cells = runs.map((r) => {
      const ranked = r.ranked[i]!;
      if (kind === OFF) return `n=${Math.min(ranked.length, 6)}`.padStart(cw);
      const rank = ranked.findIndex((slug) => expected.includes(slug)) + 1;
      return (rank ? String(rank) : "-").padStart(cw);
    });
    console.log(`${cells.join("")}  ${q}`);
  }
}

await prisma.$disconnect();

function slugs(items: { card: { slug: string } }[]): string[] {
  return items.map((i) => i.card.slug);
}

function countBy(values: string[]): string {
  const counts = new Map<string, number>();
  for (const v of values) counts.set(v, (counts.get(v) ?? 0) + 1);
  return [...counts].map(([k, n]) => `${n} ${k}`).join(", ");
}
