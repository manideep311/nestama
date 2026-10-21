import { describe, expect, it } from "vitest";
import { afterSignIn, safeNext } from "./safe-next";

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

describe("afterSignIn", () => {
  it("sends admins to the dashboard unless a page was asked for", () => {
    expect(afterSignIn(null, "ADMIN")).toBe("/admin");
    expect(afterSignIn("/admin/orders", "ADMIN")).toBe("/admin/orders");
    expect(afterSignIn("/checkout", "ADMIN")).toBe("/checkout");
  });

  it("sends customers to their account or the page they came from", () => {
    expect(afterSignIn(null, "CUSTOMER")).toBe("/account");
    expect(afterSignIn(null, undefined)).toBe("/account");
    expect(afterSignIn("/checkout", "CUSTOMER")).toBe("/checkout");
  });

  it("falls back to the role's home for unsafe targets", () => {
    expect(afterSignIn("https://evil.example", "ADMIN")).toBe("/admin");
    expect(afterSignIn("//evil.example", "CUSTOMER")).toBe("/account");
  });
});
