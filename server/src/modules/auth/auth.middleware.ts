import type { NextFunction, Request, Response } from "express";
import { fromNodeHeaders } from "better-auth/node";
import { auth } from "../../lib/auth";
import { AppError } from "../../lib/errors";
import { prisma } from "../../lib/prisma";
import { CART_COOKIE, mergeGuestCartIntoUser } from "../cart/cart.service";

export interface SessionUser {
  id: string;
  email: string;
  name: string;
  role: "CUSTOMER" | "ADMIN";
}

/**
 * Attaches the signed-in user (if any) to `res.locals.user`. The first request after signing in
 * also folds the guest cart (cookie) into the account's cart.
 */
export async function loadSession(req: Request, res: Response, next: NextFunction) {
  try {
    const session = await auth.api.getSession({ headers: fromNodeHeaders(req.headers) });
    if (session) {
      const { id, email, name } = session.user;
      res.locals.user = { id, email, name, role: session.user.role === "ADMIN" ? "ADMIN" : "CUSTOMER" };
      if (req.cookies?.[CART_COOKIE]) await mergeGuestCartIntoUser(req, res, id);
    }
    next();
  } catch (err) {
    next(err);
  }
}

export function requireAuth(_req: Request, res: Response, next: NextFunction) {
  if (!res.locals.user) return next(new AppError("UNAUTHENTICATED", 401, "Please sign in to continue."));
  next();
}

/**
 * Role gate. The role is re-read from the database rather than trusted from the session cookie
 * cache, so removing someone's admin role takes effect on their very next request.
 */
export function requireRole(role: SessionUser["role"]) {
  return async (_req: Request, res: Response, next: NextFunction) => {
    try {
      if (!res.locals.user) return next(new AppError("UNAUTHENTICATED", 401, "Please sign in to continue."));
      const current = await prisma.user.findUnique({ where: { id: res.locals.user.id }, select: { role: true } });
      if (current?.role !== role) return next(new AppError("FORBIDDEN", 403, "You don't have access to this."));
      res.locals.user.role = current.role;
      next();
    } catch (err) {
      next(err);
    }
  };
}

/** The signed-in user's id; only call after `requireAuth`. */
export function currentUserId(res: Response): string {
  const id = res.locals.user?.id;
  if (!id) throw new AppError("UNAUTHENTICATED", 401, "Please sign in to continue.");
  return id;
}
