"use client";

import { createAuthClient } from "better-auth/react";
import { inferAdditionalFields } from "better-auth/client/plugins";

// Better Auth runs inside the Express API; the browser reaches it same-origin at /api/auth
// through the Next.js rewrite, so session cookies stay first-party.
export const authClient = createAuthClient({
  baseURL: typeof window === "undefined" ? (process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000") : window.location.origin,
  plugins: [
    inferAdditionalFields({
      user: {
        role: { type: "string", input: false },
        phone: { type: "string", required: false },
      },
    }),
  ],
});

export const { useSession } = authClient;

/**
 * Signing in or out changes what every protected page returns, but the router keeps routes it
 * prefetched under the old session (a guest's /checkout prefetch is a redirect to /login). A full
 * page load after the change starts from a clean slate, so those stale entries are never reused.
 */
export function reloadTo(path: string) {
  window.location.replace(path);
}

/** Signs out and leaves for the home page, so no signed-in screen lingers in a broken state. */
export async function signOutAndLeave() {
  await authClient.signOut();
  reloadTo("/");
}

/** Friendly copy for Better Auth error codes (falls back to the server's own message). */
export function authErrorMessage(error: { code?: string; message?: string; status?: number } | null | undefined): string {
  if (!error) return "Something went wrong. Please try again.";
  if (error.status === 429) return "Too many attempts. Please wait a minute and try again.";
  switch (error.code) {
    case "INVALID_EMAIL_OR_PASSWORD":
      return "That email and password don’t match. Try again, or reset your password.";
    case "USER_ALREADY_EXISTS":
    case "USER_ALREADY_EXISTS_USE_ANOTHER_EMAIL":
      return "An account with this email already exists. Sign in instead?";
    case "PASSWORD_TOO_SHORT":
      return "Use at least 8 characters for your password.";
    case "PASSWORD_TOO_LONG":
      return "That password is too long (128 characters at most).";
    case "INVALID_EMAIL":
      return "Enter a valid email address.";
    case "INVALID_TOKEN":
      return "This reset link is invalid or has expired. Request a new one.";
    case "INVALID_PASSWORD":
      return "Your current password isn’t right.";
    default:
      return error.message || "Something went wrong. Please try again.";
  }
}
