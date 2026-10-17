import { Router } from "express";
import { getHome, getPublicSettings } from "./home.service";
import { loadLivePromotions, toPromotionDTO } from "../catalog/catalog.service";

export const homeRouter = Router();

homeRouter.get("/home", async (_req, res) => {
  res.json(await getHome());
});

homeRouter.get("/settings/public", async (_req, res) => {
  res.json(await getPublicSettings());
});

homeRouter.get("/promotions/active", async (_req, res) => {
  res.json((await loadLivePromotions(new Date())).map(toPromotionDTO));
});
