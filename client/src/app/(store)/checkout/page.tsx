import type { Metadata } from "next";
import { PageTransition } from "@/components/layout/PageTransition";
import { CheckoutView } from "@/components/checkout/CheckoutView";

export const metadata: Metadata = { title: "Checkout", robots: { index: false } };

export default function CheckoutPage() {
  return (
    <PageTransition>
      <CheckoutView />
    </PageTransition>
  );
}
