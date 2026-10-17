import { MAX_WISHLIST_ITEMS, type WishlistDTO } from "@nestama/shared";
import { prisma } from "../../lib/prisma";
import { AppError } from "../../lib/errors";

/** Saved product ids, newest first. */
export async function getWishlist(userId: string): Promise<WishlistDTO> {
  const rows = await prisma.wishlistItem.findMany({
    where: { userId },
    orderBy: { createdAt: "desc" },
    select: { productId: true },
    take: MAX_WISHLIST_ITEMS,
  });
  return { productIds: rows.map((r) => r.productId) };
}

/** Keeps only the newest MAX_WISHLIST_ITEMS saves. */
async function trim(userId: string) {
  const overflow = await prisma.wishlistItem.findMany({
    where: { userId },
    orderBy: { createdAt: "desc" },
    skip: MAX_WISHLIST_ITEMS,
    select: { id: true },
  });
  if (overflow.length) await prisma.wishlistItem.deleteMany({ where: { id: { in: overflow.map((o) => o.id) } } });
}

export async function addToWishlist(userId: string, productId: string): Promise<WishlistDTO> {
  const product = await prisma.product.findFirst({ where: { id: productId, isActive: true }, select: { id: true } });
  if (!product) throw new AppError("PRODUCT_NOT_FOUND", 404, "That product isn't available.");
  await prisma.wishlistItem.upsert({
    where: { userId_productId: { userId, productId } },
    update: {},
    create: { userId, productId },
  });
  await trim(userId);
  return getWishlist(userId);
}

export async function removeFromWishlist(userId: string, productId: string): Promise<WishlistDTO> {
  await prisma.wishlistItem.deleteMany({ where: { userId, productId } });
  return getWishlist(userId);
}

/**
 * Sign-in sync: the guest's local saves (newest first) are added to the account's list.
 * Unknown or inactive products are ignored; existing saves keep their place.
 */
export async function syncWishlist(userId: string, productIds: string[]): Promise<WishlistDTO> {
  if (productIds.length > 0) {
    const valid = await prisma.product.findMany({ where: { id: { in: productIds }, isActive: true }, select: { id: true } });
    const known = new Set(valid.map((p) => p.id));
    const now = Date.now();
    await prisma.wishlistItem.createMany({
      data: productIds
        .filter((id) => known.has(id))
        // Local lists are newest-first; keep that order when timestamps are assigned.
        .map((productId, i) => ({ userId, productId, createdAt: new Date(now - i) })),
      skipDuplicates: true,
    });
    await trim(userId);
  }
  return getWishlist(userId);
}
