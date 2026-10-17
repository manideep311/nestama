import { z } from "./zod";

/** India's 28 states and 8 union territories, as shown in the address form. */
export const INDIAN_STATES = [
  "Andaman and Nicobar Islands",
  "Andhra Pradesh",
  "Arunachal Pradesh",
  "Assam",
  "Bihar",
  "Chandigarh",
  "Chhattisgarh",
  "Dadra and Nagar Haveli and Daman and Diu",
  "Delhi",
  "Goa",
  "Gujarat",
  "Haryana",
  "Himachal Pradesh",
  "Jammu and Kashmir",
  "Jharkhand",
  "Karnataka",
  "Kerala",
  "Ladakh",
  "Lakshadweep",
  "Madhya Pradesh",
  "Maharashtra",
  "Manipur",
  "Meghalaya",
  "Mizoram",
  "Nagaland",
  "Odisha",
  "Puducherry",
  "Punjab",
  "Rajasthan",
  "Sikkim",
  "Tamil Nadu",
  "Telangana",
  "Tripura",
  "Uttar Pradesh",
  "Uttarakhand",
  "West Bengal",
] as const;
export type IndianState = (typeof INDIAN_STATES)[number];

export const MAX_ADDRESSES = 10;

/** Optional free text: trimmed, and blank becomes undefined. */
const optionalText = (max: number) =>
  z
    .string()
    .trim()
    .max(max)
    .optional()
    .transform((v) => (v ? v : undefined));

/** Indian mobile number: accepts spaces, dashes and a +91 / 91 / 0 prefix; stored as 10 digits. */
export const mobileSchema = z
  .string()
  .trim()
  .transform((raw) => {
    let s = raw.replace(/[\s-]/g, "");
    if (s.startsWith("+91")) s = s.slice(3);
    else if (s.length === 12 && s.startsWith("91")) s = s.slice(2);
    else if (s.length === 11 && s.startsWith("0")) s = s.slice(1);
    return s;
  })
  .pipe(z.string().regex(/^[6-9]\d{9}$/, "Enter a 10-digit Indian mobile number"));

export const pincodeSchema = z
  .string()
  .trim()
  .regex(/^[1-9]\d{5}$/, "Enter a valid 6-digit pincode");

export const addressInputSchema = z.object({
  fullName: z.string().trim().min(2, "Enter the recipient's name").max(80),
  phone: mobileSchema,
  line1: z.string().trim().min(3, "Enter the house number and street").max(120),
  line2: optionalText(120),
  landmark: optionalText(80),
  city: z.string().trim().min(2, "Enter the city").max(60),
  state: z.enum(INDIAN_STATES, { error: "Choose a state" }),
  pincode: pincodeSchema,
  isDefault: z.boolean().default(false),
});
export type AddressInput = z.input<typeof addressInputSchema>;
export type AddressData = z.output<typeof addressInputSchema>;

export interface AddressDTO {
  id: string;
  fullName: string;
  phone: string;
  line1: string;
  line2: string | null;
  landmark: string | null;
  city: string;
  state: string;
  pincode: string;
  isDefault: boolean;
}

/** The address as frozen onto an order. */
export type AddressSnapshot = Omit<AddressDTO, "id" | "isDefault">;

export const profileUpdateSchema = z.object({
  name: z.string().trim().min(2, "Enter your name").max(60),
  phone: z
    .union([mobileSchema, z.literal("")])
    .optional()
    .transform((v) => (v ? v : undefined)),
});
export type ProfileUpdateInput = z.input<typeof profileUpdateSchema>;

export const reviewInputSchema = z.object({
  rating: z.number().int().min(1, "Choose a rating").max(5),
  title: z.string().trim().min(3, "Give your review a short title").max(80),
  body: z.string().trim().min(10, "Tell other pet parents a little more (10+ characters)").max(1000),
});
export type ReviewInput = z.input<typeof reviewInputSchema>;

export const MAX_WISHLIST_ITEMS = 200;

export const wishlistSyncSchema = z.object({
  productIds: z
    .array(z.string().min(1).max(40))
    .max(MAX_WISHLIST_ITEMS)
    .transform((ids) => [...new Set(ids)]),
});

export const wishlistItemSchema = z.object({ productId: z.string().min(1).max(40) });

export interface WishlistDTO {
  productIds: string[];
}
