import { timingSafeEqual } from "node:crypto";
import type { RequestHandler } from "express";
import { AppError } from "./errors";

/** Header the storefront's proxy adds to every request it forwards. */
export const PROXY_HEADER = "x-nestama-proxy";

/** Paths the hosting platform calls directly (its load-balancer health check). */
const OPEN_PATHS = new Set(["/api/v1/health"]);

/**
 * Only the storefront may call the API. Its proxy sends a shared secret with each request, and
 * calls that skip it (straight to the API host) are refused. That keeps `trust proxy` honest:
 * the rate limits key on the X-Forwarded-For value Vercel set, never on one a client forged.
 * Without a secret (local development, tests) the gate is open.
 */
export function proxyGate(secret: string | undefined): RequestHandler {
  if (!secret) return (_req, _res, next) => next();
  const expected = Buffer.from(secret);
  return (req, _res, next) => {
    if (OPEN_PATHS.has(req.path)) return next();
    const sent = Buffer.from(req.get(PROXY_HEADER) ?? "");
    if (sent.length === expected.length && timingSafeEqual(sent, expected)) return next();
    next(new AppError("DIRECT_ACCESS", 403, "Please use the NESTAMA storefront."));
  };
}
