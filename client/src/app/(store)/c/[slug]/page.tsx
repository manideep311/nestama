import { Suspense } from "react";
import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { notFound } from "next/navigation";
import { getCategories } from "@/lib/catalog";
import { PageTransition } from "@/components/layout/PageTransition";
import { ListingResults } from "@/components/listing/ListingResults";
import { ListingSkeleton } from "@/components/listing/ListingSkeleton";
import { Breadcrumbs } from "@/components/ui/Breadcrumbs";
import { YarnCurl } from "@/components/ui/icons";

type Params = Promise<{ slug: string }>;

export async function generateStaticParams() {
  const categories = await getCategories();
  return categories.map((c) => ({ slug: c.slug }));
}

async function findCategory(slug: string) {
  const categories = await getCategories();
  const category = categories.find((c) => c.slug === slug);
  return category
    ? {
        category,
        parent: categories.find((c) => c.slug === category.parentSlug) ?? null,
        children: categories.filter((c) => c.parentSlug === category.slug),
      }
    : null;
}

export async function generateMetadata({ params }: { params: Params }): Promise<Metadata> {
  const found = await findCategory((await params).slug);
  return found ? { title: found.category.name, description: found.category.description } : { title: "Category not found" };
}

type SearchParams = Promise<Record<string, string | string[] | undefined>>;

// `params` is URL data, so the page reads it behind Suspense (instant navigations).
export default function CategoryPage({ params, searchParams }: { params: Params; searchParams: SearchParams }) {
  return (
    <PageTransition>
      <Suspense fallback={<CategorySkeleton />}>
        <CategoryContent params={params} searchParams={searchParams} />
      </Suspense>
    </PageTransition>
  );
}

function CategorySkeleton() {
  return (
    <div className="container-page pt-6 pb-4 md:pt-8" aria-busy="true" aria-label="Loading category">
      <div className="h-4 w-48 skeleton rounded-full" />
      <div className="mt-5 mb-8 flex items-center gap-5">
        <div className="hidden size-20 shrink-0 skeleton rounded-full sm:block" />
        <div className="space-y-3">
          <div className="h-3 w-28 skeleton rounded-full" />
          <div className="h-11 w-56 skeleton rounded-2xl" />
          <div className="h-4 w-80 max-w-full skeleton rounded-full" />
        </div>
      </div>
      <ListingSkeleton />
    </div>
  );
}

async function CategoryContent({ params, searchParams }: { params: Params; searchParams: SearchParams }) {
  const { slug } = await params;
  const found = await findCategory(slug);
  if (!found) notFound();
  const { category, parent, children } = found;

  return (
    <>
      <div className="container-page pt-6 pb-4 md:pt-8">
        <Breadcrumbs
          items={[
            { label: "Home", href: "/" },
            { label: "Shop", href: "/shop" },
            ...(parent ? [{ label: parent.name, href: `/c/${parent.slug}` }] : []),
            { label: category.name },
          ]}
        />
        <header className="mt-5 mb-8 flex items-center gap-5">
          <span className="relative hidden size-20 shrink-0 overflow-hidden rounded-full bg-peach ring-4 ring-white sm:block">
            <Image src={category.image.url} alt="" fill sizes="80px" className="object-cover" />
          </span>
          <div>
            <p className="mb-2 inline-flex items-center gap-2 text-xs font-bold tracking-[0.18em] text-orange-ink uppercase">
              <YarnCurl className="h-3 w-8 text-orange" /> {category.productCount} products
            </p>
            <h1 className="text-4xl font-extrabold sm:text-5xl">{category.name}</h1>
            <p className="mt-2 max-w-2xl text-muted">{category.description}</p>
            {children.length > 0 && (
              <ul className="mt-4 flex flex-wrap gap-2" aria-label={`${category.name} categories`}>
                {children.map((c) => (
                  <li key={c.slug}>
                    <Link
                      href={`/c/${c.slug}`}
                      className="inline-flex h-9 items-center rounded-full bg-white px-4 text-sm font-bold text-forest ring-1 ring-line hover:bg-sage"
                    >
                      {c.name}
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </header>
        <Suspense fallback={<ListingSkeleton />}>
          <ListingResults searchParams={searchParams} pathname={`/c/${slug}`} fixed={{ category: slug }} hide={{ category: true }} />
        </Suspense>
      </div>
    </>
  );
}
