import type { Metadata } from "next";
import { PageTransition } from "@/components/layout/PageTransition";
import { AccountAddresses } from "@/components/account/AccountViews";

export const metadata: Metadata = { title: "Addresses", robots: { index: false } };

export default function Page() {
  return (
    <PageTransition>
      <AccountAddresses />
    </PageTransition>
  );
}
