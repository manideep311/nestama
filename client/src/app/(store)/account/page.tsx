import type { Metadata } from "next";
import { PageTransition } from "@/components/layout/PageTransition";
import { AccountOverview } from "@/components/account/AccountViews";

export const metadata: Metadata = { title: "Your account", robots: { index: false } };

export default function Page() {
  return (
    <PageTransition>
      <AccountOverview />
    </PageTransition>
  );
}
