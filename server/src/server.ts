import { createApp } from "./app";
import { env } from "./config/env";
import { prisma } from "./lib/prisma";
import { expireStaleOrders } from "./modules/orders/order-expiry";
import { maybeResetDemoStore } from "./modules/demo/demo.service";

const app = createApp();

const server = app.listen(env.PORT, () => {
  console.log(`🐾 NESTAMA API listening on http://localhost:${env.PORT}`);
});

if (env.NODE_ENV === "production" && !env.CLOUDINARY_URL) {
  console.warn("[uploads] CLOUDINARY_URL is not set: admin uploads go to local disk, which most hosts wipe on every deploy.");
}

// Unpaid orders hold stock for 30 minutes; sweep expired ones every 5 minutes (reads also check lazily).
async function sweepExpiredOrders() {
  if (!env.DATABASE_URL) return;
  try {
    const closed = await expireStaleOrders();
    if (closed > 0) console.info(`[orders] Released stock from ${closed} expired unpaid order(s).`);
  } catch (err) {
    console.error("[orders] Expiry sweep failed:", err instanceof Error ? err.message : err);
  }
}
void sweepExpiredOrders();
const sweep = setInterval(sweepExpiredOrders, 5 * 60_000);
sweep.unref();

// Live demo: restore stock and renew seeded deals once DEMO_RESET_HOURS have passed. Checked at
// boot and hourly, so a host that sleeps when idle still resets on its next wake-up.
async function resetDemoIfDue() {
  if (!env.DATABASE_URL) return;
  try {
    const reset = await maybeResetDemoStore();
    if (reset) console.info(`[demo] Reset: ${reset.restockedVariants} option(s) restocked, ${reset.renewedDeals} deal(s) renewed.`);
  } catch (err) {
    console.error("[demo] Reset failed:", err instanceof Error ? err.message : err);
  }
}
void resetDemoIfDue();
const demoReset = setInterval(resetDemoIfDue, 60 * 60_000);
demoReset.unref();

// Hosts send SIGTERM before replacing an instance: finish in-flight requests, then close the pool.
function shutdown(signal: NodeJS.Signals) {
  console.info(`[server] ${signal} received, shutting down…`);
  clearInterval(sweep);
  clearInterval(demoReset);
  setTimeout(() => process.exit(1), 10_000).unref();
  server.close(() => {
    const disconnect = env.DATABASE_URL ? prisma.$disconnect() : Promise.resolve();
    void disconnect.finally(() => process.exit(0));
  });
}
process.once("SIGTERM", shutdown);
process.once("SIGINT", shutdown);
