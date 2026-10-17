import { z } from "./zod";
import type { ImageDTO, StockStatus } from "./catalog";

export interface CartLineDTO {
  id: string;
  variantId: string;
  productId: string;
  slug: string;
  name: string;
  brand: string;
  variantLabel: string;
  image: ImageDTO;
  quantity: number;
  /** Most the shopper can hold of this line (stock, capped at 20). */
  maxQuantity: number;
  unitPrice: number;
  originalUnitPrice: number;
  lineTotal: number;
  stock: StockStatus;
}

export interface CartSummaryDTO {
  itemCount: number;
  subtotal: number;
  promoSavings: number;
  couponCode: string | null;
  couponDiscount: number;
  /** Why the stored coupon isn't discounting right now (e.g. "Add ₹200 more to use NESTAMA20."). */
  couponNotice: string | null;
  shipping: number;
  freeShippingThreshold: number;
  amountToFreeShipping: number;
  total: number;
  gstIncluded: number;
  gstRatePercent: number;
}

export interface CartDTO {
  id: string | null;
  lines: CartLineDTO[];
  summary: CartSummaryDTO;
}

export const MAX_LINE_QUANTITY = 20;

export const addCartItemSchema = z.object({
  variantId: z.string().trim().min(1).max(40),
  quantity: z.coerce.number().int().min(1).max(MAX_LINE_QUANTITY).default(1),
});
export type AddCartItemInput = z.infer<typeof addCartItemSchema>;

export const updateCartItemSchema = z.object({
  quantity: z.coerce.number().int().min(0).max(MAX_LINE_QUANTITY),
});
export type UpdateCartItemInput = z.infer<typeof updateCartItemSchema>;

export const applyCouponSchema = z.object({
  code: z
    .string()
    .trim()
    .min(2, "Enter a coupon code")
    .max(32)
    .transform((s) => s.toUpperCase()),
});
export type ApplyCouponInput = z.infer<typeof applyCouponSchema>;

export const idParamSchema = z.object({ id: z.string().trim().min(1).max(40) });
