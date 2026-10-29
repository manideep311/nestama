import { afterEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";
import { PROXY_HEADER } from "./lib/proxy-header";
import { proxy } from "./proxy";

const SECRET = "storefront-proxy-secret-for-tests-0123456789";

/** The header names Next.js forwards upstream after a rewrite with overridden request headers. */
const forwarded = (res: Response) => (res.headers.get("x-middleware-override-headers") ?? "").split(",").filter(Boolean);

afterEach(() => vi.unstubAllEnvs());

describe("proxy: API forwarding", () => {
  it("forwards /api and /uploads to the API with the shared secret", () => {
    vi.stubEnv("API_URL", "https://api.example.com");
    vi.stubEnv("PROXY_SECRET", SECRET);
    for (const path of ["/api/v1/cart?x=1", "/uploads/2026-10/paw.png"]) {
      const res = proxy(new NextRequest(`https://store.example.com${path}`, { headers: { cookie: "a=1", host: "store.example.com" } }));
      expect(res.headers.get("x-middleware-rewrite")).toBe(`https://api.example.com${path}`);
      expect(res.headers.get(`x-middleware-request-${PROXY_HEADER}`)).toBe(SECRET);
      expect(res.headers.get("x-middleware-request-cookie")).toBe("a=1");
      // The storefront's Host never reaches the API host, which routes by its own name.
      expect(forwarded(res)).not.toContain("host");
    }
  });

  it("forwards without the secret when none is configured (local development)", () => {
    vi.stubEnv("API_URL", "http://localhost:4000");
    vi.stubEnv("PROXY_SECRET", "");
    const res = proxy(new NextRequest("http://localhost:3000/api/v1/health"));
    expect(res.headers.get("x-middleware-rewrite")).toBe("http://localhost:4000/api/v1/health");
    expect(forwarded(res)).not.toContain(PROXY_HEADER);
  });

  it("never lets a browser supply the secret header itself", () => {
    vi.stubEnv("PROXY_SECRET", "");
    const res = proxy(new NextRequest("http://localhost:3000/api/v1/cart", { headers: { [PROXY_HEADER]: "forged" } }));
    expect(forwarded(res)).not.toContain(PROXY_HEADER);
  });
});

describe("proxy: sign-in gate", () => {
  it("sends signed-out visitors to sign in and back", () => {
    const res = proxy(new NextRequest("http://localhost:3000/checkout"));
    expect(res.headers.get("location")).toBe("http://localhost:3000/login?next=%2Fcheckout");
  });

  it("keeps the guest wishlist open", () => {
    const res = proxy(new NextRequest("http://localhost:3000/account/wishlist"));
    expect(res.headers.get("location")).toBeNull();
  });
});
