import { z } from "zod";

/** Blank values in .env (e.g. `RESEND_API_KEY=""`) count as unset. */
const optional = z
  .string()
  .optional()
  .transform((v) => (v && v.trim() ? v.trim() : undefined));

const LOCAL_HOSTS = new Set(["localhost", "127.0.0.1", "[::1]"]);
/** https, or plain http on this machine (a local smoke test of the production build). */
const isSecureOrLocal = (url: string) => {
  const u = new URL(url);
  return u.protocol === "https:" || LOCAL_HOSTS.has(u.hostname);
};

const envSchema = z
  .object({
    NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
    PORT: z.coerce.number().int().positive().default(4000),
    CLIENT_ORIGIN: z.url().default("http://localhost:3000"),
    // Optional outside production so the API skeleton boots before the database is configured.
    DATABASE_URL: optional,
    DIRECT_URL: optional,
    BETTER_AUTH_SECRET: z.string().min(32, "BETTER_AUTH_SECRET must be at least 32 characters"),
    /** The public client origin: browser traffic reaches /api/auth through the Next.js proxy. */
    BETTER_AUTH_URL: z.url().default("http://localhost:3000"),
    DEMO_GATEWAY_SECRET: z.string().min(32, "DEMO_GATEWAY_SECRET must be at least 32 characters"),
    /**
     * Proxy hops in front of Express, for client IPs in rate limits. 1 = one load balancer (Render,
     * Railway); 2 = Vercel's rewrite in front of that.
     */
    TRUST_PROXY: z.coerce.number().int().min(0, "TRUST_PROXY must be 0 or more").max(10).default(1),
    ADMIN_EMAIL: optional,
    ADMIN_PASSWORD: optional,
    RESEND_API_KEY: optional,
    CLOUDINARY_URL: optional,
    /** Shared with the Next.js app; lets admin changes refresh cached storefront pages. */
    REVALIDATE_SECRET: optional,
    /** Where the API reaches the Next.js app server-to-server (defaults to CLIENT_ORIGIN). */
    CLIENT_INTERNAL_URL: optional,
    EMAIL_FROM: z.string().default("NESTAMA <hello@nestama.test>"),
  })
  .superRefine((e, ctx) => {
    if (e.NODE_ENV !== "production") return;
    const require = (key: "DATABASE_URL" | "REVALIDATE_SECRET", why: string) => {
      if (!e[key]) ctx.addIssue({ code: "custom", path: [key], message: `${key} is required in production (${why})` });
    };
    require("DATABASE_URL", "the store has no data without it");
    require("REVALIDATE_SECRET", "admin changes couldn't refresh the storefront");
    if (e.REVALIDATE_SECRET && e.REVALIDATE_SECRET.length < 32) {
      ctx.addIssue({ code: "custom", path: ["REVALIDATE_SECRET"], message: "REVALIDATE_SECRET must be at least 32 characters" });
    }
    for (const key of ["CLIENT_ORIGIN", "BETTER_AUTH_URL"] as const) {
      if (!isSecureOrLocal(e[key])) {
        ctx.addIssue({ code: "custom", path: [key], message: `${key} must use https in production (session cookies are Secure)` });
      }
    }
  });

export type Env = z.output<typeof envSchema>;

export class EnvError extends Error {
  constructor(readonly issues: string[]) {
    super(`Invalid server environment:\n  - ${issues.join("\n  - ")}`);
    this.name = "EnvError";
  }
}

/** Validates the server environment; throws an `EnvError` naming every problem (never the values). */
export function parseEnv(input: Record<string, string | undefined>): Env {
  const parsed = envSchema.safeParse(input);
  if (!parsed.success) {
    throw new EnvError(parsed.error.issues.map((i) => (i.path.length ? `${i.path.join(".")}: ${i.message}` : i.message)));
  }
  return parsed.data;
}
