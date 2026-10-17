"use client";

import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";
import type { NavItem } from "@/lib/nav";
import { cn } from "@/lib/cn";

/** Which nav item matches the current URL (pet listings are told apart by ?pet=). */
function useActiveHref(items: NavItem[]): string | null {
  const pathname = usePathname();
  const params = useSearchParams();
  const pet = params.get("pet");
  for (const item of items) {
    const [path, query] = item.href.split("?");
    if (path !== pathname) continue;
    if (!query) return item.href;
    if (query === `pet=${pet}`) return item.href;
  }
  return null;
}

function ActiveCategoryNav({ items }: { items: NavItem[] }) {
  return <NavList items={items} activeHref={useActiveHref(items)} />;
}

export function CategoryNav({ items, activeHref }: { items: NavItem[]; activeHref?: string | null }) {
  // When rendered as the Suspense fallback the active item is passed explicitly (none).
  if (activeHref !== undefined) return <NavList items={items} activeHref={activeHref} />;
  return <ActiveCategoryNav items={items} />;
}

function NavList({ items, activeHref }: { items: NavItem[]; activeHref: string | null }) {
  return (
    <nav aria-label="Shop by category" className="container-page">
      <ul className="flex h-12 items-center justify-between gap-2">
        {items.map((item) => {
          const active = item.href === activeHref;
          return (
            <li key={item.href}>
              <Link
                href={item.href}
                aria-current={active ? "page" : undefined}
                className={cn(
                  "relative inline-flex h-12 items-center px-1 text-[14.5px] font-semibold whitespace-nowrap transition-colors",
                  "after:absolute after:inset-x-1 after:bottom-2 after:h-[2.5px] after:origin-left after:scale-x-0 after:rounded-full after:bg-orange after:transition-transform after:duration-300 after:ease-soft",
                  "hover:after:scale-x-100",
                  item.accent ? "text-orange-ink after:scale-x-100" : "text-forest hover:text-forest-700",
                  active && "after:scale-x-100",
                )}
              >
                {item.label}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
