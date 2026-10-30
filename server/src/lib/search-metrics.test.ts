import { describe, expect, it } from "vitest";
import { searchMetrics } from "./search-metrics";

describe("searchMetrics", () => {
  it("scores the first expected product's rank in each result list", () => {
    const m = searchMetrics([
      { expected: ["a"], ranked: ["a", "b"] }, // rank 1
      { expected: ["x", "c"], ranked: ["b", "c", "x"] }, // rank 2 (the first expected one found)
      { expected: ["d"], ranked: ["b", "c", "e", "f", "g", "d"] }, // rank 6: outside the top 5
      { expected: ["z"], ranked: [] }, // miss
    ]);
    expect(m).toEqual({ queries: 4, hitAt1: 0.25, hitAt5: 0.5, mrr: (1 + 1 / 2 + 1 / 6 + 0) / 4 });
  });

  it("is all zeros for no queries", () => {
    expect(searchMetrics([])).toEqual({ queries: 0, hitAt1: 0, hitAt5: 0, mrr: 0 });
  });
});
