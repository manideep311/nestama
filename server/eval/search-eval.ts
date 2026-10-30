/**
 * Search evaluation: runs every query in search-questions.json through the header search, keyword
 * only and hybrid, and prints hit@1, hit@5 and MRR (over the top 10).
 *
 *   pnpm --filter server eval:search                    # hybrid at SEARCH_SEMANTIC_WEIGHT
 *   pnpm --filter server eval:search --weights=0.3,0.7  # compare weights
 *   pnpm --filter server eval:search --verbose          # the rank of each query's first hit
 *
 * It uses the database in DATABASE_URL and embeds any products that are missing a vector first.
 */
import { readFileSync } from "node:fs";
import { env } from "../src/config/env";
import { getEmbedder } from "../src/lib/embeddings";
import { prisma } from "../src/lib/prisma";
import { searchMetrics, type SearchMetrics } from "../src/lib/search-metrics";
import { rankSearch } from "../src/modules/catalog/catalog.service";
import { backfillEmbeddings } from "../src/modules/catalog/semantic";

interface Question {
  q: string;
  kind: string;
  expected: string[];
}

const TOP = 10;
const { queries } = JSON.parse(readFileSync(new URL("./search-questions.json", import.meta.url), "utf8")) as { queries: Question[] };
const weightsArg = process.argv.find((a) => a.startsWith("--weights="));
const weights = weightsArg ? weightsArg.slice("--weights=".length).split(",").map(Number) : [env.SEARCH_SEMANTIC_WEIGHT || 0.5];
const verbose = process.argv.includes("--verbose");

const embedded = await backfillEmbeddings();
console.log(`Embedder: ${getEmbedder().id} (embedded ${embedded} product(s) first)`);
console.log(`Queries: ${queries.length} (${countBy(queries.map((q) => q.kind))}); min similarity ${env.SEARCH_MIN_SIMILARITY}\n`);

const modes = [{ label: "keyword only", weight: 0 }, ...weights.map((w) => ({ label: `hybrid w=${w}`, weight: w }))];
const runs: { label: string; ranked: string[][]; ms: number }[] = [];
for (const mode of modes) {
  const ranked: string[][] = [];
  const started = performance.now();
  for (const { q } of queries) ranked.push((await rankSearch(q, { weight: mode.weight, limit: TOP })).map((i) => i.card.slug));
  runs.push({ label: mode.label, ranked, ms: (performance.now() - started) / queries.length });
}

const kinds = ["all", ...new Set(queries.map((q) => q.kind))];
const pct = (x: number) => `${(x * 100).toFixed(1)}%`.padStart(7);
console.log(`${"mode".padEnd(16)}${"queries".padEnd(16)}  hit@1   hit@5     MRR   ms/query`);
for (const run of runs) {
  for (const kind of kinds) {
    const picked = queries.flatMap((q, i) => (kind === "all" || q.kind === kind ? [{ expected: q.expected, ranked: run.ranked[i]! }] : []));
    const m: SearchMetrics = searchMetrics(picked);
    const ms = kind === "all" ? run.ms.toFixed(1).padStart(9) : "";
    console.log(
      `${(kind === "all" ? run.label : "").padEnd(16)}${`${kind} (${m.queries})`.padEnd(16)}${pct(m.hitAt1)} ${pct(m.hitAt5)} ${m.mrr.toFixed(3).padStart(7)}  ${ms}`,
    );
  }
}

if (verbose) {
  console.log(`\nRank of the first correct product (- = not in the top ${TOP}):`);
  console.log(`${runs.map((r) => r.label.padStart(14)).join("")}  query`);
  for (const [i, { q, expected }] of queries.entries()) {
    const cells = runs.map((r) => {
      const rank = r.ranked[i]!.findIndex((slug) => expected.includes(slug)) + 1;
      return (rank ? String(rank) : "-").padStart(14);
    });
    console.log(`${cells.join("")}  ${q}`);
  }
}

await prisma.$disconnect();

function countBy(values: string[]): string {
  const counts = new Map<string, number>();
  for (const v of values) counts.set(v, (counts.get(v) ?? 0) + 1);
  return [...counts].map(([k, n]) => `${n} ${k}`).join(", ");
}
