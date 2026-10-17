"use client";

import { useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import type { ProductCardDTO } from "@nestama/shared";
import { apiFetch } from "@/lib/cart-client";
import { recordView, useRecentlyViewed } from "@/lib/recently-viewed";
import { SectionHeading } from "@/components/ui/SectionHeading";
import { ProductCarousel } from "./ProductCarousel";

/** Remembers a product view (rendered on product pages). */
export function RecordView({ productId }: { productId: string }) {
  useEffect(() => recordView(productId), [productId]);
  return null;
}

/** Rail of recently viewed products for this browser; renders nothing until there's history. */
export function RecentlyViewed({ excludeId, className }: { excludeId?: string; className?: string }) {
  const ids = useRecentlyViewed().filter((id) => id !== excludeId);
  const { data } = useQuery({
    queryKey: ["recently-viewed", ids.join(",")],
    queryFn: () => apiFetch<ProductCardDTO[]>(`/products/by-ids?ids=${ids.join(",")}`),
    enabled: ids.length > 0,
    staleTime: 60_000,
  });
  if (!data || data.length === 0) return null;
  return (
    <section aria-labelledby="recent-title" className={className}>
      <SectionHeading id="recent-title" eyebrow="Pick up where you left off" title="Recently viewed" />
      <ProductCarousel products={data} label="Recently viewed" />
    </section>
  );
}
