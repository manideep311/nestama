import { Suspense } from "react";
import type { Metadata } from "next";
import { PageTransition } from "@/components/layout/PageTransition";
import { OrderTracking } from "@/components/orders/OrderViews";

export const metadata: Metadata = { title: "Your order", robots: { index: false } };

type Params = Promise<{ id: string }>;

// `params` is URL data, so it is read behind Suspense; the order itself loads client-side.
export default function OrderPage({ params }: { params: Params }) {
  return (
    <PageTransition>
      <Suspense
        fallback={
          <div className="container-page py-10">
            <div className="h-72 skeleton rounded-3xl" />
          </div>
        }
      >
        <Order params={params} />
      </Suspense>
    </PageTransition>
  );
}

async function Order({ params }: { params: Params }) {
  const { id } = await params;
  return <OrderTracking id={id} />;
}
