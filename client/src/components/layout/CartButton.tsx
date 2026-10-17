"use client";

import { useState } from "react";
import Link from "next/link";
import { useReducedMotion } from "motion/react";
import * as m from "motion/react-m";
import { ShoppingCart } from "lucide-react";
import { useCart } from "@/lib/cart-client";

/** Header cart link with an item count that bumps when it changes. Add-to-cart flights land here. */
export function CartButton() {
  const { data } = useCart();
  const reduce = useReducedMotion();
  const count = data?.summary.itemCount ?? 0;
  const itemsLabel = `${count} ${count === 1 ? "item" : "items"}`;

  // Announce changes, not the first load: a count arriving with the page isn't news.
  const [seen, setSeen] = useState<number | null>(null);
  const [announcement, setAnnouncement] = useState("");
  if (data && seen !== count) {
    if (seen !== null) setAnnouncement(`Cart updated, ${itemsLabel}`);
    setSeen(count);
  }

  return (
    <>
      <Link
        href="/cart"
        data-cart-target
        className="relative flex h-11 items-center gap-2 rounded-full px-2.5 text-sm font-semibold text-forest transition-colors hover:bg-sage sm:px-3"
      >
        <ShoppingCart className="size-[22px]" aria-hidden="true" />
        <span className="sr-only">Cart, {itemsLabel}</span>
        <span className="sr-only xl:not-sr-only" aria-hidden="true">
          Cart
        </span>
        {count > 0 && (
          <m.span
            key={count}
            aria-hidden="true"
            initial={reduce ? false : { scale: 1.6 }}
            animate={{ scale: 1 }}
            transition={{ type: "spring", stiffness: 520, damping: 14 }}
            className="tabular absolute -top-0.5 left-6 grid min-w-5 place-items-center rounded-full bg-ember px-1 text-[11px] leading-5 font-extrabold text-white ring-2 ring-cream"
          >
            {count > 99 ? "99+" : count}
          </m.span>
        )}
      </Link>
      <span role="status" className="sr-only">
        {announcement}
      </span>
    </>
  );
}
