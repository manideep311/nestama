import { Router, type RequestHandler } from "express";
import multer from "multer";
import { z } from "zod";
import {
  adminProductInputSchema,
  brandInputSchema,
  categoryInputSchema,
  couponInputSchema,
  idParamSchema,
  ORDER_STATUSES,
  orderStatusUpdateSchema,
  promotionInputSchema,
  REPORT_RANGES,
  reviewStatusSchema,
  roleUpdateSchema,
  settingsInputSchema,
  stockUpdateSchema,
  type AdminProductData,
} from "@nestama/shared";
import { AppError } from "../../lib/errors";
import { validate } from "../../lib/validate";
import { revalidateStorefront } from "../../lib/revalidate";
import { currentUserId, requireRole } from "../auth/auth.middleware";
import { getAdminSettings, updateSettings, type AdminSettingsDTO } from "../settings/settings.service";
import { storeImage, uploadSingle } from "./uploads";
import * as products from "./products.service";
import * as taxonomy from "./taxonomy.service";
import * as promotions from "./promotions.service";
import * as orders from "./orders.service";
import * as people from "./people.service";
import * as stats from "./stats.service";

/**
 * Everything under /api/v1/admin. The role gate runs once here, so no admin route can be added
 * without it.
 */
export const adminRouter = Router();
adminRouter.use(requireRole("ADMIN"));

adminRouter.get("/settings", async (_req, res) => {
  res.json(await getAdminSettings());
});

adminRouter.put("/settings", validate({ body: settingsInputSchema }), async (_req, res) => {
  const settings = await updateSettings(res.locals.body as Omit<AdminSettingsDTO, "updatedAt">);
  revalidateStorefront();
  res.json(settings);
});

/** multer reports size and field problems as MulterError; turn them into friendly 400s. */
const parseUpload: RequestHandler = (req, res, next) => {
  uploadSingle(req, res, (err: unknown) => {
    if (err instanceof multer.MulterError) {
      return next(
        new AppError(
          err.code === "LIMIT_FILE_SIZE" ? "FILE_TOO_LARGE" : "UPLOAD_INVALID",
          400,
          err.code === "LIMIT_FILE_SIZE" ? "Images must be 5 MB or smaller." : "Upload one image at a time, in the “file” field.",
        ),
      );
    }
    next(err);
  });
};

adminRouter.post("/uploads", parseUpload, async (req, res) => {
  res.status(201).json(await storeImage(req.file));
});

// ───────── Catalog: products, categories, brands, inventory ─────────

export const productQuerySchema = z.object({
  q: z.string().trim().max(80).optional(),
  category: z.string().max(40).optional(),
  status: z.enum(["active", "inactive"]).optional(),
  stock: z.enum(["low", "out"]).optional(),
  sample: z.enum(["1", "0"]).optional(),
  page: z.coerce.number().int().min(1).max(1000).default(1),
});
export const activeSchema = z.object({ isActive: z.boolean() });
export const inventoryQuerySchema = z.object({ q: z.string().trim().max(80).optional(), low: z.enum(["1"]).optional() });

adminRouter.get("/products", validate({ query: productQuerySchema }), async (_req, res) => {
  res.json(await products.listAdminProducts(res.locals.query as products.AdminProductQuery));
});

adminRouter.get("/products/:id", validate({ params: idParamSchema }), async (_req, res) => {
  res.json(await products.getAdminProduct(res.locals.params.id as string));
});

adminRouter.post("/products", validate({ body: adminProductInputSchema }), async (_req, res) => {
  res.status(201).json(await products.createAdminProduct(res.locals.body as AdminProductData));
});

adminRouter.put("/products/:id", validate({ params: idParamSchema, body: adminProductInputSchema }), async (_req, res) => {
  res.json(await products.updateAdminProduct(res.locals.params.id as string, res.locals.body as AdminProductData));
});

adminRouter.patch("/products/:id/active", validate({ params: idParamSchema, body: activeSchema }), async (_req, res) => {
  res.json(await products.setProductActive(res.locals.params.id as string, (res.locals.body as { isActive: boolean }).isActive));
});

adminRouter.get("/categories", async (_req, res) => {
  res.json(await taxonomy.listAdminCategories());
});
adminRouter.post("/categories", validate({ body: categoryInputSchema }), async (_req, res) => {
  res.status(201).json(await taxonomy.createCategory(res.locals.body as taxonomy.CategoryData));
});
adminRouter.put("/categories/:id", validate({ params: idParamSchema, body: categoryInputSchema }), async (_req, res) => {
  res.json(await taxonomy.updateCategory(res.locals.params.id as string, res.locals.body as taxonomy.CategoryData));
});
adminRouter.delete("/categories/:id", validate({ params: idParamSchema }), async (_req, res) => {
  res.json(await taxonomy.deleteCategory(res.locals.params.id as string));
});

adminRouter.get("/brands", async (_req, res) => {
  res.json(await taxonomy.listAdminBrands());
});
adminRouter.post("/brands", validate({ body: brandInputSchema }), async (_req, res) => {
  res.status(201).json(await taxonomy.createBrand(res.locals.body as taxonomy.BrandData));
});
adminRouter.put("/brands/:id", validate({ params: idParamSchema, body: brandInputSchema }), async (_req, res) => {
  res.json(await taxonomy.updateBrand(res.locals.params.id as string, res.locals.body as taxonomy.BrandData));
});
adminRouter.delete("/brands/:id", validate({ params: idParamSchema }), async (_req, res) => {
  res.json(await taxonomy.deleteBrand(res.locals.params.id as string));
});

adminRouter.get("/inventory", validate({ query: inventoryQuerySchema }), async (_req, res) => {
  const q = res.locals.query as { q?: string; low?: "1" };
  res.json(await taxonomy.listInventory({ q: q.q, low: q.low === "1" }));
});
adminRouter.patch("/inventory", validate({ body: stockUpdateSchema }), async (_req, res) => {
  res.json(await taxonomy.updateStock((res.locals.body as { items: { variantId: string; stock: number }[] }).items));
});

// ───────── Promotions & coupons ─────────

adminRouter.get("/promotions", async (_req, res) => {
  res.json(await promotions.listPromotions());
});
adminRouter.post("/promotions", validate({ body: promotionInputSchema }), async (_req, res) => {
  res.status(201).json(await promotions.createPromotion(res.locals.body as promotions.PromotionData));
});
adminRouter.put("/promotions/:id", validate({ params: idParamSchema, body: promotionInputSchema }), async (_req, res) => {
  res.json(await promotions.updatePromotion(res.locals.params.id as string, res.locals.body as promotions.PromotionData));
});
adminRouter.delete("/promotions/:id", validate({ params: idParamSchema }), async (_req, res) => {
  res.json(await promotions.deletePromotion(res.locals.params.id as string));
});

adminRouter.get("/coupons", async (_req, res) => {
  res.json(await promotions.listCoupons());
});
adminRouter.post("/coupons", validate({ body: couponInputSchema }), async (_req, res) => {
  res.status(201).json(await promotions.createCoupon(res.locals.body as promotions.CouponData));
});
adminRouter.put("/coupons/:id", validate({ params: idParamSchema, body: couponInputSchema }), async (_req, res) => {
  res.json(await promotions.updateCoupon(res.locals.params.id as string, res.locals.body as promotions.CouponData));
});
adminRouter.delete("/coupons/:id", validate({ params: idParamSchema }), async (_req, res) => {
  res.json(await promotions.deleteCoupon(res.locals.params.id as string));
});

// ───────── Orders, customers, reviews ─────────

const pageSchema = z.coerce.number().int().min(1).max(1000).default(1);
export const orderQuerySchema = z.object({
  status: z.enum(ORDER_STATUSES).optional(),
  q: z.string().trim().max(80).optional(),
  page: pageSchema,
});
export const customerQuerySchema = z.object({
  role: z.enum(["CUSTOMER", "ADMIN"]).optional(),
  q: z.string().trim().max(80).optional(),
  page: pageSchema,
});
export const reviewQuerySchema = z.object({
  status: z.enum(["PUBLISHED", "HIDDEN"]).optional(),
  q: z.string().trim().max(80).optional(),
  page: pageSchema,
});

adminRouter.get("/orders", validate({ query: orderQuerySchema }), async (_req, res) => {
  res.json(await orders.listAdminOrders(res.locals.query as z.infer<typeof orderQuerySchema>));
});
adminRouter.get("/orders/:id", validate({ params: idParamSchema }), async (_req, res) => {
  res.json(await orders.getAdminOrder(res.locals.params.id as string));
});
adminRouter.patch("/orders/:id/status", validate({ params: idParamSchema, body: orderStatusUpdateSchema }), async (_req, res) => {
  const { status, note } = res.locals.body as z.infer<typeof orderStatusUpdateSchema>;
  res.json(await orders.updateOrderStatus(res.locals.params.id as string, status, note));
});

adminRouter.get("/customers", validate({ query: customerQuerySchema }), async (_req, res) => {
  res.json(await people.listCustomers(res.locals.query as z.infer<typeof customerQuerySchema>));
});
adminRouter.get("/customers/:id", validate({ params: idParamSchema }), async (_req, res) => {
  res.json(await people.getCustomer(res.locals.params.id as string));
});
adminRouter.patch("/customers/:id/role", validate({ params: idParamSchema, body: roleUpdateSchema }), async (_req, res) => {
  const { role } = res.locals.body as z.infer<typeof roleUpdateSchema>;
  res.json(await people.updateRole(currentUserId(res), res.locals.params.id as string, role));
});

adminRouter.get("/reviews", validate({ query: reviewQuerySchema }), async (_req, res) => {
  res.json(await people.listReviews(res.locals.query as z.infer<typeof reviewQuerySchema>));
});
adminRouter.patch("/reviews/:id/status", validate({ params: idParamSchema, body: reviewStatusSchema }), async (_req, res) => {
  res.json(await people.setReviewStatus(res.locals.params.id as string, (res.locals.body as z.infer<typeof reviewStatusSchema>).status));
});

// ───────── Stats & reports ─────────

adminRouter.get("/stats/overview", async (_req, res) => {
  res.json(await stats.getOverview());
});
export const reportQuerySchema = z.object({ range: z.enum(REPORT_RANGES).default("30d") });

adminRouter.get("/reports/sales", validate({ query: reportQuerySchema }), async (_req, res) => {
  res.json(await stats.getSalesReport((res.locals.query as { range: (typeof REPORT_RANGES)[number] }).range));
});
adminRouter.get("/reports/orders.csv", async (_req, res) => {
  const stamp = new Date().toISOString().slice(0, 10);
  res.setHeader("content-type", "text/csv; charset=utf-8");
  res.setHeader("content-disposition", `attachment; filename="nestama-orders-${stamp}.csv"`);
  // A byte-order mark so Excel opens the ₹ and non-ASCII names correctly.
  res.send(`﻿${await stats.ordersCsv()}`);
});
