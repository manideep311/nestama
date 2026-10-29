// Seeds the NESTAMA sample catalog. Idempotent: safe to run repeatedly.
// Run: pnpm --filter server db:seed
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { prisma } from "../src/lib/prisma";
import { auth } from "../src/lib/auth";
import { env } from "../src/config/env";
import { rupeesToPaise } from "@nestama/shared";
import { brands, categories, settings, unsplash } from "./seed-data/catalog-meta";
import { products } from "./seed-data/products";
import { coupons, promotions } from "./seed-data/promotions";
import { reviewers, reviewsFor } from "./seed-data/reviews";

const here = path.dirname(fileURLToPath(import.meta.url));
const dims = JSON.parse(fs.readFileSync(path.join(here, "seed-data/image-dims.json"), "utf8")) as Record<string, [number, number]>;

function imageSize(id: string): { width: number; height: number } {
  const d = dims[id];
  if (!d) throw new Error(`Missing dimensions for image ${id}. Run prisma/seed-data/build-image-dims.ts`);
  return { width: d[0], height: d[1] };
}

const DAY = 24 * 3600_000;

async function seedBrands() {
  for (const b of brands) {
    await prisma.brand.upsert({ where: { slug: b.slug }, update: { name: b.name, description: b.description }, create: b });
  }
}

async function seedCategories() {
  // Parents first so children can reference them.
  const ordered = [...categories].sort((a, b) => Number(Boolean(a.parent)) - Number(Boolean(b.parent)));
  for (const c of ordered) {
    const parentId = c.parent ? (await prisma.category.findUniqueOrThrow({ where: { slug: c.parent } })).id : null;
    const data = {
      name: c.name,
      homeLabel: c.homeLabel ?? null,
      description: c.description,
      imageUrl: unsplash(c.imageId),
      imageAlt: c.imageAlt,
      showOnHome: c.showOnHome,
      sortOrder: c.sortOrder,
      parentId,
    };
    await prisma.category.upsert({ where: { slug: c.slug }, update: data, create: { slug: c.slug, ...data } });
  }
}

async function seedSettings() {
  const data = {
    announcementText: settings.announcementText,
    freeShippingThreshold: settings.freeShippingThreshold,
    flatShippingFee: settings.flatShippingFee,
    gstRatePercent: settings.gstRatePercent,
    heroHeadline: settings.heroHeadline,
    heroSubcopy: settings.heroSubcopy,
    heroImageUrl: unsplash(settings.heroImageId),
    heroImageAlt: settings.heroImageAlt,
    popularSearches: settings.popularSearches,
    supportEmail: settings.supportEmail,
    supportPhone: settings.supportPhone,
  };
  await prisma.storeSettings.upsert({ where: { id: 1 }, update: data, create: { id: 1, ...data } });
}

async function seedProducts() {
  const categoryIds = new Map((await prisma.category.findMany()).map((c) => [c.slug, c.id]));
  const brandIds = new Map((await prisma.brand.findMany()).map((b) => [b.slug, b.id]));
  const now = Date.now();

  for (const p of products) {
    const categoryId = categoryIds.get(p.category);
    const brandId = brandIds.get(p.brand);
    if (!categoryId || !brandId) throw new Error(`Unknown category/brand for ${p.slug}`);

    const data = {
      name: p.name,
      shortDescription: p.short,
      description: p.description,
      petType: p.petType,
      categoryId,
      brandId,
      specs: p.specs.map(([label, value]) => ({ label, value })),
      tags: p.tags,
      isActive: true,
      isSample: true,
      isFeatured: p.featured ?? false,
      publishedAt: new Date(now - p.daysAgo * DAY),
      ratingAvg: p.rating,
      ratingCount: p.reviews,
      soldCount: p.sold,
    };

    const product = await prisma.product.upsert({ where: { slug: p.slug }, update: data, create: { slug: p.slug, ...data } });

    // Images are owned by the sample product: replace them wholesale.
    await prisma.productImage.deleteMany({ where: { productId: product.id } });
    await prisma.productImage.createMany({
      data: p.images.map((img, i) => ({
        productId: product.id,
        url: unsplash(img.id),
        alt: img.alt,
        ...imageSize(img.id),
        sortOrder: i,
      })),
    });

    // Variants are referenced by carts/orders, so upsert by SKU instead of recreating.
    for (const [i, v] of p.variants.entries()) {
      const vData = {
        productId: product.id,
        label: v.label,
        options: v.options,
        price: rupeesToPaise(v.price),
        mrp: v.mrp ? rupeesToPaise(v.mrp) : null,
        stock: v.stock,
        restockLevel: v.stock,
        isDefault: i === 0,
        sortOrder: i,
      };
      await prisma.productVariant.upsert({ where: { sku: v.sku }, update: vData, create: { sku: v.sku, ...vData } });
    }
  }
}

async function seedCoupons() {
  const now = Date.now();
  for (const c of coupons) {
    const data = {
      description: c.description,
      type: c.type,
      value: c.type === "FIXED" ? rupeesToPaise(c.value) : c.value,
      minOrder: rupeesToPaise(c.minOrder),
      maxDiscount: c.maxDiscount ? rupeesToPaise(c.maxDiscount) : null,
      startsAt: new Date(now + c.startOffsetMs),
      endsAt: new Date(now + c.endOffsetMs),
      usageLimit: c.usageLimit ?? null,
      perUserLimit: c.perUserLimit ?? null,
      scope: "ALL" as const,
      isActive: true,
    };
    await prisma.coupon.upsert({ where: { code: c.code }, update: data, create: { code: c.code, ...data } });
  }
}

async function seedPromotions() {
  const now = Date.now();
  for (const p of promotions) {
    const coupon = p.couponCode ? await prisma.coupon.findUniqueOrThrow({ where: { code: p.couponCode } }) : null;
    const categoryRefs = (p.categorySlugs ?? []).map((slug) => ({ slug }));
    const productRefs = (p.productSlugs ?? []).map((slug) => ({ slug }));
    const data = {
      name: p.name,
      headline: p.headline,
      subheadline: p.subheadline,
      discountPercent: p.discountPercent,
      startsAt: new Date(now + p.startOffsetMs),
      endsAt: new Date(now + p.endOffsetMs),
      isActive: true,
      placement: p.placement,
      scope: p.scope,
      couponId: coupon?.id ?? null,
      imageUrl: p.imageId ? unsplash(p.imageId) : null,
      imageAlt: p.imageAlt ?? null,
      ctaLabel: p.ctaLabel,
      ctaHref: p.ctaHref,
      theme: p.theme,
      sortOrder: p.sortOrder,
    };
    await prisma.promotion.upsert({
      where: { slug: p.slug },
      update: { ...data, categories: { set: categoryRefs }, products: { set: productRefs } },
      create: { slug: p.slug, ...data, categories: { connect: categoryRefs }, products: { connect: productRefs } },
    });
  }
}

async function seedReviews() {
  for (const r of reviewers) {
    await prisma.user.upsert({ where: { email: r.email }, update: { name: r.name }, create: { id: r.id, name: r.name, email: r.email } });
  }
  const sampleProducts = await prisma.product.findMany({
    where: { isSample: true },
    include: { category: { select: { slug: true } } },
    orderBy: { slug: "asc" },
  });
  const now = Date.now();
  for (const [index, product] of sampleProducts.entries()) {
    const copy = reviewsFor(product.name, product.petType, product.category.slug, index);
    for (const [i, [rating, title, body]] of copy.entries()) {
      const reviewer = reviewers[(index + i) % reviewers.length]!;
      const data = {
        rating,
        title,
        body,
        status: "PUBLISHED" as const,
        isVerifiedPurchase: (index + i) % 3 !== 0,
        createdAt: new Date(now - ((index * 7 + i * 19) % 120) * DAY - i * 3600_000),
      };
      await prisma.review.upsert({
        where: { productId_userId: { productId: product.id, userId: reviewer.id } },
        update: data,
        create: { productId: product.id, userId: reviewer.id, ...data },
      });
    }
  }
}

/** The first admin, from ADMIN_EMAIL / ADMIN_PASSWORD (created through Better Auth so the password is hashed). */
async function seedAdmin(): Promise<string> {
  if (!env.ADMIN_EMAIL || !env.ADMIN_PASSWORD) return "admin skipped (ADMIN_EMAIL / ADMIN_PASSWORD not set)";
  const email = env.ADMIN_EMAIL.toLowerCase();
  const existing = await prisma.user.findUnique({ where: { email } });
  if (!existing) await auth.api.signUpEmail({ body: { email, password: env.ADMIN_PASSWORD, name: "NESTAMA Admin" } });
  await prisma.user.update({ where: { email }, data: { role: "ADMIN", emailVerified: true } });
  return existing ? "admin account already present" : "admin account created";
}

async function main() {
  const started = Date.now();
  await seedBrands();
  await seedCategories();
  await seedSettings();
  await seedProducts();
  await seedCoupons();
  await seedPromotions();
  await seedReviews();
  const adminNote = await seedAdmin();
  const [p, v, c, pr] = await Promise.all([
    prisma.product.count(),
    prisma.productVariant.count(),
    prisma.category.count(),
    prisma.promotion.count(),
  ]);
  console.log(`🌱 Seeded ${p} products, ${v} variants, ${c} categories, ${pr} promotions in ${Date.now() - started} ms; ${adminNote}`);
}

main()
  .catch((err) => {
    console.error(err);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
