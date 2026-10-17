import { describe, it, expect } from "vitest";
import { parseList, toggleId, MAX_WISHLIST } from "./wishlist-store";

describe("parseList", () => {
  it("reads a JSON array of ids", () => {
    expect(parseList('["a","b"]')).toEqual(["a", "b"]);
  });

  it("tolerates missing or corrupt storage", () => {
    expect(parseList(null)).toEqual([]);
    expect(parseList("not json")).toEqual([]);
    expect(parseList('{"a":1}')).toEqual([]);
  });

  it("drops non-strings and duplicates", () => {
    expect(parseList('["a",1,"a",null,"b"]')).toEqual(["a", "b"]);
  });
});

describe("toggleId", () => {
  it("adds a new id to the front and reports it as saved", () => {
    expect(toggleId(["a"], "b")).toEqual({ list: ["b", "a"], saved: true });
  });

  it("removes an existing id", () => {
    expect(toggleId(["a", "b"], "a")).toEqual({ list: ["b"], saved: false });
  });

  it("caps the list length, dropping the oldest", () => {
    const full = Array.from({ length: MAX_WISHLIST }, (_, i) => `id${i}`);
    const { list } = toggleId(full, "new");
    expect(list).toHaveLength(MAX_WISHLIST);
    expect(list[0]).toBe("new");
    expect(list).not.toContain(`id${MAX_WISHLIST - 1}`);
  });
});
