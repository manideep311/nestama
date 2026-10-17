import { Suspense } from "react";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getAllProductSlugs, getProduct, getRelatedProducts, getReviews, getStoreSettings } from "@/lib/catalog";
import { PageTransition } from "@/components/layout/PageTransition";
import { Breadcrumbs } from "@/components/ui/Breadcrumbs";
import { SectionHeading } from "@/components/ui/SectionHeading";
import { Gallery } from "@/components/pdp/Gallery";
import { PurchasePanel } from "@/components/pdp/PurchasePanel";
import { Reviews } from "@/components/pdp/Reviews";
import { ProductCarousel } from "@/components/product/ProductCarousel";
import { RecentlyViewed, RecordView } from "@/components/product/RecentlyViewed";
import { productJsonLd } from "@/lib/json-ld";
import { SITE_URL } from "@/lib/site";

type Params = Promise<{ slug: string }>;

export async function generateStaticParams() {
  const slugs = await getAllProductSlugs();
  return slugs.map((slug) => ({ slug }));
}

export async function generateMetadata({ params }: { params: Params }): Promise<Metadata> {
  const product = await getProduct((await params).slug);
  if (!product) return { title: "Product not found" };
  return {
    title: product.name,
    description: product.shortDescription || product.description.slice(0, 160),
    openGraph: { title: product.name, images: [{ url: product.image.url, alt: product.image.alt }] },
  };
}

// `params` is URL data, so it is read behind Suspense (instant navigations). Product cards link here
// with prefetch={true}, which resolves this cached content before the click, so the card→hero
// morph still pairs.
export default function ProductPage({ params }: { params: Params }) {
  return (
    <PageTransition>
      <Suspense fallback={<ProductSkeleton />}>
        <ProductContent params={params} />
      </Suspense>
    </PageTransition>
  );
}

async function ProductContent({ params }: { params: Params }) {
  const { slug } = await params;
  const [product, settings] = await Promise.all([getProduct(slug), getStoreSettings().catch(() => null)]);
  if (!product) notFound();

  return (
    <>
      {/* Structured data for search results (price, availability, rating); escaped in productJsonLd. */}
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: productJsonLd(product, SITE_URL) }} />
      <RecordView productId={product.id} />
      <div className="container-page pt-6 md:pt-8">
        <Breadcrumbs
          items={[
            { label: "Home", href: "/" },
            ...product.categoryTrail.map((c) => ({ label: c.name, href: `/c/${c.slug}` })),
            { label: product.name },
          ]}
        />

        <div className="mt-6 grid gap-8 lg:grid-cols-[1.08fr_0.92fr] lg:gap-12">
          <Gallery images={product.images} slug={product.slug} discountPercent={product.pricing.discountPercent} />
          <PurchasePanel product={product} freeShippingThreshold={settings?.freeShippingThreshold ?? 99900} />
        </div>

        <section aria-labelledby="details-title" className="mt-16 grid gap-8 lg:grid-cols-2">
          <div>
            <h2 id="details-title" className="text-3xl font-extrabold">
              About this product
            </h2>
            <p className="mt-4 text-[15.5px] leading-relaxed text-charcoal/90">{product.description}</p>
          </div>
          {product.specs.length > 0 && (
            <div>
              <h2 className="text-3xl font-extrabold">Specifications</h2>
              <dl className="mt-4 divide-y divide-line overflow-hidden rounded-3xl bg-white ring-1 ring-line">
                {product.specs.map((s) => (
                  <div key={s.label} className="grid grid-cols-[9rem_1fr] gap-4 px-5 py-3 text-sm">
                    <dt className="font-semibold text-muted">{s.label}</dt>
                    <dd className="text-charcoal">{s.value}</dd>
                  </div>
                ))}
              </dl>
            </div>
          )}
        </section>

        <div className="mt-16">
          <Suspense fallback={<div className="h-72 skeleton rounded-3xl" />}>
            <ProductReviews slug={product.slug} />
          </Suspense>
        </div>

        <Suspense fallback={null}>
          <RelatedProducts slug={product.slug} />
        </Suspense>

        <RecentlyViewed excludeId={product.id} className="pt-16" />
      </div>
    </>
  );
}

function ProductSkeleton() {
  return (
    <div className="container-page pt-6 md:pt-8" aria-busy="true" aria-label="Loading product">
      <div className="h-4 w-64 skeleton rounded-full" />
      <div className="mt-6 grid gap-8 lg:grid-cols-[1.08fr_0.92fr] lg:gap-12">
        <div className="aspect-square skeleton rounded-[2rem]" />
        <div className="space-y-4 pt-2">
          <div className="h-4 w-24 skeleton rounded-full" />
          <div className="h-10 w-4/5 skeleton rounded-2xl" />
          <div className="h-5 w-40 skeleton rounded-full" />
          <div className="h-9 w-36 skeleton rounded-xl" />
          <div className="flex gap-2 pt-2">
            {[0, 1, 2].map((i) => (
              <div key={i} className="h-11 w-20 skeleton rounded-full" />
            ))}
          </div>
          <div className="mt-4 h-14 w-full skeleton rounded-full" />
          <div className="h-24 w-full skeleton rounded-3xl" />
        </div>
      </div>
    </div>
  );
}

async function ProductReviews({ slug }: { slug: string }) {
  const data = await getReviews(slug).catch(() => null);
  if (!data) return <p className="text-muted">Reviews are unavailable right now.</p>;
  return <Reviews slug={slug} data={data} />;
}

async function RelatedProducts({ slug }: { slug: string }) {
  const related = await getRelatedProducts(slug).catch(() => []);
  if (related.length === 0) return null;
  return (
    <section aria-labelledby="related-title" className="pt-16">
      <SectionHeading id="related-title" eyebrow="You might also like" title="Related products" />
      <ProductCarousel products={related} label="Related products" />
    </section>
  );
}
