import { Suspense } from "react";
import type { Metadata } from "next";
import { OrderDetail } from "@/components/admin/OrderAdmin";

export const metadata: Metadata = { title: "Order" };

type Params = Promise<{ id: string }>;

export default function AdminOrderPage({ params }: { params: Params }) {
  return (
    <Suspense fallback={<div className="h-[32rem] skeleton rounded-2xl" />}>
      <Detail params={params} />
    </Suspense>
  );
}

async function Detail({ params }: { params: Params }) {
  const { id } = await params;
  return <OrderDetail id={id} />;
}
