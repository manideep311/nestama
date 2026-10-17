import type { Metadata } from "next";
import { PageTransition } from "@/components/layout/PageTransition";
import { AccountWishlist } from "@/components/account/AccountViews";

export const metadata: Metadata = { title: "Wishlist", robots: { index: false } };

export default function Page() {
  return (
    <PageTransition>
      <AccountWishlist />
    </PageTransition>
  );
}
