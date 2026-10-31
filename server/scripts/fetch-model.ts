/**
 * Downloads the semantic search model into server/.cache/models ahead of time (Render's build runs
 * it). A failed download only warns: the API then fetches the model when it starts.
 */
import { getEmbedder } from "../src/lib/embeddings";

try {
  const started = performance.now();
  await getEmbedder().embed(["warm-up"]);
  console.log(`Search model ready: ${getEmbedder().id} (${((performance.now() - started) / 1000).toFixed(1)}s).`);
} catch (err) {
  console.warn("Couldn't download the search model now; the API will fetch it at start:", err instanceof Error ? err.message : err);
}
