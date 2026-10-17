import { timingSafeEqual } from "node:crypto";
import { revalidateTag } from "next/cache";

// Called by the API after admin changes so cached storefront pages refresh straight away.
// Protected by a shared secret (REVALIDATE_SECRET in both apps).

function sameSecret(given: string, expected: string): boolean {
  const a = Buffer.from(given);
  const b = Buffer.from(expected);
  return a.length === b.length && timingSafeEqual(a, b);
}

export async function POST(request: Request) {
  const secret = process.env.REVALIDATE_SECRET;
  if (!secret || !sameSecret(request.headers.get("x-revalidate-secret") ?? "", secret)) {
    return Response.json({ ok: false }, { status: 401 });
  }

  const body = (await request.json().catch(() => ({}))) as { tags?: unknown };
  const tags = Array.isArray(body.tags)
    ? body.tags.filter((t): t is string => typeof t === "string" && /^[a-z0-9-]{1,64}$/.test(t)).slice(0, 20)
    : [];
  const toRevalidate = tags.length > 0 ? tags : ["catalog"];

  // expire: 0 — the next visitor gets fresh data rather than one stale view first.
  for (const tag of toRevalidate) revalidateTag(tag, { expire: 0 });
  return Response.json({ ok: true, revalidated: toRevalidate });
}
