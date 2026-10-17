import type { ReactNode } from "react";
import type { ProductListResponse } from "@nestama/shared";
import { getListing } from "@/lib/catalog";
import { apiQueryString, type ListingPatch } from "@/lib/listing-url";
import { ButtonLink } from "@/components/ui/Button";
import { ListingView } from "./ListingView";
import type { FilterPanelProps } from "./FilterPanel";

type SearchParams = Promise<Record<string, string | string[] | undefined>>;

interface Props {
  searchParams: SearchParams;
  pathname: string;
  /** Values fixed by the route (e.g. the category of /c/[slug]); not shown in the URL. */
  fixed?: ListingPatch;
  hide?: FilterPanelProps["hide"];
  /** Optional heading that depends on the query (e.g. "Results for …"). */
  heading?: (params: Record<string, string | string[] | undefined>, data: ProductListResponse) => ReactNode;
}

/** Reads the URL (runtime data — keep inside <Suspense>), fetches the cached listing and renders it. */
export async function ListingResults({ searchParams, pathname, fixed = {}, hide, heading }: Props) {
  const params = await searchParams;
  const search = apiQueryString(params);

  let data: ProductListResponse;
  try {
    data = await getListing(apiQueryString(params, fixed));
  } catch (err) {
    console.error("[listing] failed:", err);
    return (
      <div className="rounded-3xl bg-white px-6 py-14 text-center ring-1 ring-line">
        <h2 className="text-2xl font-extrabold">We couldn&apos;t load these products</h2>
        <p className="mt-2 text-muted">Something went wrong on our side. Please try again in a moment.</p>
        <ButtonLink href={`${pathname}${search ? `?${search}` : ""}`} className="mt-5">
          Try again
        </ButtonLink>
      </div>
    );
  }

  return (
    <>
      {heading?.(params, data)}
      <ListingView pathname={pathname} search={search} data={data} hide={hide} />
    </>
  );
}
