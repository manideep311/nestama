import { betterAuth } from "better-auth";
import { prismaAdapter } from "better-auth/adapters/prisma";
import { APIError, createAuthMiddleware } from "better-auth/api";
import { mobileSchema } from "@nestama/shared";
import { env } from "../config/env";
import { prisma } from "./prisma";
import { passwordResetMail, sendMail } from "./mailer";

/** Validates and normalises the profile fields Better Auth accepts on sign-up and update-user. */
const validateProfile = createAuthMiddleware(async (ctx) => {
  if (ctx.path !== "/sign-up/email" && ctx.path !== "/update-user") return;
  const body: Record<string, unknown> = { ...(ctx.body as Record<string, unknown>) };

  if (typeof body.name === "string") {
    const name = body.name.trim().replace(/\s+/g, " ");
    if (name.length < 2 || name.length > 60) throw new APIError("BAD_REQUEST", { message: "Enter your name (2–60 characters)." });
    body.name = name;
  }
  if (body.phone !== undefined && body.phone !== null) {
    if (body.phone === "") body.phone = null;
    else {
      const phone = mobileSchema.safeParse(body.phone);
      if (!phone.success) throw new APIError("BAD_REQUEST", { message: "Enter a 10-digit Indian mobile number." });
      body.phone = phone.data;
    }
  }
  return { context: { ...ctx, body } };
});

export const auth = betterAuth({
  appName: "NESTAMA",
  baseURL: env.BETTER_AUTH_URL,
  basePath: "/api/auth",
  secret: env.BETTER_AUTH_SECRET,
  trustedOrigins: [env.CLIENT_ORIGIN],
  database: prismaAdapter(prisma, { provider: "postgresql" }),
  emailAndPassword: {
    enabled: true,
    minPasswordLength: 8,
    maxPasswordLength: 128,
    autoSignIn: true,
    resetPasswordTokenExpiresIn: 60 * 60,
    revokeSessionsOnPasswordReset: true,
    sendResetPassword: async ({ user, url }) => {
      await sendMail(passwordResetMail(user.email, user.name, url));
    },
  },
  user: {
    additionalFields: {
      role: { type: "string", required: false, defaultValue: "CUSTOMER", input: false },
      phone: { type: "string", required: false, input: true },
    },
  },
  // A signed cookie caches the session for a minute, so most API calls skip the session lookup.
  session: { cookieCache: { enabled: true, maxAge: 60 } },
  // Express rate-limits auth POSTs (see app.ts); Better Auth's own limiter stays off.
  rateLimit: { enabled: false },
  // Secure cookies whenever we run in production, whatever the URL looks like behind proxies.
  // Origin and redirect checks stay on everywhere: Better Auth would skip them under test by
  // default, and the tests should see what production does.
  advanced: { cookiePrefix: "nst", useSecureCookies: env.NODE_ENV === "production", disableOriginCheck: false },
  hooks: { before: validateProfile },
});
