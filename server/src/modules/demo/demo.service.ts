import { istToday, PAID_STATUSES, type DemoResetResultDTO } from "@nestama/shared";
import type { OrderStatus } from "../../generated/prisma/client";
import { env } from "../../config/env";
import { AppError } from "../../lib/errors";
import { prisma } from "../../lib/prisma";
import { revalidateStorefront } from "../../lib/revalidate";
import { coupons, promotions } from "../../../prisma/seed-data/promotions";

/*
 * The live demo lets anyone check out, and every paid order lowers stock for good. Two guards keep
 * it usable: a daily cap on paid orders per account, and a reset that restores stock and renews
 * the seeded deals (on a schedule, and from the admin's Inventory page).
 */

const PAID = PAID_STATUSES as OrderStatus[];

/** Refuses a new checkout once an account has paid for `limit` orders today (Indian time). */
export async function assertDailyOrderLimit(userId: string, now = new Date(), limit = env.DEMO_DAILY_ORDER_LIMIT): Promise<void> {
  if (limit === 0) return;
  const since = new Date(`${istToday(now)}T00:00:00+05:30`);
  const paid = await prisma.order.count({ where: { userId, status: { in: PAID }, paidAt: { gte: since } } });
  if (paid >= limit) {
    throw new AppError(
      "DEMO_DAILY_LIMIT",
      429,
      `This demo store allows ${limit} paid orders per account each day, so other visitors can try it too. Please come back tomorrow.`,
    );
  }
}

/**
 * Puts every variant back to its restock level, less what unpaid orders still hold (they return it
 * when they close), and gives seeded promotions and coupons that have ended a fresh window.
 */
export async function resetDemoStore(now = new Date()): Promise<DemoResetResultDTO> {
  const result = await prisma.$transaction(async (tx) => {
    const restockedVariants = await tx.$executeRaw`
      UPDATE product_variants AS v
      SET stock = GREATEST(v."restockLevel" - COALESCE(h.held, 0), 0)
      FROM product_variants AS base
      LEFT JOIN (
        SELECT oi."variantId", SUM(oi.quantity)::int AS held
        FROM order_items oi JOIN orders o ON o.id = oi."orderId"
        WHERE o.status = 'PENDING_PAYMENT'
        GROUP BY oi."variantId"
      ) AS h ON h."variantId" = base.id
      WHERE base.id = v.id
        AND v."restockLevel" IS NOT NULL
        AND v.stock <> GREATEST(v."restockLevel" - COALESCE(h.held, 0), 0)`;

    let renewedDeals = 0;
    const window = (d: { startOffsetMs: number; endOffsetMs: number }) => ({
      startsAt: new Date(now.getTime() + d.startOffsetMs),
      endsAt: new Date(now.getTime() + d.endOffsetMs),
    });
    for (const p of promotions) {
      renewedDeals += (await tx.promotion.updateMany({ where: { slug: p.slug, endsAt: { lte: now } }, data: window(p) })).count;
    }
    for (const c of coupons) {
      renewedDeals += (await tx.coupon.updateMany({ where: { code: c.code, endsAt: { lte: now } }, data: window(c) })).count;
    }

    await tx.storeSettings.updateMany({ where: { id: 1 }, data: { demoResetAt: now } });
    return { restockedVariants, renewedDeals, resetAt: now.toISOString() };
  });
  revalidateStorefront();
  return result;
}

/** The scheduled run: resets when the last reset is older than `hours` (0 turns it off). */
export async function maybeResetDemoStore(now = new Date(), hours = env.DEMO_RESET_HOURS): Promise<DemoResetResultDTO | null> {
  if (hours === 0) return null;
  const settings = await prisma.storeSettings.findUnique({ where: { id: 1 }, select: { demoResetAt: true } });
  if (!settings) return null;
  if (settings.demoResetAt && now.getTime() - settings.demoResetAt.getTime() < hours * 3_600_000) return null;
  return resetDemoStore(now);
}
