import Image from "next/image";
import Link from "next/link";
import type { CategoryDTO, ImageDTO, PetCardDTO } from "@nestama/shared";
import { PawIcon } from "@/components/ui/icons";
import { SectionHeading } from "@/components/ui/SectionHeading";

interface Tile {
  key: string;
  href: string;
  label: string;
  image: ImageDTO;
}

const discs = ["bg-peach", "bg-sage"];

export function CategoryGrid({ petCards, categories }: { petCards: PetCardDTO[]; categories: CategoryDTO[] }) {
  const tiles: Tile[] = [
    ...petCards.map((p) => ({ key: `pet-${p.pet}`, href: `/shop?pet=${p.pet}`, label: p.label, image: p.image })),
    ...categories.map((c) => ({ key: c.slug, href: `/c/${c.slug}`, label: c.homeLabel, image: c.image })),
  ];

  return (
    <section aria-labelledby="categories" className="container-page scroll-mt-40 pt-14 md:pt-20">
      <SectionHeading id="categories" eyebrow="Shop by category" title="Something for every tail" />
      <ul className="-mx-4 scrollbar-none flex snap-x gap-2 overflow-x-auto px-4 pb-2 sm:mx-0 sm:grid sm:grid-cols-5 sm:gap-x-3 sm:gap-y-6 sm:overflow-visible sm:px-0 lg:grid-cols-10">
        {tiles.map((t, i) => (
          <li key={t.key} className="w-[25%] shrink-0 snap-start sm:w-auto">
            <CategoryTile tile={t} disc={discs[i % 2]!} />
          </li>
        ))}
      </ul>
    </section>
  );
}

function CategoryTile({ tile, disc }: { tile: Tile; disc: string }) {
  return (
    <Link
      href={tile.href}
      className="group flex flex-col items-center gap-2.5 rounded-3xl p-1 text-center transition-transform duration-150 active:scale-95"
    >
      <span
        className={`relative block aspect-square w-full max-w-28 rounded-full ${disc} p-1.5 ring-1 ring-line transition-shadow duration-300 group-hover:shadow-lift group-focus-visible:shadow-lift`}
      >
        <span className="relative block size-full overflow-hidden rounded-full">
          <Image
            src={tile.image.url}
            alt=""
            fill
            sizes="(min-width: 1024px) 112px, (min-width: 640px) 18vw, 25vw"
            className="object-cover transition-transform duration-500 ease-soft group-hover:scale-[1.08] group-focus-visible:scale-[1.08]"
          />
        </span>
        {/* Paw slides in on hover / focus */}
        <span className="absolute -right-0.5 -bottom-0.5 grid size-8 translate-y-2 scale-75 place-items-center rounded-full bg-ember text-white opacity-0 shadow-card transition-all duration-300 ease-spring group-hover:translate-y-0 group-hover:scale-100 group-hover:opacity-100 group-focus-visible:translate-y-0 group-focus-visible:scale-100 group-focus-visible:opacity-100">
          <PawIcon className="size-4" />
        </span>
      </span>
      <span className="text-[13px] leading-tight font-bold text-forest transition-colors duration-200 group-hover:text-orange-ink group-focus-visible:text-orange-ink sm:text-sm">
        {tile.label}
      </span>
    </Link>
  );
}
