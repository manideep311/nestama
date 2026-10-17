import { Suspense } from "react";
import type { Metadata } from "next";
import { Inventory } from "@/components/admin/Taxonomy";

export const metadata: Metadata = { title: "Inventory" };

type SearchParams = Promise<{ low?: string }>;

export default function AdminInventoryPage({ searchParams }: { searchParams: SearchParams }) {
  return (
    <Suspense fallback={<div className="h-96 skeleton rounded-2xl" />}>
      <InventoryWithFilter searchParams={searchParams} />
    </Suspense>
  );
}

async function InventoryWithFilter({ searchParams }: { searchParams: SearchParams }) {
  const { low } = await searchParams;
  return <Inventory initialLow={low === "1"} />;
}
