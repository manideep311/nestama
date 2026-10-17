import {
  PAID_STATUSES,
  type AdminCustomerDetailDTO,
  type AdminCustomerRowDTO,
  type AdminReviewRowDTO,
  type Paginated,
} from "@nestama/shared";
import { prisma } from "../../lib/prisma";
import { AppError } from "../../lib/errors";
import { revalidateStorefront } from "../../lib/revalidate";
import type { Prisma } from "../../generated/prisma/client";
import type { OrderStatus } from "../../generated/prisma/enums";
import { reviewerDisplayName } from "../catalog/reviews.service";
import { adminOrderRowInclude, toAdminOrderRow } from "./orders.service";

const PAGE_SIZE = 20;
const PAID = PAID_STATUSES as OrderStatus[];

// ───────── Customers ─────────

async function spendByUser(userIds: string[]) {
  const groups = await prisma.order.groupBy({
    by: ["userId"],
    where: { userId: { in: userIds }, status: { in: PAID } },
    _count: { _all: true },
    _sum: { total: true },
  });
  return new Map(groups.map((g) => [g.userId, { orderCount: g._count._all, totalSpent: g._sum.total ?? 0 }]));
}

export async function listCustomers(query: {
  q?: string;
  role?: "CUSTOMER" | "ADMIN";
  page: number;
}): Promise<Paginated<AdminCustomerRowDTO>> {
  const where: Prisma.UserWhereInput = {
    // Seeded sample reviewers aren't real customers.
    id: { not: { startsWith: "sample-reviewer-" } },
    ...(query.role && { role: query.role }),
    ...(query.q && { OR: [{ name: { contains: query.q, mode: "insensitive" } }, { email: { contains: query.q, mode: "insensitive" } }] }),
  };
  const [total, users] = await Promise.all([
    prisma.user.count({ where }),
    prisma.user.findMany({ where, orderBy: { createdAt: "desc" }, skip: (query.page - 1) * PAGE_SIZE, take: PAGE_SIZE }),
  ]);
  const spend = await spendByUser(users.map((u) => u.id));
  return {
    items: users.map((u) => ({
      id: u.id,
      name: u.name,
      email: u.email,
      role: u.role,
      createdAt: u.createdAt.toISOString(),
      orderCount: spend.get(u.id)?.orderCount ?? 0,
      totalSpent: spend.get(u.id)?.totalSpent ?? 0,
    })),
    page: query.page,
    pageSize: PAGE_SIZE,
    total,
    totalPages: Math.max(1, Math.ceil(total / PAGE_SIZE)),
  };
}

export async function getCustomer(id: string): Promise<AdminCustomerDetailDTO> {
  const user = await prisma.user.findUnique({ where: { id }, include: { _count: { select: { addresses: true, reviews: true } } } });
  if (!user) throw new AppError("CUSTOMER_NOT_FOUND", 404, "That customer doesn't exist.");
  const [spend, orders] = await Promise.all([
    spendByUser([id]),
    prisma.order.findMany({ where: { userId: id }, include: adminOrderRowInclude, orderBy: { placedAt: "desc" }, take: 50 }),
  ]);
  return {
    id: user.id,
    name: user.name,
    email: user.email,
    role: user.role,
    createdAt: user.createdAt.toISOString(),
    orderCount: spend.get(id)?.orderCount ?? 0,
    totalSpent: spend.get(id)?.totalSpent ?? 0,
    phone: user.phone,
    addressCount: user._count.addresses,
    reviewCount: user._count.reviews,
    orders: orders.map(toAdminOrderRow),
  };
}

/** Admins can promote and demote, but never remove their own access or the last admin's. */
export async function updateRole(actorId: string, targetId: string, role: "CUSTOMER" | "ADMIN"): Promise<AdminCustomerDetailDTO> {
  const target = await prisma.user.findUnique({ where: { id: targetId }, select: { role: true } });
  if (!target) throw new AppError("CUSTOMER_NOT_FOUND", 404, "That customer doesn't exist.");
  if (target.role === "ADMIN" && role === "CUSTOMER") {
    if (targetId === actorId) throw new AppError("CANNOT_DEMOTE_SELF", 409, "You can't remove your own admin access. Ask another admin.");
    if ((await prisma.user.count({ where: { role: "ADMIN" } })) <= 1) {
      throw new AppError("LAST_ADMIN", 409, "This is the only admin. Promote someone else first.");
    }
  }
  await prisma.user.update({ where: { id: targetId }, data: { role } });
  return getCustomer(targetId);
}

// ───────── Reviews ─────────

const reviewInclude = {
  user: { select: { name: true, email: true } },
  product: { select: { id: true, name: true, slug: true } },
} satisfies Prisma.ReviewInclude;

function toReviewRow(r: Prisma.ReviewGetPayload<{ include: typeof reviewInclude }>): AdminReviewRowDTO {
  return {
    id: r.id,
    rating: r.rating,
    title: r.title,
    body: r.body,
    status: r.status,
    author: reviewerDisplayName(r.user.name),
    authorEmail: r.user.email,
    isSample: r.userId.startsWith("sample-reviewer-"),
    isVerifiedPurchase: r.isVerifiedPurchase,
    createdAt: r.createdAt.toISOString(),
    product: r.product,
  };
}

export async function listReviews(query: {
  status?: "PUBLISHED" | "HIDDEN";
  q?: string;
  page: number;
}): Promise<Paginated<AdminReviewRowDTO>> {
  const where: Prisma.ReviewWhereInput = {
    ...(query.status && { status: query.status }),
    ...(query.q && {
      OR: [
        { title: { contains: query.q, mode: "insensitive" } },
        { body: { contains: query.q, mode: "insensitive" } },
        { product: { name: { contains: query.q, mode: "insensitive" } } },
        { user: { email: { contains: query.q, mode: "insensitive" } } },
        { user: { name: { contains: query.q, mode: "insensitive" } } },
      ],
    }),
  };
  const [total, rows] = await Promise.all([
    prisma.review.count({ where }),
    prisma.review.findMany({
      where,
      include: reviewInclude,
      orderBy: { createdAt: "desc" },
      skip: (query.page - 1) * PAGE_SIZE,
      take: PAGE_SIZE,
    }),
  ]);
  return {
    items: rows.map(toReviewRow),
    page: query.page,
    pageSize: PAGE_SIZE,
    total,
    totalPages: Math.max(1, Math.ceil(total / PAGE_SIZE)),
  };
}

/**
 * Hides or republishes a review. The product's rating totals (which include ratings beyond the
 * written reviews) are adjusted by that one rating, atomically.
 */
export async function setReviewStatus(id: string, status: "PUBLISHED" | "HIDDEN"): Promise<AdminReviewRowDTO> {
  const review = await prisma.review.findUnique({ where: { id } });
  if (!review) throw new AppError("REVIEW_NOT_FOUND", 404, "That review doesn't exist.");
  if (review.status !== status) {
    await prisma.$transaction(async (tx) => {
      await tx.review.update({ where: { id }, data: { status } });
      if (status === "HIDDEN") {
        await tx.$executeRaw`
          UPDATE products
          SET "ratingAvg" = CASE WHEN "ratingCount" <= 1 THEN 0
                                 ELSE ROUND((("ratingAvg" * "ratingCount" - ${review.rating}) / ("ratingCount" - 1))::numeric, 2) END,
              "ratingCount" = GREATEST("ratingCount" - 1, 0)
          WHERE id = ${review.productId}`;
      } else {
        await tx.$executeRaw`
          UPDATE products
          SET "ratingAvg" = ROUND((("ratingAvg" * "ratingCount" + ${review.rating}) / ("ratingCount" + 1))::numeric, 2),
              "ratingCount" = "ratingCount" + 1
          WHERE id = ${review.productId}`;
      }
    });
    revalidateStorefront();
  }
  return toReviewRow(await prisma.review.findUniqueOrThrow({ where: { id }, include: reviewInclude }));
}
