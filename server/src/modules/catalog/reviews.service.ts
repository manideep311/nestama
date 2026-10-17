import { PAID_STATUSES, type ReviewDTO, type ReviewInput, type ReviewListDTO } from "@nestama/shared";
import { prisma } from "../../lib/prisma";
import { notFound } from "../../lib/errors";
import { distributionFromAverage } from "../../lib/ratings";
import type { OrderStatus } from "../../generated/prisma/enums";

const PAGE_SIZE = 5;
const SAMPLE_REVIEWER_PREFIX = "sample-reviewer-";

/** "Asha Rao" → "Asha R." — reviews never show a customer's full name. */
export function reviewerDisplayName(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "NESTAMA customer";
  if (parts.length === 1) return parts[0]!;
  const last = parts.at(-1)!.replace(/\.$/, "");
  return `${parts[0]} ${last[0]!.toUpperCase()}.`;
}

type ReviewRow = {
  id: string;
  userId: string;
  rating: number;
  title: string;
  body: string;
  createdAt: Date;
  isVerifiedPurchase: boolean;
  user: { name: string };
};

function toReviewDTO(r: ReviewRow): ReviewDTO {
  return {
    id: r.id,
    rating: r.rating,
    title: r.title,
    body: r.body,
    author: reviewerDisplayName(r.user.name),
    createdAt: r.createdAt.toISOString(),
    isVerifiedPurchase: r.isVerifiedPurchase,
    // Seeded demo reviews are labelled as sample content; real customers' reviews never are.
    isSample: r.userId.startsWith(SAMPLE_REVIEWER_PREFIX),
  };
}

async function activeProduct(slug: string) {
  const product = await prisma.product.findFirst({
    where: { slug, isActive: true },
    select: { id: true, ratingAvg: true, ratingCount: true },
  });
  if (!product) throw notFound("Product");
  return product;
}

export async function getProductReviews(slug: string, page = 1): Promise<ReviewListDTO> {
  const product = await activeProduct(slug);
  const where = { productId: product.id, status: "PUBLISHED" as const };
  const [total, rows] = await Promise.all([
    prisma.review.count({ where }),
    prisma.review.findMany({
      where,
      orderBy: { createdAt: "desc" },
      skip: (page - 1) * PAGE_SIZE,
      take: PAGE_SIZE,
      include: { user: { select: { name: true } } },
    }),
  ]);

  return {
    summary: {
      average: product.ratingAvg,
      count: product.ratingCount,
      distribution: distributionFromAverage(product.ratingAvg, product.ratingCount),
    },
    items: rows.map(toReviewDTO),
    page,
    totalPages: Math.max(1, Math.ceil(total / PAGE_SIZE)),
  };
}

export async function getMyReview(userId: string, slug: string): Promise<ReviewDTO | null> {
  const product = await activeProduct(slug);
  const review = await prisma.review.findUnique({
    where: { productId_userId: { productId: product.id, userId } },
    include: { user: { select: { name: true } } },
  });
  return review ? toReviewDTO(review) : null;
}

/**
 * Creates the caller's review, or updates it if they already wrote one (one per product).
 * "Verified purchase" means a paid order containing the product. The product's rating totals
 * include ratings beyond the written reviews, so they are adjusted incrementally in one atomic
 * statement rather than recomputed from review rows.
 */
export async function upsertReview(
  userId: string,
  slug: string,
  input: Required<ReviewInput>,
): Promise<{ review: ReviewDTO; created: boolean }> {
  const product = await activeProduct(slug);
  const purchased = await prisma.orderItem.count({
    where: { productId: product.id, order: { userId, status: { in: PAID_STATUSES as OrderStatus[] } } },
  });

  return prisma.$transaction(async (tx) => {
    const existing = await tx.review.findUnique({ where: { productId_userId: { productId: product.id, userId } } });
    const data = { rating: input.rating, title: input.title, body: input.body, isVerifiedPurchase: purchased > 0 };

    if (!existing) {
      const review = await tx.review.create({
        data: { ...data, productId: product.id, userId },
        include: { user: { select: { name: true } } },
      });
      await tx.$executeRaw`
        UPDATE products
        SET "ratingAvg" = ROUND((("ratingAvg" * "ratingCount" + ${input.rating}) / ("ratingCount" + 1))::numeric, 2),
            "ratingCount" = "ratingCount" + 1
        WHERE id = ${product.id}`;
      return { review: toReviewDTO(review), created: true };
    }

    const review = await tx.review.update({ where: { id: existing.id }, data, include: { user: { select: { name: true } } } });
    const delta = input.rating - existing.rating;
    if (delta !== 0 && existing.status === "PUBLISHED") {
      await tx.$executeRaw`
        UPDATE products
        SET "ratingAvg" = LEAST(5, GREATEST(1, ROUND((("ratingAvg" * "ratingCount" + ${delta}) / GREATEST("ratingCount", 1))::numeric, 2)))
        WHERE id = ${product.id}`;
    }
    return { review: toReviewDTO(review), created: false };
  });
}
