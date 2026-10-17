import type { Metadata } from "next";
import { PageTransition } from "@/components/layout/PageTransition";
import { AccountProfile } from "@/components/account/AccountViews";

export const metadata: Metadata = { title: "Profile", robots: { index: false } };

export default function Page() {
  return (
    <PageTransition>
      <AccountProfile />
    </PageTransition>
  );
}
