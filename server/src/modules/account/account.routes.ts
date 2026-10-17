import { Router } from "express";
import { z } from "zod";
import { addressInputSchema, idParamSchema, type AddressData } from "@nestama/shared";
import { validate } from "../../lib/validate";
import { currentUserId, requireAuth } from "../auth/auth.middleware";
import * as account from "./account.service";

export const accountRouter = Router();

export const pageQuerySchema = z.object({ page: z.coerce.number().int().min(1).max(500).default(1) });

accountRouter.get("/account/addresses", requireAuth, async (_req, res) => {
  res.json(await account.listAddresses(currentUserId(res)));
});

accountRouter.post("/account/addresses", requireAuth, validate({ body: addressInputSchema }), async (_req, res) => {
  res.status(201).json(await account.createAddress(currentUserId(res), res.locals.body as AddressData));
});

accountRouter.patch(
  "/account/addresses/:id",
  requireAuth,
  validate({ params: idParamSchema, body: addressInputSchema }),
  async (_req, res) => {
    res.json(await account.updateAddress(currentUserId(res), res.locals.params.id as string, res.locals.body as AddressData));
  },
);

accountRouter.delete("/account/addresses/:id", requireAuth, validate({ params: idParamSchema }), async (_req, res) => {
  res.json(await account.deleteAddress(currentUserId(res), res.locals.params.id as string));
});

accountRouter.get("/account/orders", requireAuth, validate({ query: pageQuerySchema }), async (_req, res) => {
  res.json(await account.listOrders(currentUserId(res), (res.locals.query as { page: number }).page));
});

accountRouter.get("/orders/:id", requireAuth, validate({ params: idParamSchema }), async (_req, res) => {
  res.json(await account.getOrder(currentUserId(res), res.locals.params.id as string));
});
