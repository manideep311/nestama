import { describe, expect, it } from "vitest";
import { hybridRank } from "./hybrid-rank";

const sem = (...pairs: [string, number][]) => pairs.map(([id, similarity]) => ({ id, similarity }));

describe("hybridRank", () => {
  it("is exactly the keyword order at weight 0", () => {
    expect(hybridRank(["a", "b"], sem(["c", 0.9], ["b", 0.8]), { weight: 0, minSimilarity: 0.3, limit: 10 })).toEqual(["a", "b"]);
  });

  it("adds semantic-only matches above the threshold after keyword matches", () => {
    const ranked = hybridRank(["a", "b"], sem(["c", 0.6], ["a", 0.2], ["d", 0.1]), { weight: 0.5, minSimilarity: 0.3, limit: 10 });
    expect(ranked).toEqual(["a", "b", "c"]);
  });

  it("lets similarity reorder keyword matches, more readily as the weight grows", () => {
    expect(hybridRank(["a", "b"], sem(["b", 0.8], ["a", 0.1]), { weight: 0.9, minSimilarity: 0.3, limit: 10 })).toEqual(["b", "a"]);
    // A small similarity edge doesn't beat keyword order at a low weight, but does at a high one.
    expect(hybridRank(["a", "b"], sem(["b", 0.55], ["a", 0.5]), { weight: 0.1, minSimilarity: 0.3, limit: 10 })).toEqual(["a", "b"]);
    expect(hybridRank(["a", "b"], sem(["b", 0.55], ["a", 0.5]), { weight: 0.9, minSimilarity: 0.3, limit: 10 })).toEqual(["b", "a"]);
  });

  it("keeps keyword matches ahead of semantic-only ones at the default weight", () => {
    expect(hybridRank(["a"], sem(["z", 0.7], ["a", 0.05]), { weight: 0.5, minSimilarity: 0.3, limit: 10 })).toEqual(["a", "z"]);
  });

  it("finds products when the keywords match nothing", () => {
    expect(hybridRank([], sem(["x", 0.55], ["y", 0.41], ["z", 0.2]), { weight: 0.5, minSimilarity: 0.3, limit: 10 })).toEqual(["x", "y"]);
  });

  it("respects the limit and breaks ties by keyword order, then similarity order", () => {
    expect(hybridRank(["a", "b", "c"], [], { weight: 0.5, minSimilarity: 0.3, limit: 2 })).toEqual(["a", "b"]);
    expect(hybridRank([], sem(["p", 0.5], ["q", 0.5]), { weight: 1, minSimilarity: 0, limit: 10 })).toEqual(["p", "q"]);
  });
});
