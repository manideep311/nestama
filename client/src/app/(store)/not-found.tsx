import type { Metadata } from "next";
import { NotFoundContent } from "@/components/layout/NotFoundContent";

export const metadata: Metadata = { title: "Page not found" };

// notFound() from a storefront page: the (store) layout already supplies the header and footer.
export default function StoreNotFound() {
  return <NotFoundContent />;
}
