import type { RequestHandler } from "express";
import type { ZodType } from "zod";

interface Schemas {
  body?: ZodType;
  query?: ZodType;
  params?: ZodType;
}

/**
 * Parses request parts with Zod. Parsed (coerced, defaulted) values are placed on
 * res.locals.body / res.locals.query / res.locals.params; failures go to errorHandler.
 */
export function validate(schemas: Schemas): RequestHandler {
  return (req, res, next) => {
    try {
      if (schemas.params) res.locals.params = schemas.params.parse(req.params);
      if (schemas.query) res.locals.query = schemas.query.parse(req.query);
      if (schemas.body) res.locals.body = schemas.body.parse(req.body);
      next();
    } catch (err) {
      next(err);
    }
  };
}
