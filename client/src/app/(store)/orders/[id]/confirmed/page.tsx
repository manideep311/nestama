import { Suspense } from "react";
import type { Metadata } from "next";
import { PageTransition } from "@/components/layout/PageTransition";
import { OrderConfirmed } from "@/components/orders/OrderViews";

export const metadata: Metadata = { title: "Order confirmation", robots: { index: false } };

type Params = Promise<{ id: string }>;

// The celebration only renders once the server reports the order as paid (see OrderConfirmed).
export default function OrderConfirmedPage({ params }: { params: Params }) {
  return (
    <PageTransition>
      <Suspense
        fallback={
          <div className="container-page py-16">
            <div className="mx-auto h-80 max-w-xl skeleton rounded-3xl" />
          </div>
        }
      >
        <Confirmed params={params} />
      </Suspense>
    </PageTransition>
  );
}

async function Confirmed({ params }: { params: Params }) {
  const { id } = await params;
  return <OrderConfirmed id={id} />;
}
