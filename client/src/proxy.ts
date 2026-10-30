import { NextResponse, type NextRequest } from "next/server";
import { getSessionCookie } from "better-auth/cookies";
import { PROXY_HEADER } from "@/lib/proxy-header";

/**
 * The browser only ever talks to this origin: /api/* and /uploads/* are forwarded to the Express
 * API with the shared secret it checks, so calls straight to the API host are refused. This lives
 * here rather than in next.config rewrites because those can't add request headers.
 */
function forwardToApi(request: NextRequest) {
  const target = new URL(request.nextUrl.pathname + request.nextUrl.search, process.env.API_URL ?? "http://localhost:4000");
  const headers = new Headers(request.headers);
  headers.delete("host"); // the API host routes by its own name
  headers.delete(PROXY_HEADER); // only we set this, never the browser
  const secret = process.env.PROXY_SECRET;
  if (secret) headers.set(PROXY_HEADER, secret);
  return NextResponse.rewrite(target, { request: { headers } });
}

/**
 * UX-only gate: visitors without a session cookie are sent to sign in before account, checkout,
 * order and admin pages. The API is the real enforcement point (every route checks the session).
 */
function requireSignIn(request: NextRequest) {
  // Guests keep a local wishlist, so that page stays open to them (it offers to sync on sign-in).
  if (request.nextUrl.pathname.startsWith("/account/wishlist")) return NextResponse.next();
  if (getSessionCookie(request, { cookiePrefix: "nst" })) return NextResponse.next();
  const login = new URL("/login", request.url);
  login.searchParams.set("next", request.nextUrl.pathname + request.nextUrl.search);
  return NextResponse.redirect(login);
}

export function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;
  if (pathname.startsWith("/api/") || pathname.startsWith("/uploads/")) return forwardToApi(request);
  return requireSignIn(request);
}

export const config = {
  matcher: ["/api/:path*", "/uploads/:path*", "/account/:path*", "/checkout", "/orders/:path*", "/admin/:path*"],
};
