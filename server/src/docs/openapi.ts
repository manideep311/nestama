import { z } from "zod";
import {
  addCartItemSchema,
  addressInputSchema,
  adminProductInputSchema,
  applyCouponSchema,
  authorizePaymentSchema,
  brandInputSchema,
  categoryInputSchema,
  checkoutSchema,
  couponInputSchema,
  idParamSchema,
  newsletterSchema,
  petInputSchema,
  orderStatusUpdateSchema,
  productListQuerySchema,
  promotionInputSchema,
  reviewInputSchema,
  reviewStatusSchema,
  roleUpdateSchema,
  searchQuerySchema,
  settingsInputSchema,
  slugParamSchema,
  stockUpdateSchema,
  updateCartItemSchema,
  verifyPaymentSchema,
  wishlistItemSchema,
  wishlistSyncSchema,
} from "@nestama/shared";
import { pageQuerySchema } from "../modules/account/account.routes";
import {
  activeSchema,
  customerQuerySchema,
  inventoryQuerySchema,
  orderQuerySchema,
  productQuerySchema,
  reportQuerySchema,
  reviewQuerySchema,
} from "../modules/admin/admin.routes";
import { idsQuerySchema, pincodeQuerySchema, reviewsQuerySchema } from "../modules/catalog/catalog.routes";
import { productParamSchema } from "../modules/wishlist/wishlist.routes";

type Method = "get" | "post" | "put" | "patch" | "delete";
type Auth = "public" | "user" | "admin";

export interface ApiRoute {
  method: Method;
  /** Express-style path, e.g. `/api/v1/products/:slug`. */
  path: string;
  tag: string;
  summary: string;
  auth: Auth;
  params?: z.ZodType;
  query?: z.ZodType;
  body?: z.ZodType;
  /** Non-JSON payloads. */
  upload?: true;
  csv?: true;
  /** Rate-limited routes document their 429. */
  limited?: true;
  /** Answers 201 Created rather than 200. */
  created?: true;
}

// Better Auth's own request bodies (it validates them itself; these are for the docs only).
const email = z.email();
const password = z.string().min(8);
const authBodies = {
  signUp: z.object({ name: z.string().min(2), email, password, phone: z.string().optional() }),
  signIn: z.object({ email, password, rememberMe: z.boolean().optional() }),
  requestReset: z.object({ email, redirectTo: z.string().optional() }),
  reset: z.object({ newPassword: password, token: z.string() }),
  changePassword: z.object({ currentPassword: z.string(), newPassword: password, revokeOtherSessions: z.boolean().optional() }),
  updateUser: z.object({ name: z.string().min(2).optional(), phone: z.string().optional() }),
};

const v1 = (path: string) => `/api/v1${path}`;
const route = (method: Method, path: string, tag: string, summary: string, auth: Auth, extra: Partial<ApiRoute> = {}): ApiRoute => ({
  method,
  path,
  tag,
  summary,
  auth,
  ...extra,
});

/** Every public endpoint. `test/openapi.int.test.ts` fails if this drifts from the routers. */
export const ROUTES: ApiRoute[] = [
  route("get", v1("/health"), "System", "Health check (pings the database)", "public"),

  // Auth (Better Auth, mounted at /api/auth)
  route("post", "/api/auth/sign-up/email", "Auth", "Create an account", "public", { body: authBodies.signUp, limited: true }),
  route("post", "/api/auth/sign-in/email", "Auth", "Sign in", "public", { body: authBodies.signIn, limited: true }),
  route("post", "/api/auth/sign-out", "Auth", "Sign out", "user"),
  route("get", "/api/auth/get-session", "Auth", "Current session and user (null when signed out)", "public"),
  route("post", "/api/auth/request-password-reset", "Auth", "Email a password reset link", "public", {
    body: authBodies.requestReset,
    limited: true,
  }),
  route("post", "/api/auth/reset-password", "Auth", "Set a new password with a reset token", "public", {
    body: authBodies.reset,
    limited: true,
  }),
  route("post", "/api/auth/change-password", "Auth", "Change the password while signed in", "user", {
    body: authBodies.changePassword,
    limited: true,
  }),
  route("post", "/api/auth/update-user", "Auth", "Update name or phone", "user", { body: authBodies.updateUser, limited: true }),

  // Storefront content
  route("get", v1("/home"), "Storefront", "Homepage data: hero, categories, promotions, product rows", "public"),
  route("get", v1("/settings/public"), "Storefront", "Public store settings (shipping threshold, contacts, searches)", "public"),
  route("get", v1("/promotions/active"), "Storefront", "Live promotions", "public"),
  route("post", v1("/newsletter"), "Storefront", "Subscribe to the newsletter (200 if already subscribed)", "public", {
    body: newsletterSchema,
    limited: true,
    created: true,
  }),

  // Catalogue
  route("get", v1("/products"), "Catalogue", "List products with filters, facet counts and pagination", "public", {
    query: productListQuerySchema,
  }),
  route("get", v1("/products/by-ids"), "Catalogue", "Product cards by id (recently viewed, wishlist)", "public", { query: idsQuerySchema }),
  route("get", v1("/products/:slug"), "Catalogue", "Product detail with variants and live pricing", "public", { params: slugParamSchema }),
  route("get", v1("/products/:slug/related"), "Catalogue", "Related products", "public", { params: slugParamSchema }),
  route("get", v1("/categories"), "Catalogue", "Category tree", "public"),
  route("get", v1("/categories/:slug"), "Catalogue", "One category", "public", { params: slugParamSchema }),
  route("get", v1("/search"), "Catalogue", "Search suggestions: top products and matching categories", "public", {
    query: searchQuerySchema,
    limited: true,
  }),
  route("get", v1("/delivery-estimate"), "Catalogue", "Delivery estimate for a pincode", "public", { query: pincodeQuerySchema }),
  route("get", v1("/products/:slug/reviews"), "Reviews", "Published reviews, newest first", "public", {
    params: slugParamSchema,
    query: reviewsQuerySchema,
  }),
  route("get", v1("/products/:slug/reviews/mine"), "Reviews", "Your review of this product, if any", "user", { params: slugParamSchema }),
  route("post", v1("/products/:slug/reviews"), "Reviews", "Write or update your review", "user", {
    params: slugParamSchema,
    body: reviewInputSchema,
    limited: true,
  }),

  // Cart (guest cookie or signed-in user)
  route("get", v1("/cart"), "Cart", "The cart with a server-computed summary", "public"),
  route("post", v1("/cart/items"), "Cart", "Add a product option", "public", { body: addCartItemSchema, created: true }),
  route("patch", v1("/cart/items/:id"), "Cart", "Change a line's quantity", "public", {
    params: idParamSchema,
    body: updateCartItemSchema,
  }),
  route("delete", v1("/cart/items/:id"), "Cart", "Remove a line", "public", { params: idParamSchema }),
  route("post", v1("/cart/coupon"), "Cart", "Apply a coupon code", "public", { body: applyCouponSchema }),
  route("delete", v1("/cart/coupon"), "Cart", "Remove the coupon", "public"),

  // Account
  route("get", v1("/account/addresses"), "Account", "Your saved addresses", "user"),
  route("post", v1("/account/addresses"), "Account", "Add an address", "user", { body: addressInputSchema, created: true }),
  route("patch", v1("/account/addresses/:id"), "Account", "Edit an address", "user", { params: idParamSchema, body: addressInputSchema }),
  route("delete", v1("/account/addresses/:id"), "Account", "Delete an address", "user", { params: idParamSchema }),
  route("get", v1("/account/orders"), "Account", "Your orders, newest first", "user", { query: pageQuerySchema }),
  route("get", v1("/orders/:id"), "Account", "One of your orders, with its timeline", "user", { params: idParamSchema }),
  route("get", v1("/wishlist"), "Wishlist", "Your wishlist", "user"),
  route("post", v1("/wishlist"), "Wishlist", "Add a product", "user", { body: wishlistItemSchema, created: true }),
  route("delete", v1("/wishlist/:productId"), "Wishlist", "Remove a product", "user", { params: productParamSchema }),
  route("post", v1("/wishlist/sync"), "Wishlist", "Merge a guest wishlist after sign-in", "user", { body: wishlistSyncSchema }),
  route("get", v1("/account/pets"), "Pets", "Your pets, oldest first, with age and life stage", "user"),
  route("post", v1("/account/pets"), "Pets", "Add a pet (birthday, or an approximate age); up to 5", "user", {
    body: petInputSchema,
    created: true,
  }),
  route("patch", v1("/account/pets/:id"), "Pets", "Edit a pet", "user", { params: idParamSchema, body: petInputSchema }),
  route("delete", v1("/account/pets/:id"), "Pets", "Remove a pet", "user", { params: idParamSchema }),
  route("get", v1("/account/pets/:id/recommendations"), "Pets", "Up to 8 product picks for this pet, each with a reason", "user", {
    params: idParamSchema,
  }),

  // Checkout and the NestaPay demo gateway
  route("post", v1("/checkout/orders"), "Checkout", "Re-price the cart, reserve stock and create a pending order", "user", {
    body: checkoutSchema,
    limited: true,
    created: true,
  }),
  route("post", v1("/payments/demo/authorize"), "Checkout", "NestaPay demo: authorize a payment (no real money)", "user", {
    body: authorizePaymentSchema,
    limited: true,
  }),
  route("post", v1("/payments/verify"), "Checkout", "Verify the HMAC signature and confirm the order", "user", {
    body: verifyPaymentSchema,
    limited: true,
  }),

  // Admin
  route("get", v1("/admin/stats/overview"), "Admin: reports", "Dashboard KPIs, revenue by day, top products, low stock", "admin"),
  route("get", v1("/admin/reports/sales"), "Admin: reports", "Sales report by day or week", "admin", { query: reportQuerySchema }),
  route("get", v1("/admin/reports/orders.csv"), "Admin: reports", "All orders as CSV", "admin", { csv: true }),
  route("get", v1("/admin/settings"), "Admin: store", "Store settings", "admin"),
  route("put", v1("/admin/settings"), "Admin: store", "Update store settings", "admin", { body: settingsInputSchema }),
  route("post", v1("/admin/uploads"), "Admin: store", "Upload an image (JPEG, PNG, WebP or AVIF, up to 5 MB)", "admin", {
    upload: true,
    created: true,
  }),
  route("get", v1("/admin/products"), "Admin: catalogue", "Products with search and filters", "admin", { query: productQuerySchema }),
  route("get", v1("/admin/products/:id"), "Admin: catalogue", "One product for editing", "admin", { params: idParamSchema }),
  route("post", v1("/admin/products"), "Admin: catalogue", "Create a product", "admin", { body: adminProductInputSchema, created: true }),
  route("put", v1("/admin/products/:id"), "Admin: catalogue", "Replace a product's details, options and photos", "admin", {
    params: idParamSchema,
    body: adminProductInputSchema,
  }),
  route("patch", v1("/admin/products/:id/active"), "Admin: catalogue", "Show or hide a product", "admin", {
    params: idParamSchema,
    body: activeSchema,
  }),
  route("get", v1("/admin/categories"), "Admin: catalogue", "Categories with product counts", "admin"),
  route("post", v1("/admin/categories"), "Admin: catalogue", "Create a category", "admin", { body: categoryInputSchema, created: true }),
  route("put", v1("/admin/categories/:id"), "Admin: catalogue", "Update a category", "admin", {
    params: idParamSchema,
    body: categoryInputSchema,
  }),
  route("delete", v1("/admin/categories/:id"), "Admin: catalogue", "Delete an unused category", "admin", { params: idParamSchema }),
  route("get", v1("/admin/brands"), "Admin: catalogue", "Brands with product counts", "admin"),
  route("post", v1("/admin/brands"), "Admin: catalogue", "Create a brand", "admin", { body: brandInputSchema, created: true }),
  route("put", v1("/admin/brands/:id"), "Admin: catalogue", "Update a brand", "admin", { params: idParamSchema, body: brandInputSchema }),
  route("delete", v1("/admin/brands/:id"), "Admin: catalogue", "Delete an unused brand", "admin", { params: idParamSchema }),
  route("get", v1("/admin/inventory"), "Admin: catalogue", "Stock for every product option", "admin", { query: inventoryQuerySchema }),
  route("patch", v1("/admin/inventory"), "Admin: catalogue", "Set stock for several options at once", "admin", { body: stockUpdateSchema }),
  route("post", v1("/admin/demo/reset"), "Admin: catalogue", "Reset the live demo: restore stock and renew seeded deals", "admin"),
  route("get", v1("/admin/promotions"), "Admin: marketing", "Promotions with their schedule status", "admin"),
  route("post", v1("/admin/promotions"), "Admin: marketing", "Create a promotion", "admin", { body: promotionInputSchema, created: true }),
  route("put", v1("/admin/promotions/:id"), "Admin: marketing", "Update a promotion", "admin", {
    params: idParamSchema,
    body: promotionInputSchema,
  }),
  route("delete", v1("/admin/promotions/:id"), "Admin: marketing", "Delete a promotion", "admin", { params: idParamSchema }),
  route("get", v1("/admin/coupons"), "Admin: marketing", "Coupons with usage", "admin"),
  route("post", v1("/admin/coupons"), "Admin: marketing", "Create a coupon", "admin", { body: couponInputSchema, created: true }),
  route("put", v1("/admin/coupons/:id"), "Admin: marketing", "Update a coupon", "admin", {
    params: idParamSchema,
    body: couponInputSchema,
  }),
  route("delete", v1("/admin/coupons/:id"), "Admin: marketing", "Delete an unused coupon", "admin", { params: idParamSchema }),
  route("get", v1("/admin/orders"), "Admin: sales", "Orders with status filter and search", "admin", { query: orderQuerySchema }),
  route("get", v1("/admin/orders/:id"), "Admin: sales", "Order detail with the next allowed step", "admin", { params: idParamSchema }),
  route("patch", v1("/admin/orders/:id/status"), "Admin: sales", "Advance or cancel an order", "admin", {
    params: idParamSchema,
    body: orderStatusUpdateSchema,
  }),
  route("get", v1("/admin/customers"), "Admin: sales", "Customers with paid orders and spend", "admin", { query: customerQuerySchema }),
  route("get", v1("/admin/customers/:id"), "Admin: sales", "Customer detail with orders", "admin", { params: idParamSchema }),
  route("patch", v1("/admin/customers/:id/role"), "Admin: sales", "Grant or remove admin access", "admin", {
    params: idParamSchema,
    body: roleUpdateSchema,
  }),
  route("get", v1("/admin/reviews"), "Admin: sales", "Reviews for moderation", "admin", { query: reviewQuerySchema }),
  route("patch", v1("/admin/reviews/:id/status"), "Admin: sales", "Hide or publish a review", "admin", {
    params: idParamSchema,
    body: reviewStatusSchema,
  }),
];

type JsonSchema = { type?: string; properties?: Record<string, JsonSchema>; required?: string[]; [key: string]: unknown };

function jsonSchema(schema: z.ZodType): JsonSchema {
  const { $schema: _drop, ...rest } = z.toJSONSchema(schema, { io: "input", unrepresentable: "any" }) as JsonSchema & { $schema?: string };
  return rest;
}

function parameters(schema: z.ZodType | undefined, location: "path" | "query") {
  if (!schema) return [];
  const s = jsonSchema(schema);
  return Object.entries(s.properties ?? {}).map(([name, prop]) => ({
    name,
    in: location,
    required: location === "path" || (s.required ?? []).includes(name),
    schema: prop,
  }));
}

const errorRef = { content: { "application/json": { schema: { $ref: "#/components/schemas/Error" } } } };

function operation(r: ApiRoute) {
  const responses: Record<string, unknown> = {
    [r.created ? "201" : "200"]: r.csv
      ? { description: "CSV file", content: { "text/csv": { schema: { type: "string" } } } }
      : { description: "Success. Response types live in `@nestama/shared` (TypeScript)." },
  };
  if (r.params || r.query || r.body || r.upload) responses["400"] = { description: "Validation failed", ...errorRef };
  if (r.auth !== "public") responses["401"] = { description: "Not signed in", ...errorRef };
  if (r.auth === "admin") responses["403"] = { description: "Not an admin", ...errorRef };
  if (r.params) responses["404"] = { description: "Not found", ...errorRef };
  if (r.limited) responses["429"] = { description: "Rate limited", ...errorRef };

  const op: Record<string, unknown> = {
    tags: [r.tag],
    summary: r.summary,
    operationId: `${r.method}${r.path.replace(/^\/api(\/v1)?/, "").replace(/[/:.-]+(\w)?/g, (_m, c: string | undefined) => (c ? c.toUpperCase() : ""))}`,
    parameters: [...parameters(r.params, "path"), ...parameters(r.query, "query")],
    responses,
  };
  if (r.body) op.requestBody = { required: true, content: { "application/json": { schema: jsonSchema(r.body) } } };
  if (r.upload) {
    op.requestBody = {
      required: true,
      content: {
        "multipart/form-data": {
          schema: { type: "object", required: ["file"], properties: { file: { type: "string", format: "binary" } } },
        },
      },
    };
  }
  if (r.auth !== "public") op.security = [{ session: [] }];
  return op;
}

/** OpenAPI 3.1 for the whole API, generated from the same Zod schemas the routes validate with. */
export function buildOpenApi(): object {
  const paths: Record<string, Record<string, unknown>> = {};
  for (const r of ROUTES) {
    const key = r.path.replace(/:(\w+)/g, "{$1}");
    (paths[key] ??= {})[r.method] = operation(r);
  }
  return {
    openapi: "3.1.0",
    info: {
      title: "NESTAMA API",
      version: "1.0.0",
      description: [
        "REST API behind the NESTAMA pet store (a portfolio project). Money is integer **paise**; timestamps are UTC ISO strings.",
        "",
        "- The browser reaches the API through the storefront's own origin (`/api/*` is proxied), so session cookies are first-party.",
        "- Signed-in routes use Better Auth's session cookie (`nst.session_token`, `__Secure-` prefixed in production).",
        "- Writes from another site's `Origin` are refused with `403 FORBIDDEN_ORIGIN`.",
        "- Payments use **NestaPay**, a demo gateway: no real money moves and no card data is sent.",
      ].join("\n"),
    },
    servers: [{ url: "/", description: "This origin" }],
    tags: [
      { name: "Auth", description: "Better Auth endpoints (only those the store uses). See https://www.better-auth.com/docs" },
      { name: "Storefront" },
      { name: "Catalogue" },
      { name: "Reviews" },
      { name: "Cart" },
      { name: "Account" },
      { name: "Wishlist" },
      { name: "Pets" },
      { name: "Checkout" },
      { name: "Admin: reports" },
      { name: "Admin: catalogue" },
      { name: "Admin: marketing" },
      { name: "Admin: sales" },
      { name: "Admin: store" },
      { name: "System" },
    ],
    paths,
    components: {
      securitySchemes: { session: { type: "apiKey", in: "cookie", name: "nst.session_token" } },
      schemas: {
        Error: {
          type: "object",
          required: ["error"],
          properties: {
            error: {
              type: "object",
              required: ["code", "message"],
              properties: { code: { type: "string", examples: ["VALIDATION_ERROR"] }, message: { type: "string" }, details: {} },
            },
          },
        },
      },
    },
  };
}
