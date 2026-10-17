"use client";

import { usePetPicks } from "@/lib/pets-client";
import { ProductCarousel } from "@/components/product/ProductCarousel";
import { Button } from "@/components/ui/Button";
import { FormAlert } from "@/components/ui/Field";

/** A carousel of products picked for one pet, each captioned with why it was picked. */
export function PetPicks({ petId, petName }: { petId: string; petName: string }) {
  const picks = usePetPicks(petId);

  if (picks.isPending) {
    return (
      <div className="flex gap-3 overflow-hidden sm:gap-4" aria-busy="true" aria-label={`Loading picks for ${petName}`}>
        {[0, 1, 2, 3, 4].map((i) => (
          <div
            key={i}
            className="h-[22rem] w-[68%] shrink-0 skeleton rounded-3xl sm:w-[41%] md:w-[31%] lg:w-[calc((100%-3rem)/4)] xl:w-[calc((100%-4rem)/5)]"
          />
        ))}
      </div>
    );
  }
  if (picks.isError) {
    return (
      <FormAlert className="flex flex-wrap items-center justify-between gap-3">
        We couldn&apos;t load picks for {petName}.
        <Button size="sm" variant="outline" onClick={() => void picks.refetch()}>
          Try again
        </Button>
      </FormAlert>
    );
  }
  const { items } = picks.data;
  if (items.length === 0) {
    return <p className="text-sm text-muted">No picks for {petName} right now. New arrivals land every week, so check back soon.</p>;
  }

  return (
    <ProductCarousel
      products={items.map((i) => i.product)}
      label={`Picked for ${petName}`}
      notes={Object.fromEntries(items.map((i) => [i.product.id, i.reason]))}
    />
  );
}
