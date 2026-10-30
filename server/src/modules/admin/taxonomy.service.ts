import type { AdminBrandDTO, AdminCategoryDTO, AdminInventoryRowDTO } from "@nestama/shared";
import { prisma } from "../../lib/prisma";
import { AppError } from "../../lib/errors";
import { slugify } from "../../lib/slug";
import { revalidateStorefront } from "../../lib/revalidate";
import { refreshProductEmbeddings } from "../catalog/semantic";

/** "1 product", "3 products"; empty for zero so callers can drop it. */
const plural = (n: number, one: string, many = `${one}s`) => (n === 0 ? "" : `${n} ${n === 1 ? one : many}`);

// ───────── Categories ─────────

export interface CategoryData {
  name: string;
  slug?: string;
  description: string;
  imageUrl: string;
  imageAlt: string;
  parentId: string | null;
  sortOrder: number;
  showOnHome: boolean;
  homeLabel: string | null;
}

export async function listAdminCategories(): Promise<AdminCategoryDTO[]> {
  const rows = await prisma.category.findMany({
    orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
    include: { _count: { select: { products: true } } },
  });
  return rows.map((c) => ({
    id: c.id,
    slug: c.slug,
    name: c.name,
    description: c.description,
    imageUrl: c.imageUrl,
    imageAlt: c.imageAlt,
    parentId: c.parentId,
    sortOrder: c.sortOrder,
    showOnHome: c.showOnHome,
    homeLabel: c.homeLabel,
    productCount: c._count.products,
  }));
}

async function uniqueSlug(model: "category" | "brand", wanted: string | undefined, name: string, excludeId?: string): Promise<string> {
  const find = (slug: string) =>
    model === "category"
      ? prisma.category.findUnique({ where: { slug }, select: { id: true } })
      : prisma.brand.findUnique({ where: { slug }, select: { id: true } });
  const taken = async (slug: string) => {
    const hit = await find(slug);
    return Boolean(hit && hit.id !== excludeId);
  };
  if (wanted) {
    if (await taken(wanted)) throw new AppError("SLUG_TAKEN", 409, `The URL “${wanted}” is already in use.`);
    return wanted;
  }
  const base = slugify(name) || model;
  let slug = base;
  for (let n = 2; await taken(slug); n++) slug = `${base}-${n}`;
  return slug;
}

/** Categories nest one level deep (e.g. Accessories → Collars & Leashes). */
async function assertParent(parentId: string | null, selfId?: string) {
  if (!parentId) return;
  if (parentId === selfId) throw new AppError("INVALID_PARENT", 422, "A category can't be its own parent.");
  const parent = await prisma.category.findUnique({ where: { id: parentId }, select: { parentId: true } });
  if (!parent) throw new AppError("CATEGORY_NOT_FOUND", 404, "The parent category doesn't exist.");
  if (parent.parentId) throw new AppError("INVALID_PARENT", 422, "Categories can only be nested one level deep.");
  if (selfId && (await prisma.category.count({ where: { parentId: selfId } }))) {
    throw new AppError("INVALID_PARENT", 422, "This category has its own sub-categories, so it can't become one.");
  }
}

export async function createCategory(data: CategoryData): Promise<AdminCategoryDTO[]> {
  await assertParent(data.parentId);
  const slug = await uniqueSlug("category", data.slug, data.name);
  await prisma.category.create({ data: { ...data, slug } });
  revalidateStorefront();
  return listAdminCategories();
}

export async function updateCategory(id: string, data: CategoryData): Promise<AdminCategoryDTO[]> {
  if (!(await prisma.category.findUnique({ where: { id }, select: { id: true } }))) {
    throw new AppError("CATEGORY_NOT_FOUND", 404, "That category doesn't exist.");
  }
  await assertParent(data.parentId, id);
  const slug = await uniqueSlug("category", data.slug, data.name, id);
  await prisma.category.update({ where: { id }, data: { ...data, slug } });
  // Category names are part of each product's embedded text.
  const products = await prisma.product.findMany({
    where: { OR: [{ categoryId: id }, { category: { parentId: id } }] },
    select: { id: true },
  });
  await refreshProductEmbeddings(products.map((p) => p.id));
  revalidateStorefront();
  return listAdminCategories();
}

export async function deleteCategory(id: string): Promise<AdminCategoryDTO[]> {
  const c = await prisma.category.findUnique({ where: { id }, include: { _count: { select: { products: true, children: true } } } });
  if (!c) throw new AppError("CATEGORY_NOT_FOUND", 404, "That category doesn't exist.");
  if (c._count.products || c._count.children) {
    throw new AppError(
      "CATEGORY_IN_USE",
      409,
      `“${c.name}” still has ${[plural(c._count.products, "product"), plural(c._count.children, "sub-category", "sub-categories")].filter(Boolean).join(" and ")}. Move them first.`,
    );
  }
  await prisma.category.delete({ where: { id } });
  revalidateStorefront();
  return listAdminCategories();
}

// ───────── Brands ─────────

export interface BrandData {
  name: string;
  slug?: string;
  description: string;
}

export async function listAdminBrands(): Promise<AdminBrandDTO[]> {
  const rows = await prisma.brand.findMany({ orderBy: { name: "asc" }, include: { _count: { select: { products: true } } } });
  return rows.map((b) => ({ id: b.id, slug: b.slug, name: b.name, description: b.description, productCount: b._count.products }));
}

export async function createBrand(data: BrandData): Promise<AdminBrandDTO[]> {
  const slug = await uniqueSlug("brand", data.slug, data.name);
  await prisma.brand.create({ data: { ...data, slug } });
  revalidateStorefront();
  return listAdminBrands();
}

export async function updateBrand(id: string, data: BrandData): Promise<AdminBrandDTO[]> {
  if (!(await prisma.brand.findUnique({ where: { id }, select: { id: true } })))
    throw new AppError("BRAND_NOT_FOUND", 404, "That brand doesn't exist.");
  const slug = await uniqueSlug("brand", data.slug, data.name, id);
  await prisma.brand.update({ where: { id }, data: { ...data, slug } });
  revalidateStorefront();
  return listAdminBrands();
}

export async function deleteBrand(id: string): Promise<AdminBrandDTO[]> {
  const b = await prisma.brand.findUnique({ where: { id }, include: { _count: { select: { products: true } } } });
  if (!b) throw new AppError("BRAND_NOT_FOUND", 404, "That brand doesn't exist.");
  if (b._count.products)
    throw new AppError("BRAND_IN_USE", 409, `“${b.name}” still has ${plural(b._count.products, "product")}. Move them first.`);
  await prisma.brand.delete({ where: { id } });
  revalidateStorefront();
  return listAdminBrands();
}

// ───────── Inventory ─────────

export async function listInventory(query: { q?: string; low?: boolean }): Promise<AdminInventoryRowDTO[]> {
  const variants = await prisma.productVariant.findMany({
    where: query.q
      ? {
          OR: [
            { sku: { contains: query.q, mode: "insensitive" } },
            { label: { contains: query.q, mode: "insensitive" } },
            { product: { name: { contains: query.q, mode: "insensitive" } } },
          ],
        }
      : undefined,
    include: {
      product: {
        select: {
          id: true,
          name: true,
          slug: true,
          isActive: true,
          images: { orderBy: { sortOrder: "asc" }, take: 1, select: { url: true } },
        },
      },
    },
    orderBy: [{ product: { name: "asc" } }, { sortOrder: "asc" }],
  });
  const rows = variants.map((v) => ({
    variantId: v.id,
    sku: v.sku,
    label: v.label,
    productId: v.product.id,
    productName: v.product.name,
    productSlug: v.product.slug,
    image: v.product.images[0]?.url ?? null,
    stock: v.stock,
    lowStockThreshold: v.lowStockThreshold,
    productActive: v.product.isActive,
  }));
  // Low = at or under the variant's own threshold (two-column comparison, so done here).
  return query.low ? rows.filter((r) => r.stock <= r.lowStockThreshold).sort((a, b) => a.stock - b.stock) : rows;
}

export async function updateStock(items: { variantId: string; stock: number }[]): Promise<{ updated: number }> {
  const ids = [...new Set(items.map((i) => i.variantId))];
  const found = await prisma.productVariant.count({ where: { id: { in: ids } } });
  if (found !== ids.length)
    throw new AppError("VARIANT_NOT_FOUND", 404, "Some of those product options no longer exist. Refresh and try again.");
  await prisma.$transaction(
    items.map((i) => prisma.productVariant.update({ where: { id: i.variantId }, data: { stock: i.stock, restockLevel: i.stock } })),
  );
  revalidateStorefront();
  return { updated: items.length };
}
