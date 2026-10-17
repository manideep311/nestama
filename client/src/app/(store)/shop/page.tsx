import { Suspense } from "react";
import type { Metadata } from "next";
import { PageTransition } from "@/components/layout/PageTransition";
import { ListingResults } from "@/components/listing/ListingResults";
import { ListingSkeleton } from "@/components/listing/ListingSkeleton";
import { Breadcrumbs } from "@/components/ui/Breadcrumbs";
import { YarnCurl } from "@/components/ui/icons";

export const metadata: Metadata = {
  title: "Shop all",
  description: "Browse dog and cat food, toys, beds, grooming, health and travel essentials.",
};

type Params = Record<string, string | string[] | undefined>;
const first = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v);

function heading(params: Params, total: number) {
  const pet = first(params.pet);
  const q = first(params.q);
  const title = q
    ? `Results for “${q}”`
    : pet === "dog"
      ? "Everything for dogs"
      : pet === "cat"
        ? "Everything for cats"
        : "Shop all products";
  const eyebrow = q ? `${total} ${total === 1 ? "match" : "matches"}` : pet ? "Pet essentials" : "The whole shop";
  return (
    <header className="mb-7">
      <p className="mb-2 inline-flex items-center gap-2 text-xs font-bold tracking-[0.18em] text-orange-ink uppercase">
        <YarnCurl className="h-3 w-8 text-orange" /> {eyebrow}
      </p>
      <h1 className="text-4xl font-extrabold sm:text-5xl">{title}</h1>
    </header>
  );
}

export default function ShopPage({ searchParams }: { searchParams: Promise<Params> }) {
  return (
    <PageTransition>
      <div className="container-page pt-6 pb-4 md:pt-8">
        <Breadcrumbs items={[{ label: "Home", href: "/" }, { label: "Shop" }]} />
        <div className="mt-5">
          <Suspense fallback={<ListingSkeleton />}>
            <ListingResults searchParams={searchParams} pathname="/shop" heading={(params, data) => heading(params, data.total)} />
          </Suspense>
        </div>
      </div>
    </PageTransition>
  );
}
