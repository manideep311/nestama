/**
 * Where to send someone after signing in. Only same-site paths are allowed, so a crafted
 * `?next=https://evil.example` (or `//evil.example`, `/\evil.example`) can't redirect off-site.
 */
export function safeNext(next: string | null | undefined, fallback = "/account"): string {
  if (!next || !next.startsWith("/") || next.startsWith("//") || next.startsWith("/\\")) return fallback;
  if (/[\u0000-\u001f]/.test(next)) return fallback;
  if (next.startsWith("/login") || next.startsWith("/register")) return fallback;
  return next;
}

/** After signing in: the page that was asked for, otherwise the dashboard for admins and the account for customers. */
export function afterSignIn(requested: string | null | undefined, role: string | undefined): string {
  const home = role === "ADMIN" ? "/admin" : "/account";
  return requested ? safeNext(requested, home) : home;
}
