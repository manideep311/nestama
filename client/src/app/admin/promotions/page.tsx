import type { Metadata } from "next";
import { PromotionManager } from "@/components/admin/PromotionManager";

export const metadata: Metadata = { title: "Promotions" };

export default function AdminPromotionsPage() {
  return <PromotionManager />;
}
