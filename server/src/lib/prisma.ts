import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../generated/prisma/client";
import { env } from "../config/env";
import { AppError } from "./errors";

function createClient(): PrismaClient {
  if (!env.DATABASE_URL) {
    throw new AppError("DB_NOT_CONFIGURED", 503, "The database is not configured yet. Add DATABASE_URL to server/.env.");
  }
  const adapter = new PrismaPg({ connectionString: env.DATABASE_URL });
  return new PrismaClient({ adapter, log: env.NODE_ENV === "development" ? ["warn", "error"] : ["error"] });
}

// Reuse one client across tsx watch reloads in development.
const globalForPrisma = globalThis as unknown as { __nestamaPrisma?: PrismaClient };

export const prisma: PrismaClient = new Proxy({} as PrismaClient, {
  get(_target, prop, receiver) {
    globalForPrisma.__nestamaPrisma ??= createClient();
    return Reflect.get(globalForPrisma.__nestamaPrisma, prop, receiver);
  },
});
