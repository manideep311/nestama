import type { Metadata } from "next";
import { PageTransition } from "@/components/layout/PageTransition";
import { Breadcrumbs } from "@/components/ui/Breadcrumbs";
import { CartHeading, CartView } from "@/components/cart/CartView";

export const metadata: Metadata = { title: "Your cart", robots: { index: false } };

export default function CartPage() {
  return (
    <PageTransition>
      <div className="container-page pt-6 pb-4 md:pt-8">
        <Breadcrumbs items={[{ label: "Home", href: "/" }, { label: "Cart" }]} />
        <header className="mt-5 mb-7">
          <CartHeading />
          <h1 className="text-4xl font-extrabold sm:text-5xl">Your cart</h1>
        </header>
        <CartView />
      </div>
    </PageTransition>
  );
}
