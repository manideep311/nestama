"use client";

import { createContext, useCallback, useContext, useMemo, useTransition, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import { hrefWith, type ListingPatch } from "@/lib/listing-url";

interface ListingContext {
  pathname: string;
  params: URLSearchParams;
  isPending: boolean;
  /** Apply a patch to the URL (resets page unless paging) as a transition. */
  update(patch: ListingPatch): void;
  hrefFor(patch: ListingPatch): string;
}

const Ctx = createContext<ListingContext | null>(null);

/**
 * Shares the listing URL state with the filter/sort/paging islands. Changes are router
 * transitions, so the current grid stays visible (dimmed) until the new one is ready.
 */
export function ListingShell({ pathname, search, children }: { pathname: string; search: string; children: ReactNode }) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const params = useMemo(() => new URLSearchParams(search), [search]);

  const hrefFor = useCallback((patch: ListingPatch) => hrefWith(pathname, params, patch), [pathname, params]);
  const update = useCallback(
    (patch: ListingPatch) => {
      startTransition(() => router.push(hrefFor(patch), { scroll: false }));
    },
    [router, hrefFor],
  );

  const value = useMemo(() => ({ pathname, params, isPending, update, hrefFor }), [pathname, params, isPending, update, hrefFor]);
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useListing(): ListingContext {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error("useListing must be used inside <ListingShell>");
  return ctx;
}
