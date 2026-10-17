import { describe, it, expect } from "vitest";
import { pushRecent, MAX_RECENT } from "./recently-viewed";

describe("pushRecent", () => {
  it("puts the latest product first without duplicates", () => {
    expect(pushRecent(["a", "b", "c"], "b")).toEqual(["b", "a", "c"]);
    expect(pushRecent([], "x")).toEqual(["x"]);
  });

  it("keeps at most MAX_RECENT ids", () => {
    const many = Array.from({ length: MAX_RECENT }, (_, i) => `p${i}`);
    const next = pushRecent(many, "new");
    expect(next).toHaveLength(MAX_RECENT);
    expect(next[0]).toBe("new");
    expect(next).not.toContain(`p${MAX_RECENT - 1}`);
  });
});
