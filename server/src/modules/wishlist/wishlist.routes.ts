import { Router } from "express";
import { z } from "zod";
import { wishlistItemSchema, wishlistSyncSchema } from "@nestama/shared";
import { validate } from "../../lib/validate";
import { currentUserId, requireAuth } from "../auth/auth.middleware";
import * as wishlist from "./wishlist.service";

export const wishlistRouter = Router();

export const productParamSchema = z.object({ productId: z.string().trim().min(1).max(40) });

wishlistRouter.get("/wishlist", requireAuth, async (_req, res) => {
  res.json(await wishlist.getWishlist(currentUserId(res)));
});

wishlistRouter.post("/wishlist", requireAuth, validate({ body: wishlistItemSchema }), async (_req, res) => {
  res.status(201).json(await wishlist.addToWishlist(currentUserId(res), (res.locals.body as { productId: string }).productId));
});

wishlistRouter.delete("/wishlist/:productId", requireAuth, validate({ params: productParamSchema }), async (_req, res) => {
  res.json(await wishlist.removeFromWishlist(currentUserId(res), res.locals.params.productId as string));
});

wishlistRouter.post("/wishlist/sync", requireAuth, validate({ body: wishlistSyncSchema }), async (_req, res) => {
  res.json(await wishlist.syncWishlist(currentUserId(res), (res.locals.body as { productIds: string[] }).productIds));
});
