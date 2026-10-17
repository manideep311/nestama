import type { ErrorRequestHandler, RequestHandler } from "express";
import { ZodError, z } from "zod";

/** A deliberate, client-safe error. Anything else becomes a generic 500. */
export class AppError extends Error {
  constructor(
    public readonly code: string,
    public readonly status: number,
    message: string,
    public readonly details?: unknown,
  ) {
    super(message);
    this.name = "AppError";
  }
}

export const notFound = (what = "Resource") => new AppError("NOT_FOUND", 404, `${what} not found`);

export const notFoundHandler: RequestHandler = (_req, _res, next) => {
  next(new AppError("NOT_FOUND", 404, "Route not found"));
};

export const errorHandler: ErrorRequestHandler = (err, _req, res, _next) => {
  if (err instanceof ZodError) {
    res.status(400).json({
      error: { code: "VALIDATION_ERROR", message: "Some fields are invalid", details: z.flattenError(err) },
    });
    return;
  }
  if (err instanceof AppError) {
    res.status(err.status).json({
      error: { code: err.code, message: err.message, ...(err.details !== undefined && { details: err.details }) },
    });
    return;
  }
  // express.json() parse failures
  if (err && typeof err === "object" && "type" in err && err.type === "entity.parse.failed") {
    res.status(400).json({ error: { code: "BAD_JSON", message: "Request body is not valid JSON" } });
    return;
  }
  // Unique-constraint races the services' own checks couldn't catch (e.g. two admins, same SKU).
  if (err && typeof err === "object" && "code" in err && err.code === "P2002") {
    res.status(409).json({ error: { code: "CONFLICT", message: "Something with those details already exists." } });
    return;
  }
  if (isDatabaseUnavailable(err)) {
    console.error("[db] unavailable:", (err as Error).message.split("\n").at(-1));
    res
      .status(503)
      .json({ error: { code: "DB_UNAVAILABLE", message: "We can't reach our database right now. Please try again shortly." } });
    return;
  }
  console.error(err);
  res.status(500).json({ error: { code: "INTERNAL", message: "Something went wrong on our side" } });
};

/** Connection-level database failures (server down, network, pool exhausted) — not query bugs. */
function isDatabaseUnavailable(err: unknown): boolean {
  if (!err || typeof err !== "object") return false;
  const code = "code" in err ? String((err as { code: unknown }).code) : "";
  const name = "name" in err ? String((err as { name: unknown }).name) : "";
  return (
    name === "PrismaClientInitializationError" ||
    ["ECONNREFUSED", "ECONNRESET", "ETIMEDOUT", "ENOTFOUND", "P1001", "P1002", "P1017", "P2024"].includes(code)
  );
}
