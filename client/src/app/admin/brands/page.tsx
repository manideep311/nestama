import type { Metadata } from "next";
import { BrandManager } from "@/components/admin/Taxonomy";

export const metadata: Metadata = { title: "Brands" };

export default function AdminBrandsPage() {
  return <BrandManager />;
}
