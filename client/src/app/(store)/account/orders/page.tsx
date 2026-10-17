import type { Metadata } from "next";
import { PageTransition } from "@/components/layout/PageTransition";
import { AccountOrders } from "@/components/account/AccountViews";

export const metadata: Metadata = { title: "Your orders", robots: { index: false } };

export default function Page() {
  return (
    <PageTransition>
      <AccountOrders />
    </PageTransition>
  );
}
