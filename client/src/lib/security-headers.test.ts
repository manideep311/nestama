import { describe, expect, it } from "vitest";
import { securityHeaders } from "./security-headers";

const get = (headers: { key: string; value: string }[], key: string) => headers.find((h) => h.key === key)?.value;

describe("securityHeaders", () => {
  it("sets a CSP that allows only our own scripts and the image CDNs", () => {
    const csp = get(securityHeaders({ dev: false, https: true }), "Content-Security-Policy")!;
    expect(csp).toContain("default-src 'self'");
    expect(csp).toContain("script-src 'self' 'unsafe-inline';");
    expect(csp).not.toContain("unsafe-eval");
    expect(csp).toContain("img-src 'self' data: blob: https://images.unsplash.com https://res.cloudinary.com");
    expect(csp).toContain("frame-ancestors 'none'");
    expect(csp).toContain("object-src 'none'");
    expect(csp).toContain("upgrade-insecure-requests");
  });

  it("relaxes only what development tooling needs", () => {
    const csp = get(securityHeaders({ dev: true, https: false }), "Content-Security-Policy")!;
    expect(csp).toContain("'unsafe-eval'");
    expect(csp).toContain("connect-src 'self' ws: wss:");
    expect(csp).not.toContain("upgrade-insecure-requests");
  });

  it("adds HSTS only when the site is served over https", () => {
    expect(get(securityHeaders({ dev: false, https: true }), "Strict-Transport-Security")).toMatch(/max-age=\d+/);
    expect(get(securityHeaders({ dev: false, https: false }), "Strict-Transport-Security")).toBeUndefined();
  });

  it("always sets the basic hardening headers", () => {
    const h = securityHeaders({ dev: false, https: true });
    expect(get(h, "X-Content-Type-Options")).toBe("nosniff");
    expect(get(h, "X-Frame-Options")).toBe("DENY");
    expect(get(h, "Referrer-Policy")).toBe("strict-origin-when-cross-origin");
    expect(get(h, "Permissions-Policy")).toContain("camera=()");
  });
});
