import { Router } from "express";
import { z } from "zod";
import rateLimit from "express-rate-limit";
import { productListQuerySchema, reviewInputSchema, searchQuerySchema, slugParamSchema, type ReviewInput } from "@nestama/shared";
import { AppError } from "../../lib/errors";
import { estimateDelivery } from "../../lib/delivery";
import { searchCatalog } from "./catalog.service";
import { getMyReview, getProductReviews, upsertReview } from "./reviews.service";
import { currentUserId, requireAuth } from "../auth/auth.middleware";
import { validate } from "../../lib/validate";
import * as controller from "./catalog.controller";

export const idsQuerySchema = z.object({
  ids: z
    .string()
    .trim()
    .transform((s) =>
      s
        .split(",")
        .map((id) => id.trim())
        .filter(Boolean),
    )
    .pipe(z.array(z.string().max(40)).max(24)),
});

export const catalogRouter = Router();

catalogRouter.get("/products", validate({ query: productListQuerySchema }), controller.listProducts);
// Registered before /products/:slug so "by-ids" is not read as a slug.
catalogRouter.get("/products/by-ids", validate({ query: idsQuerySchema }), controller.getByIds);
catalogRouter.get("/products/:slug", validate({ params: slugParamSchema }), controller.getProduct);
catalogRouter.get("/products/:slug/related", validate({ params: slugParamSchema }), controller.getRelated);
catalogRouter.get("/categories", controller.listCategories);
catalogRouter.get("/categories/:slug", validate({ params: slugParamSchema }), controller.getCategory);

export const reviewsQuerySchema = z.object({ page: z.coerce.number().int().min(1).max(500).default(1) });
export const pincodeQuerySchema = z.object({
  pincode: z
    .string()
    .trim()
    .regex(/^[1-9][0-9]{5}$/, "Enter a valid 6-digit pincode"),
});
const searchLimiter = rateLimit({ windowMs: 60_000, limit: 60, standardHeaders: "draft-8", legacyHeaders: false });

catalogRouter.get("/products/:slug/reviews", validate({ params: slugParamSchema, query: reviewsQuerySchema }), async (_req, res) => {
  res.json(await getProductReviews(res.locals.params.slug as string, res.locals.query.page as number));
});

const reviewLimiter = rateLimit({
  windowMs: 60_000,
  limit: 10,
  keyGenerator: (_req, res) => `user:${res.locals.user?.id ?? "anonymous"}`,
  standardHeaders: "draft-8",
  legacyHeaders: false,
});

catalogRouter.get("/products/:slug/reviews/mine", requireAuth, validate({ params: slugParamSchema }), async (_req, res) => {
  res.json({ review: await getMyReview(currentUserId(res), res.locals.params.slug as string) });
});

catalogRouter.post(
  "/products/:slug/reviews",
  requireAuth,
  reviewLimiter,
  validate({ params: slugParamSchema, body: reviewInputSchema }),
  async (_req, res) => {
    const { review, created } = await upsertReview(
      currentUserId(res),
      res.locals.params.slug as string,
      res.locals.body as Required<ReviewInput>,
    );
    res.status(created ? 201 : 200).json(review);
  },
);

catalogRouter.get("/search", searchLimiter, validate({ query: searchQuerySchema }), async (_req, res) => {
  res.json(await searchCatalog(res.locals.query.q as string));
});

catalogRouter.get("/delivery-estimate", validate({ query: pincodeQuerySchema }), (_req, res) => {
  const estimate = estimateDelivery(res.locals.query.pincode as string, new Date());
  if (!estimate) throw new AppError("INVALID_PINCODE", 400, "Enter a valid 6-digit pincode");
  res.json(estimate);
});
