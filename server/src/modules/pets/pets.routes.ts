import { Router } from "express";
import { idParamSchema, istToday, petInputSchema, toPetData } from "@nestama/shared";
import type { z } from "zod";
import { validate } from "../../lib/validate";
import { currentUserId, requireAuth } from "../auth/auth.middleware";
import * as pets from "./pets.service";

export const petsRouter = Router();

type PetBody = z.output<typeof petInputSchema>;

petsRouter.get("/account/pets", requireAuth, async (_req, res) => {
  res.json(await pets.listPets(currentUserId(res)));
});

petsRouter.post("/account/pets", requireAuth, validate({ body: petInputSchema }), async (_req, res) => {
  res.status(201).json(await pets.createPet(currentUserId(res), toPetData(res.locals.body as PetBody, istToday())));
});

petsRouter.patch("/account/pets/:id", requireAuth, validate({ params: idParamSchema, body: petInputSchema }), async (_req, res) => {
  res.json(await pets.updatePet(currentUserId(res), res.locals.params.id as string, toPetData(res.locals.body as PetBody, istToday())));
});

petsRouter.delete("/account/pets/:id", requireAuth, validate({ params: idParamSchema }), async (_req, res) => {
  res.json(await pets.deletePet(currentUserId(res), res.locals.params.id as string));
});

petsRouter.get("/account/pets/:id/recommendations", requireAuth, validate({ params: idParamSchema }), async (_req, res) => {
  res.json(await pets.getPetRecommendations(currentUserId(res), res.locals.params.id as string));
});
