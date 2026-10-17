import type { Metadata } from "next";
import { Reports } from "@/components/admin/Dashboard";

export const metadata: Metadata = { title: "Reports" };

export default function AdminReportsPage() {
  return <Reports />;
}
