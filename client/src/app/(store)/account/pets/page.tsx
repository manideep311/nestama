import type { Metadata } from "next";
import { PageTransition } from "@/components/layout/PageTransition";
import { MyPets } from "@/components/pets/MyPets";

export const metadata: Metadata = { title: "My pets", robots: { index: false } };

export default function Page() {
  return (
    <PageTransition>
      <MyPets />
    </PageTransition>
  );
}
