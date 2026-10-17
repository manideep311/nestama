import { describe, expect, it } from "vitest";
import { safeNext } from "./safe-next";

describe("safeNext", () => {
  it("keeps same-site paths with their query and hash", () => {
    expect(safeNext("/checkout")).toBe("/checkout");
    expect(safeNext("/products/harness?x=1#reviews")).toBe("/products/harness?x=1#reviews");
  });

  it.each(["https://evil.example", "//evil.example", "/\\evil.example", "javascript:alert(1)", "", null, undefined])(
    "rejects %s",
    (next) => {
      expect(safeNext(next)).toBe("/account");
    },
  );

  it("never loops back to the auth pages", () => {
    expect(safeNext("/login?next=/x")).toBe("/account");
    expect(safeNext("/register", "/")).toBe("/");
  });

  it("rejects control characters", () => {
    expect(safeNext("/acc\nount")).toBe("/account");
  });
});
