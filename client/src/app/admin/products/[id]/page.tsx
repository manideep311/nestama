import { Suspense } from "react";
import type { Metadata } from "next";
import { ProductEditor } from "@/components/admin/ProductEditor";

export const metadata: Metadata = { title: "Edit product" };

type Params = Promise<{ id: string }>;

export default function EditProductPage({ params }: { params: Params }) {
  return (
    <Suspense fallback={<div className="h-96 skeleton rounded-2xl" />}>
      <Editor params={params} />
    </Suspense>
  );
}

async function Editor({ params }: { params: Params }) {
  const { id } = await params;
  return <ProductEditor id={id} />;
}
