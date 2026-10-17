import { Router } from "express";
import rateLimit from "express-rate-limit";
import {
  authorizePaymentSchema,
  checkoutSchema,
  verifyPaymentSchema,
  type AuthorizePaymentInput,
  type VerifyPaymentInput,
} from "@nestama/shared";
import { env } from "../../config/env";
import { validate } from "../../lib/validate";
import { currentUserId, requireAuth } from "../auth/auth.middleware";
import { authorizeDemoPayment, verifyPayment } from "../payments/payments.service";
import { createCheckoutOrder } from "./checkout.service";

export const checkoutRouter = Router();

/** Checkout and payment calls: 20 a minute per signed-in user (requireAuth runs first). */
const checkoutLimiter = rateLimit({
  windowMs: 60_000,
  limit: env.NODE_ENV === "test" ? 1_000 : 20,
  keyGenerator: (_req, res) => `user:${res.locals.user?.id ?? "anonymous"}`,
  standardHeaders: "draft-8",
  legacyHeaders: false,
  message: { error: { code: "RATE_LIMITED", message: "Too many attempts. Please wait a minute and try again." } },
});

checkoutRouter.post("/checkout/orders", requireAuth, checkoutLimiter, validate({ body: checkoutSchema }), async (_req, res) => {
  const { addressId } = res.locals.body as { addressId: string };
  res.status(201).json(await createCheckoutOrder(currentUserId(res), addressId));
});

checkoutRouter.post(
  "/payments/demo/authorize",
  requireAuth,
  checkoutLimiter,
  validate({ body: authorizePaymentSchema }),
  async (_req, res) => {
    res.json(await authorizeDemoPayment(currentUserId(res), res.locals.body as Required<AuthorizePaymentInput>));
  },
);

checkoutRouter.post("/payments/verify", requireAuth, checkoutLimiter, validate({ body: verifyPaymentSchema }), async (_req, res) => {
  res.json(await verifyPayment(currentUserId(res), res.locals.body as VerifyPaymentInput));
});
