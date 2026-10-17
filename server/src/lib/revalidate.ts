import { env } from "../config/env";

/** Revalidation requests made while testing (the storefront isn't running then). */
export const revalidateLog: string[][] = [];

/**
 * Asks the Next.js app to refresh cached storefront data after an admin change. Every catalog
 * cache carries the `catalog` tag. Fire-and-forget: an unreachable storefront never fails the
 * admin request (its caches expire on their own within minutes).
 */
export function revalidateStorefront(tags: string[] = ["catalog"]): void {
  if (env.NODE_ENV === "test") {
    revalidateLog.push(tags);
    return;
  }
  if (!env.REVALIDATE_SECRET) return;
  const base = env.CLIENT_INTERNAL_URL ?? env.CLIENT_ORIGIN;
  fetch(`${base}/revalidate`, {
    method: "POST",
    headers: { "content-type": "application/json", "x-revalidate-secret": env.REVALIDATE_SECRET },
    body: JSON.stringify({ tags }),
    signal: AbortSignal.timeout(5000),
  })
    .then((res) => {
      if (!res.ok) console.warn(`[revalidate] storefront answered ${res.status}`);
    })
    .catch((err: unknown) => console.warn("[revalidate] storefront unreachable:", err instanceof Error ? err.message : err));
}
