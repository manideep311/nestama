import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    include: ["src/**/*.test.ts", "test/**/*.test.ts"],
    environment: "node",
    // Swaps the local embedding model for a deterministic stand-in, so tests never download it.
    setupFiles: ["test/setup-embedder.ts"],
    testTimeout: 20000,
    hookTimeout: 30000,
    // Integration tests share one database and assert on exact stock counts, so test files run
    // one at a time (tests within a file were already sequential).
    fileParallelism: false,
  },
});
