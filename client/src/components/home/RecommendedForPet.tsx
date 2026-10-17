"use client";

import { useId, useRef, useState } from "react";
import type { PetDTO, PetRecommendationsDTO, ProductCardDTO } from "@nestama/shared";
import { useSession } from "@/lib/auth-client";
import { usePetPicks, usePets } from "@/lib/pets-client";
import { ProductCarousel } from "@/components/product/ProductCarousel";
import { SectionHeading } from "@/components/ui/SectionHeading";
import { cn } from "@/lib/cn";

type Species = "DOG" | "CAT";
const speciesLabel: Record<Species, string> = { DOG: "For dogs", CAT: "For cats" };

/** ARIA tabs (arrow keys, Home/End) shared by the Dog/Cat switch and the per-pet switch. */
function Tabs({
  label,
  items,
  active,
  onChange,
  idPrefix,
  panelId,
}: {
  label: string;
  items: { id: string; label: string }[];
  active: string;
  onChange: (id: string) => void;
  idPrefix: string;
  panelId: string;
}) {
  const refs = useRef<Record<string, HTMLButtonElement | null>>({});

  function onKeyDown(e: React.KeyboardEvent) {
    const i = items.findIndex((t) => t.id === active);
    const target =
      e.key === "ArrowRight"
        ? items[(i + 1) % items.length]
        : e.key === "ArrowLeft"
          ? items[(i - 1 + items.length) % items.length]
          : e.key === "Home"
            ? items[0]
            : e.key === "End"
              ? items.at(-1)
              : undefined;
    if (!target) return;
    e.preventDefault();
    onChange(target.id);
    refs.current[target.id]?.focus();
  }

  return (
    <div
      role="tablist"
      aria-label={label}
      className="inline-flex max-w-full flex-wrap rounded-full bg-white p-1 shadow-card ring-1 ring-line"
      onKeyDown={onKeyDown}
    >
      {items.map((t) => (
        <button
          key={t.id}
          ref={(el) => {
            refs.current[t.id] = el;
          }}
          role="tab"
          id={`${idPrefix}-${t.id}`}
          aria-selected={active === t.id}
          aria-controls={panelId}
          tabIndex={active === t.id ? 0 : -1}
          onClick={() => onChange(t.id)}
          className={cn(
            "h-10 rounded-full px-5 text-sm font-bold transition-colors duration-200",
            active === t.id ? "bg-forest text-cream" : "text-forest hover:bg-sage",
          )}
        >
          {t.label}
        </button>
      ))}
    </div>
  );
}

/**
 * "Recommended for your pet". Everyone gets the Dog/Cat rails rendered with the page; a signed-in
 * shopper with pets sees one tab per pet instead, swapped in only once that pet's picks have
 * arrived, so the section never flashes empty or changes size.
 */
export function RecommendedForPet({ recommended }: { recommended: Record<Species, ProductCardDTO[]> }) {
  const { data: session } = useSession();
  const pets = usePets(Boolean(session));
  const [petId, setPetId] = useState<string | null>(null);
  const list = pets.data ?? [];
  const active = list.find((p) => p.id === petId) ?? list[0];
  const picks = usePetPicks(active?.id ?? "", Boolean(active));

  if (active && picks.data && picks.data.items.length > 0) {
    return <PersonalPicks pets={list} active={active} onSelect={setPetId} picks={picks.data} updating={picks.isPlaceholderData} />;
  }
  return <SpeciesPicks recommended={recommended} />;
}

function PersonalPicks({
  pets,
  active,
  onSelect,
  picks,
  updating,
}: {
  pets: PetDTO[];
  active: PetDTO;
  onSelect: (id: string) => void;
  picks: PetRecommendationsDTO;
  updating: boolean;
}) {
  const id = useId();
  const panelId = `${id}-panel`;
  return (
    <section aria-labelledby={`${id}-title`} className="container-page pt-14 md:pt-20">
      <SectionHeading
        id={`${id}-title`}
        eyebrow="Picked for you"
        title={`Picked for ${active.name}`}
        action={{ href: "/account/pets", label: "My pets" }}
        aside={
          pets.length > 1 && (
            <Tabs
              label="Choose a pet"
              items={pets.map((p) => ({ id: p.id, label: p.name }))}
              active={active.id}
              onChange={onSelect}
              idPrefix={id}
              panelId={panelId}
            />
          )
        }
      />
      <div
        id={panelId}
        role={pets.length > 1 ? "tabpanel" : undefined}
        aria-labelledby={pets.length > 1 ? `${id}-${active.id}` : undefined}
        aria-busy={updating || undefined}
        className={cn("transition-opacity", updating && "opacity-60")}
      >
        <ProductCarousel
          key={picks.pet.id}
          products={picks.items.map((i) => i.product)}
          label={`Picked for ${picks.pet.name}`}
          notes={Object.fromEntries(picks.items.map((i) => [i.product.id, i.reason]))}
        />
      </div>
    </section>
  );
}

function SpeciesPicks({ recommended }: { recommended: Record<Species, ProductCardDTO[]> }) {
  const [species, setSpecies] = useState<Species>("DOG");
  const id = useId();
  const panelId = `${id}-panel`;
  return (
    <section aria-labelledby={`${id}-title`} className="container-page pt-14 md:pt-20">
      <SectionHeading
        id={`${id}-title`}
        eyebrow="Picked for you"
        title="Recommended for your pet"
        aside={
          <Tabs
            label="Choose your pet"
            items={(["DOG", "CAT"] as const).map((s) => ({ id: s, label: speciesLabel[s] }))}
            active={species}
            onChange={(s) => setSpecies(s as Species)}
            idPrefix={id}
            panelId={panelId}
          />
        }
      />
      <div role="tabpanel" id={panelId} aria-labelledby={`${id}-${species}`}>
        <ProductCarousel key={species} products={recommended[species]} label={`Recommended ${speciesLabel[species].toLowerCase()}`} />
      </div>
    </section>
  );
}
