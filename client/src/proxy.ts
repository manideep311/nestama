import { NextResponse, type NextRequest } from "next/server";
import { getSessionCookie } from "better-auth/cookies";

/**
 * UX-only gate: visitors without a session cookie are sent to sign in before account, checkout,
 * order and admin pages. The API is the real enforcement point (every route checks the session).
 */
export function proxy(request: NextRequest) {
  // Guests keep a local wishlist, so that page stays open to them (it offers to sync on sign-in).
  if (request.nextUrl.pathname.startsWith("/account/wishlist")) return NextResponse.next();
  if (getSessionCookie(request, { cookiePrefix: "nst" })) return NextResponse.next();
  const login = new URL("/login", request.url);
  login.searchParams.set("next", request.nextUrl.pathname + request.nextUrl.search);
  return NextResponse.redirect(login);
}

export const config = {
  matcher: ["/account/:path*", "/checkout", "/orders/:path*", "/admin/:path*"],
};
