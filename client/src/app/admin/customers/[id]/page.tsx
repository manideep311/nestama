import { Suspense } from "react";
import type { Metadata } from "next";
import { CustomerDetail } from "@/components/admin/Customers";

export const metadata: Metadata = { title: "Customer" };

type Params = Promise<{ id: string }>;

export default function AdminCustomerPage({ params }: { params: Params }) {
  return (
    <Suspense fallback={<div className="h-[28rem] skeleton rounded-2xl" />}>
      <Detail params={params} />
    </Suspense>
  );
}

async function Detail({ params }: { params: Params }) {
  const { id } = await params;
  return <CustomerDetail id={id} />;
}
