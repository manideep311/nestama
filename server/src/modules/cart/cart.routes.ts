import { Router } from "express";
import {
  addCartItemSchema,
  applyCouponSchema,
  idParamSchema,
  updateCartItemSchema,
  type AddCartItemInput,
  type ApplyCouponInput,
  type UpdateCartItemInput,
} from "@nestama/shared";
import { validate } from "../../lib/validate";
import * as cart from "./cart.service";

export const cartRouter = Router();

cartRouter.get("/cart", async (req, res) => {
  res.json(await cart.getCart(req, res));
});

cartRouter.post("/cart/items", validate({ body: addCartItemSchema }), async (req, res) => {
  const { variantId, quantity } = res.locals.body as AddCartItemInput;
  res.status(201).json(await cart.addItem(req, res, variantId, quantity));
});

cartRouter.patch("/cart/items/:id", validate({ params: idParamSchema, body: updateCartItemSchema }), async (req, res) => {
  const { quantity } = res.locals.body as UpdateCartItemInput;
  res.json(await cart.updateItem(req, res, res.locals.params.id as string, quantity));
});

cartRouter.delete("/cart/items/:id", validate({ params: idParamSchema }), async (req, res) => {
  res.json(await cart.removeItem(req, res, res.locals.params.id as string));
});

cartRouter.post("/cart/coupon", validate({ body: applyCouponSchema }), async (req, res) => {
  res.json(await cart.applyCoupon(req, res, (res.locals.body as ApplyCouponInput).code));
});

cartRouter.delete("/cart/coupon", async (req, res) => {
  res.json(await cart.removeCoupon(req, res));
});
