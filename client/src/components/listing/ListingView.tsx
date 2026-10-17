import Link from "next/link";
import type { ProductListResponse } from "@nestama/shared";
import { DogMascot } from "@/components/animations/DogMascot";
import { ListingShell } from "./ListingShell";
import { FilterPanel, type FilterPanelProps } from "./FilterPanel";
import { ActiveFilters, MobileFilters, Pagination, ProductGrid, SortSelect } from "./ListingControls";
import { ClearFiltersButton } from "./ClearFiltersButton";

interface Props {
  pathname: string;
  /** Current query string (without "?"). */
  search: string;
  data: ProductListResponse;
  hide?: FilterPanelProps["hide"];
}

/** Server-rendered listing body; the filter/sort/paging islands share URL state via ListingShell. */
export function ListingView({ pathname, search, data, hide }: Props) {
  const brandNames = Object.fromEntries(data.facets.brands.map((b) => [b.slug, b.name]));
  const from = data.total === 0 ? 0 : (data.page - 1) * data.pageSize + 1;
  const to = Math.min(data.total, data.page * data.pageSize);

  return (
    <ListingShell pathname={pathname} search={search}>
      <div className="grid gap-8 lg:grid-cols-[15.5rem_1fr]">
        <aside aria-label="Filters" className="hidden lg:block">
          <div className="sticky top-40 max-h-[calc(100dvh-11rem)] overflow-y-auto pr-2 pb-6">
            <FilterPanel facets={data.facets} hide={hide} />
          </div>
        </aside>

        <div className="min-w-0">
          <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
            <p className="text-sm text-muted" aria-live="polite">
              {data.total === 0 ? "No products" : `Showing ${from}–${to} of ${data.total} products`}
            </p>
            <div className="flex items-center gap-2">
              <MobileFilters facets={data.facets} hide={hide} total={data.total} />
              <SortSelect />
            </div>
          </div>
          <div className="mb-5">
            <ActiveFilters brandNames={brandNames} />
          </div>

          {data.total === 0 ? (
            <div className="grid place-items-center rounded-3xl bg-white px-6 py-16 text-center ring-1 ring-line">
              <DogMascot className="size-28" />
              <h2 className="mt-4 text-2xl font-extrabold">No products match those filters</h2>
              <p className="mt-2 max-w-sm text-muted">Try removing a filter or two — or browse everything we have.</p>
              <div className="mt-5 flex flex-wrap justify-center gap-3">
                <ClearFiltersButton />
                <Link
                  href="/shop"
                  className="inline-flex h-11 items-center rounded-full border-2 border-forest/80 px-5 font-bold text-forest hover:bg-forest hover:text-cream"
                >
                  Browse all products
                </Link>
              </div>
            </div>
          ) : (
            <>
              <ProductGrid products={data.items} />
              <Pagination page={data.page} totalPages={data.totalPages} />
            </>
          )}
        </div>
      </div>
    </ListingShell>
  );
}
