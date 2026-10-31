import type { AdminProductData, AdminProductDTO, AdminProductRowDTO, Paginated, PetTypeValue } from "@nestama/shared";
import { prisma } from "../../lib/prisma";
import { AppError } from "../../lib/errors";
import { slugify } from "../../lib/slug";
import { revalidateStorefront } from "../../lib/revalidate";
import { refreshProductEmbeddings } from "../catalog/semantic";
import type { Prisma } from "../../generated/prisma/client";

const PAGE_SIZE = 20;

export interface AdminProductQuery {
  q?: string;
  category?: string;
  status?: "active" | "inactive";
  stock?: "low" | "out";
  sample?: "1" | "0";
  page: number;
}

const rowInclude = {
  brand: { select: { name: true } },
  category: { select: { name: true } },
  images: { orderBy: { sortOrder: "asc" }, take: 1, select: { url: true } },
  variants: { select: { price: true, stock: true, lowStockThreshold: true } },
} satisfies Prisma.ProductInclude;

function toRow(p: Prisma.ProductGetPayload<{ include: typeof rowInclude }>): AdminProductRowDTO {
  const stock = p.variants.reduce((n, v) => n + v.stock, 0);
  const anyLow = p.variants.some((v) => v.stock <= v.lowStockThreshold);
  return {
    id: p.id,
    slug: p.slug,
    name: p.name,
    brand: p.brand.name,
    category: p.category.name,
    petType: p.petType as PetTypeValue,
    isActive: p.isActive,
    isSample: p.isSample,
    isFeatured: p.isFeatured,
    image: p.images[0]?.url ?? null,
    priceFrom: p.variants.length ? Math.min(...p.variants.map((v) => v.price)) : 0,
    stock,
    stockState: stock === 0 ? "out" : anyLow ? "low" : "ok",
    variantCount: p.variants.length,
    soldCount: p.soldCount,
    updatedAt: p.updatedAt.toISOString(),
  };
}

export async function listAdminProducts(query: AdminProductQuery): Promise<Paginated<AdminProductRowDTO>> {
  const and: Prisma.ProductWhereInput[] = [];
  if (query.q) {
    const q = query.q;
    and.push({
      OR: [
        { name: { contains: q, mode: "insensitive" } },
        { slug: { contains: q, mode: "insensitive" } },
        { brand: { name: { contains: q, mode: "insensitive" } } },
        { variants: { some: { sku: { contains: q, mode: "insensitive" } } } },
      ],
    });
  }
  if (query.category) and.push({ OR: [{ categoryId: query.category }, { category: { parentId: query.category } }] });
  if (query.status) and.push({ isActive: query.status === "active" });
  if (query.sample) and.push({ isSample: query.sample === "1" });
  if (query.stock === "out") and.push({ variants: { every: { stock: 0 } } });
  // Prisma can't compare two columns, so "low" uses the default threshold; rows show exact state.
  if (query.stock === "low") and.push({ variants: { some: { stock: { lte: 5 } } } });
  const where: Prisma.ProductWhereInput = { AND: and };

  const [total, rows] = await Promise.all([
    prisma.product.count({ where }),
    prisma.product.findMany({
      where,
      include: rowInclude,
      orderBy: [{ updatedAt: "desc" }, { id: "asc" }],
      skip: (query.page - 1) * PAGE_SIZE,
      take: PAGE_SIZE,
    }),
  ]);
  return { items: rows.map(toRow), page: query.page, pageSize: PAGE_SIZE, total, totalPages: Math.max(1, Math.ceil(total / PAGE_SIZE)) };
}

const detailInclude = {
  variants: { orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }], include: { _count: { select: { orderItems: true } } } },
  images: { orderBy: { sortOrder: "asc" } },
} satisfies Prisma.ProductInclude;

export async function getAdminProduct(id: string): Promise<AdminProductDTO> {
  const p = await prisma.product.findUnique({ where: { id }, include: detailInclude });
  if (!p) throw new AppError("PRODUCT_NOT_FOUND", 404, "That product doesn't exist.");
  return {
    id: p.id,
    slug: p.slug,
    name: p.name,
    shortDescription: p.shortDescription,
    description: p.description,
    petType: p.petType as PetTypeValue,
    categoryId: p.categoryId,
    brandId: p.brandId,
    specs: (p.specs as { label: string; value: string }[]) ?? [],
    tags: p.tags,
    isActive: p.isActive,
    isFeatured: p.isFeatured,
    isSample: p.isSample,
    variants: p.variants.map((v) => ({
      id: v.id,
      sku: v.sku,
      label: v.label,
      options: (v.options as Record<string, string>) ?? {},
      price: v.price,
      mrp: v.mrp,
      stock: v.stock,
      lowStockThreshold: v.lowStockThreshold,
      isDefault: v.isDefault,
      hasOrders: v._count.orderItems > 0,
    })),
    images: p.images.map((i) => ({ id: i.id, url: i.url, alt: i.alt, width: i.width, height: i.height })),
    ratingAvg: p.ratingAvg,
    ratingCount: p.ratingCount,
    soldCount: p.soldCount,
  };
}

/** An explicit slug must be free; a generated one gets -2, -3… until it is. */
async function resolveSlug(data: AdminProductData, excludeId?: string): Promise<string> {
  const taken = async (slug: string) => {
    const hit = await prisma.product.findUnique({ where: { slug }, select: { id: true } });
    return Boolean(hit && hit.id !== excludeId);
  };
  if (data.slug) {
    if (await taken(data.slug)) throw new AppError("SLUG_TAKEN", 409, `The URL “${data.slug}” is already used by another product.`);
    return data.slug;
  }
  const base = slugify(data.name) || "product";
  let slug = base;
  for (let n = 2; await taken(slug); n++) slug = `${base}-${n}`;
  return slug;
}

async function assertReferences(data: AdminProductData, productId?: string) {
  const [category, brand, clashes] = await Promise.all([
    prisma.category.findUnique({ where: { id: data.categoryId }, select: { id: true } }),
    prisma.brand.findUnique({ where: { id: data.brandId }, select: { id: true } }),
    prisma.productVariant.findMany({
      where: { sku: { in: data.variants.map((v) => v.sku) }, ...(productId && { productId: { not: productId } }) },
      select: { sku: true },
    }),
  ]);
  if (!category) throw new AppError("CATEGORY_NOT_FOUND", 404, "Choose a category that exists.");
  if (!brand) throw new AppError("BRAND_NOT_FOUND", 404, "Choose a brand that exists.");
  if (clashes.length) {
    throw new AppError("SKU_TAKEN", 409, `SKU ${clashes.map((c) => c.sku).join(", ")} is already used by another product.`, {
      skus: clashes.map((c) => c.sku),
    });
  }
}

function productFields(data: AdminProductData, slug: string) {
  return {
    slug,
    name: data.name,
    shortDescription: data.shortDescription,
    description: data.description,
    petType: data.petType,
    categoryId: data.categoryId,
    brandId: data.brandId,
    specs: data.specs as Prisma.InputJsonValue,
    tags: data.tags,
    isActive: data.isActive,
    isFeatured: data.isFeatured,
    isSample: data.isSample,
  };
}

function variantFields(v: AdminProductData["variants"][number], sortOrder: number) {
  return {
    sku: v.sku,
    label: v.label,
    options: v.options as Prisma.InputJsonValue,
    price: v.price,
    mrp: v.mrp,
    stock: v.stock,
    restockLevel: v.stock, // an admin's stock edit is the level the demo reset returns to
    lowStockThreshold: v.lowStockThreshold,
    isDefault: v.isDefault,
    sortOrder,
  };
}

export async function createAdminProduct(data: AdminProductData): Promise<AdminProductDTO> {
  await assertReferences(data);
  const slug = await resolveSlug(data);
  const created = await prisma.product.create({
    data: {
      ...productFields(data, slug),
      variants: { create: data.variants.map((v, i) => variantFields(v, i)) },
      images: { create: data.images.map((img, i) => ({ url: img.url, alt: img.alt, width: img.width, height: img.height, sortOrder: i })) },
    },
    select: { id: true },
  });
  await refreshProductEmbeddings([created.id]);
  revalidateStorefront();
  return getAdminProduct(created.id);
}

/**
 * Full replace. Variants and images are matched by id: kept ones update, new ones are created,
 * missing ones are removed (order lines keep their own name/price snapshots).
 */
export async function updateAdminProduct(id: string, data: AdminProductData): Promise<AdminProductDTO> {
  const existing = await prisma.product.findUnique({
    where: { id },
    include: { variants: { select: { id: true } }, images: { select: { id: true } } },
  });
  if (!existing) throw new AppError("PRODUCT_NOT_FOUND", 404, "That product doesn't exist.");
  await assertReferences(data, id);
  const slug = await resolveSlug(data, id);

  const keepVariants = new Set(data.variants.map((v) => v.id).filter(Boolean));
  const keepImages = new Set(data.images.map((i) => i.id).filter(Boolean));
  const ownVariant = new Set(existing.variants.map((v) => v.id));
  const ownImage = new Set(existing.images.map((i) => i.id));

  await prisma.$transaction(async (tx) => {
    await tx.product.update({ where: { id }, data: productFields(data, slug) });

    const dropVariants = existing.variants.filter((v) => !keepVariants.has(v.id)).map((v) => v.id);
    if (dropVariants.length) await tx.productVariant.deleteMany({ where: { id: { in: dropVariants } } });
    // Free kept SKUs first so swapping SKUs between options can't trip the unique index.
    for (const v of data.variants) {
      if (v.id && ownVariant.has(v.id)) await tx.productVariant.update({ where: { id: v.id }, data: { sku: `${v.sku}~${v.id}` } });
    }
    for (const [i, v] of data.variants.entries()) {
      if (v.id && ownVariant.has(v.id)) await tx.productVariant.update({ where: { id: v.id }, data: variantFields(v, i) });
      else await tx.productVariant.create({ data: { ...variantFields(v, i), productId: id } });
    }

    const dropImages = existing.images.filter((img) => !keepImages.has(img.id)).map((img) => img.id);
    if (dropImages.length) await tx.productImage.deleteMany({ where: { id: { in: dropImages } } });
    for (const [i, img] of data.images.entries()) {
      const fields = { url: img.url, alt: img.alt, width: img.width, height: img.height, sortOrder: i };
      if (img.id && ownImage.has(img.id)) await tx.productImage.update({ where: { id: img.id }, data: fields });
      else await tx.productImage.create({ data: { ...fields, productId: id } });
    }
  });

  await refreshProductEmbeddings([id]);
  revalidateStorefront();
  return getAdminProduct(id);
}

export async function setProductActive(id: string, isActive: boolean): Promise<AdminProductDTO> {
  const found = await prisma.product.findUnique({ where: { id }, select: { id: true } });
  if (!found) throw new AppError("PRODUCT_NOT_FOUND", 404, "That product doesn't exist.");
  await prisma.product.update({ where: { id }, data: { isActive } });
  revalidateStorefront();
  return getAdminProduct(id);
}
