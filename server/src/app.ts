import express, { type Express } from "express";
import helmet from "helmet";
import cors from "cors";
import cookieParser from "cookie-parser";
import rateLimit from "express-rate-limit";
import { toNodeHandler } from "better-auth/node";
import { env } from "./config/env";
import { auth } from "./lib/auth";
import { errorHandler, notFoundHandler } from "./lib/errors";
import { originGuard } from "./lib/origin-guard";
import { prisma } from "./lib/prisma";
import { loadSession } from "./modules/auth/auth.middleware";
import { catalogRouter } from "./modules/catalog/catalog.routes";
import { homeRouter } from "./modules/home/home.routes";
import { newsletterRouter } from "./modules/newsletter/newsletter.routes";
import { cartRouter } from "./modules/cart/cart.routes";
import { accountRouter } from "./modules/account/account.routes";
import { checkoutRouter } from "./modules/checkout/checkout.routes";
import { wishlistRouter } from "./modules/wishlist/wishlist.routes";
import { petsRouter } from "./modules/pets/pets.routes";
import { adminRouter } from "./modules/admin/admin.routes";
import { UPLOAD_DIR } from "./modules/admin/uploads";
import { docsRouter } from "./docs/docs.routes";

/** Sign-in, sign-up and reset attempts: 10 a minute per IP (session reads are not limited). */
const authLimiter = rateLimit({
  windowMs: 60_000,
  limit: env.NODE_ENV === "test" ? 1_000 : 10,
  skip: (req) => req.method === "GET",
  standardHeaders: "draft-8",
  legacyHeaders: false,
  message: { error: { code: "RATE_LIMITED", message: "Too many attempts. Please wait a minute and try again." } },
});

export function createApp(): Express {
  const app = express();

  app.disable("x-powered-by");
  // Hops of proxies in front of us (see TRUST_PROXY), so rate limits key on the shopper's IP.
  app.set("trust proxy", env.TRUST_PROXY);
  app.use(helmet());
  app.use(cors({ origin: env.CLIENT_ORIGIN, credentials: true }));

  // Better Auth reads the raw body itself, so it is mounted before express.json().
  app.all("/api/auth/*splat", authLimiter, toNodeHandler(auth));

  app.use(express.json({ limit: "1mb" }));
  app.use(cookieParser());

  const v1 = express.Router();
  v1.use(originGuard(env.CLIENT_ORIGIN));
  // Platform health checks: 503 when the database is unreachable, so a bad deploy is caught.
  v1.get("/health", async (_req, res) => {
    if (!env.DATABASE_URL) return void res.json({ ok: true, db: "not-configured" });
    try {
      await prisma.$queryRaw`SELECT 1`;
      res.json({ ok: true, db: "up" });
    } catch {
      res.status(503).json({ ok: false, db: "down" });
    }
  });

  v1.use(loadSession);
  v1.use(homeRouter);
  v1.use(catalogRouter);
  v1.use(newsletterRouter);
  v1.use(cartRouter);
  v1.use(accountRouter);
  v1.use(checkoutRouter);
  v1.use(wishlistRouter);
  v1.use(petsRouter);
  v1.use("/admin", adminRouter);

  app.use("/api/v1", v1);
  // OpenAPI 3.1 JSON and a browsable reference (spec §2).
  app.use("/api/docs", docsRouter);
  // Admin uploads when Cloudinary isn't configured (the browser reaches these through the Next.js rewrite).
  app.use("/uploads", express.static(UPLOAD_DIR, { maxAge: "30d", immutable: true, index: false }));

  app.use(notFoundHandler);
  app.use(errorHandler);
  return app;
}
