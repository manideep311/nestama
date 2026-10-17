"use client";

import { useState } from "react";
import { useReducedMotion } from "motion/react";
import * as m from "motion/react-m";
import { Heart } from "lucide-react";
import { useWishlist } from "@/lib/wishlist-store";
import { useToast } from "@/components/toast/ToastProvider";
import { PawBurst } from "@/components/animations/PawBurst";
import { cn } from "@/lib/cn";

/** Heart toggle: fills orange with a pop and a paw-print burst; a second click removes it. */
export function WishlistButton({ productId, productName, className }: { productId: string; productName: string; className?: string }) {
  const { has, toggle } = useWishlist();
  const { show } = useToast();
  const reduce = useReducedMotion();
  const [burst, setBurst] = useState(0);
  const saved = has(productId);

  function onClick() {
    const nowSaved = toggle(productId);
    if (nowSaved) {
      setBurst((b) => b + 1);
      show({
        title: "Saved to your favorites!",
        description: productName,
        icon: "heart",
        actions: [{ label: "View wishlist", href: "/account/wishlist" }],
      });
    } else {
      show({ title: "Removed from favorites", description: productName, icon: "heart", duration: 2500 });
    }
  }

  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={saved}
      aria-label={saved ? `Remove ${productName} from favourites` : `Save ${productName} to favourites`}
      className={cn(
        "relative z-10 grid size-10 place-items-center rounded-full bg-white/95 shadow-card transition-colors",
        saved ? "text-orange" : "text-forest hover:text-orange-ink",
        className,
      )}
    >
      <m.span
        key={saved ? "on" : "off"}
        className="grid place-items-center"
        initial={reduce || !saved ? false : { scale: 0.4 }}
        animate={{ scale: 1 }}
        transition={{ type: "spring", stiffness: 600, damping: 14 }}
      >
        <Heart className={cn("size-[18px] transition-[fill] duration-200", saved && "fill-current")} aria-hidden="true" />
      </m.span>
      <PawBurst trigger={burst} count={6} radius={30} />
    </button>
  );
}
