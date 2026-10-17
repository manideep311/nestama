import type { RequestHandler } from "express";
import type { ProductListQuery } from "@nestama/shared";
import * as catalog from "./catalog.service";

export const listProducts: RequestHandler = async (_req, res) => {
  res.json(await catalog.listProducts(res.locals.query as ProductListQuery));
};

export const getProduct: RequestHandler = async (_req, res) => {
  res.json(await catalog.getProductBySlug(res.locals.params.slug as string));
};

export const getRelated: RequestHandler = async (_req, res) => {
  res.json(await catalog.getRelatedProducts(res.locals.params.slug as string));
};

export const getByIds: RequestHandler = async (_req, res) => {
  res.json(await catalog.getProductCardsByIds(res.locals.query.ids as string[]));
};

export const listCategories: RequestHandler = async (_req, res) => {
  res.json(await catalog.listCategories());
};

export const getCategory: RequestHandler = async (_req, res) => {
  res.json(await catalog.getCategoryBySlug(res.locals.params.slug as string));
};
