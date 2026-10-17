import type { Metadata } from "next";
import { StoreFrame } from "@/components/layout/StoreFrame";
import { NotFoundContent } from "@/components/layout/NotFoundContent";

export const metadata: Metadata = { title: "Page not found" };

// Unmatched URLs render in the root layout, so this brings its own storefront frame.
export default function NotFound() {
  return (
    <StoreFrame>
      <NotFoundContent />
    </StoreFrame>
  );
}
