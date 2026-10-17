import { describe, expect, it } from "vitest";
import { mergeCartLines } from "./cart-merge";

describe("mergeCartLines", () => {
  const stock = new Map([
    ["v1", 10],
    ["v2", 3],
    ["v3", 0],
    ["v4", 100],
  ]);

  it("sums quantities for the same variant", () => {
    expect(mergeCartLines([{ variantId: "v1", quantity: 2 }], [{ variantId: "v1", quantity: 3 }], stock)).toEqual([
      { variantId: "v1", quantity: 5 },
    ]);
  });

  it("keeps lines from both carts, user lines first", () => {
    const merged = mergeCartLines([{ variantId: "v2", quantity: 1 }], [{ variantId: "v1", quantity: 1 }], stock);
    expect(merged.map((l) => l.variantId)).toEqual(["v1", "v2"]);
  });

  it("caps at available stock and at the per-line maximum", () => {
    expect(mergeCartLines([{ variantId: "v2", quantity: 2 }], [{ variantId: "v2", quantity: 2 }], stock)).toEqual([
      { variantId: "v2", quantity: 3 },
    ]);
    expect(mergeCartLines([{ variantId: "v4", quantity: 15 }], [{ variantId: "v4", quantity: 15 }], stock)).toEqual([
      { variantId: "v4", quantity: 20 },
    ]);
  });

  it("drops sold-out and unknown variants", () => {
    expect(
      mergeCartLines(
        [
          { variantId: "v3", quantity: 1 },
          { variantId: "nope", quantity: 1 },
        ],
        [],
        stock,
      ),
    ).toEqual([]);
  });
});
