import { describe, expect, it } from "vitest";
import { parseEnv } from "./env-schema";

const SECRET = "x".repeat(32);
const base = { BETTER_AUTH_SECRET: SECRET, DEMO_GATEWAY_SECRET: SECRET };
const production = {
  ...base,
  NODE_ENV: "production",
  DATABASE_URL: "postgresql://u:p@db.example.com:5432/postgres",
  REVALIDATE_SECRET: SECRET,
  PROXY_SECRET: SECRET,
  CLIENT_ORIGIN: "https://nestama.example",
  BETTER_AUTH_URL: "https://nestama.example",
};

describe("parseEnv", () => {
  it("fills development defaults", () => {
    const env = parseEnv(base);
    expect(env).toMatchObject({ NODE_ENV: "development", PORT: 4000, CLIENT_ORIGIN: "http://localhost:3000", TRUST_PROXY: 1 });
    expect(env.DATABASE_URL).toBeUndefined();
  });

  it("treats blank optional values as unset", () => {
    expect(parseEnv({ ...base, CLOUDINARY_URL: "  " }).CLOUDINARY_URL).toBeUndefined();
  });

  it("parses the proxy depth", () => {
    expect(parseEnv({ ...base, TRUST_PROXY: "2" }).TRUST_PROXY).toBe(2);
    expect(() => parseEnv({ ...base, TRUST_PROXY: "-1" })).toThrow(/TRUST_PROXY/);
  });

  it("protects the live demo by default, and 0 turns each protection off", () => {
    expect(parseEnv(base)).toMatchObject({ DEMO_DAILY_ORDER_LIMIT: 3, DEMO_RESET_HOURS: 24 });
    expect(parseEnv({ ...base, DEMO_DAILY_ORDER_LIMIT: "0", DEMO_RESET_HOURS: "0" })).toMatchObject({
      DEMO_DAILY_ORDER_LIMIT: 0,
      DEMO_RESET_HOURS: 0,
    });
    expect(() => parseEnv({ ...base, DEMO_DAILY_ORDER_LIMIT: "-1" })).toThrow(/DEMO_DAILY_ORDER_LIMIT/);
  });

  it("blends semantic search in by default, and 0 keeps search keyword-only", () => {
    expect(parseEnv(base)).toMatchObject({ SEARCH_SEMANTIC_WEIGHT: 0.5, SEARCH_MIN_SIMILARITY: 0.3 });
    expect(parseEnv({ ...base, SEARCH_SEMANTIC_WEIGHT: "0" }).SEARCH_SEMANTIC_WEIGHT).toBe(0);
    expect(() => parseEnv({ ...base, SEARCH_SEMANTIC_WEIGHT: "1.5" })).toThrow(/SEARCH_SEMANTIC_WEIGHT/);
  });

  it("accepts a complete production environment", () => {
    expect(parseEnv(production).NODE_ENV).toBe("production");
  });

  it("requires a database and the revalidation secret in production", () => {
    expect(() => parseEnv({ ...production, DATABASE_URL: "" })).toThrow(/DATABASE_URL/);
    expect(() => parseEnv({ ...production, REVALIDATE_SECRET: undefined })).toThrow(/REVALIDATE_SECRET/);
  });

  it("requires the storefront proxy secret in production, at least 32 characters", () => {
    expect(() => parseEnv({ ...production, PROXY_SECRET: undefined })).toThrow(/PROXY_SECRET/);
    expect(() => parseEnv({ ...production, PROXY_SECRET: "short" })).toThrow(/PROXY_SECRET must be at least 32/);
    expect(parseEnv(base).PROXY_SECRET).toBeUndefined();
  });

  it("requires https origins in production, except on localhost", () => {
    expect(() => parseEnv({ ...production, CLIENT_ORIGIN: "http://nestama.example" })).toThrow(/CLIENT_ORIGIN/);
    expect(() => parseEnv({ ...production, BETTER_AUTH_URL: "http://nestama.example" })).toThrow(/BETTER_AUTH_URL/);
    // A local smoke test of the production build still works.
    expect(
      parseEnv({ ...production, CLIENT_ORIGIN: "http://localhost:3100", BETTER_AUTH_URL: "http://localhost:3100" }).CLIENT_ORIGIN,
    ).toBe("http://localhost:3100");
  });

  it("rejects short secrets", () => {
    expect(() => parseEnv({ ...base, BETTER_AUTH_SECRET: "short" })).toThrow(/BETTER_AUTH_SECRET/);
  });
});
