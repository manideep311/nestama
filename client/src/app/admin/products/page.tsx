import type { Metadata } from "next";
import { ProductList } from "@/components/admin/ProductList";

export const metadata: Metadata = { title: "Products" };

export default function AdminProductsPage() {
  return <ProductList />;
}
