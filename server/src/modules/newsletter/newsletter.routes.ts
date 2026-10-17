import { Router } from "express";
import rateLimit from "express-rate-limit";
import { newsletterSchema, type NewsletterInput } from "@nestama/shared";
import { validate } from "../../lib/validate";
import { prisma } from "../../lib/prisma";

export const newsletterRouter = Router();

const limiter = rateLimit({ windowMs: 60_000, limit: 10, standardHeaders: "draft-8", legacyHeaders: false });

newsletterRouter.post("/newsletter", limiter, validate({ body: newsletterSchema }), async (_req, res) => {
  const { email } = res.locals.body as NewsletterInput;
  const existing = await prisma.newsletterSubscriber.findUnique({ where: { email } });
  if (existing) {
    res.status(200).json({ subscribed: true, alreadySubscribed: true });
    return;
  }
  await prisma.newsletterSubscriber.create({ data: { email } });
  res.status(201).json({ subscribed: true, alreadySubscribed: false });
});
