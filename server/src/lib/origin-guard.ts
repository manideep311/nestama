import type { RequestHandler } from "express";
import { AppError } from "./errors";

const SAFE_METHODS = new Set(["GET", "HEAD", "OPTIONS"]);

/**
 * Defence in depth against cross-site writes: browsers attach `Origin` to every non-GET fetch and
 * form post, so a write that names another site (or an opaque `null` origin) is refused. Callers
 * without the header (server-to-server, curl, tests) pass; cookies are also `sameSite=lax`.
 */
export function originGuard(allowed: string): RequestHandler {
  const allowedOrigin = new URL(allowed).origin;
  return (req, _res, next) => {
    if (SAFE_METHODS.has(req.method)) return next();
    const origin = req.get("origin");
    if (origin === undefined || origin === allowedOrigin) return next();
    next(new AppError("FORBIDDEN_ORIGIN", 403, "Requests from other sites aren't allowed."));
  };
}
