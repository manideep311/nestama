"use client";

import { useState, type MouseEvent } from "react";
import { AnimatePresence, useReducedMotion } from "motion/react";
import * as m from "motion/react-m";
import { Loader2, ShoppingCart } from "lucide-react";
import { useAddToCart, useUpdateCartLine } from "@/lib/cart-client";
import { useToast, type ToastAction } from "@/components/toast/ToastProvider";
import { flyToCart } from "@/components/animations/flyToCart";
import { PawIcon } from "@/components/ui/icons";
import { cn } from "@/lib/cn";

interface Props {
  variantId: string;
  productName: string;
  quantity?: number;
  soldOut?: boolean;
  /** "icon" for product cards, "full" for the product page. */
  appearance?: "icon" | "full";
  className?: string;
  /** Fires on click once the photo has launched toward the cart (e.g. to close the quick view). */
  onAddStart?: () => void;
  onAdded?: () => void;
}

/**
 * Adds to the server cart with the pet-themed feedback: a paw presses the button, the product
 * photo flies to the header cart, the count bumps, and a toast offers Undo / View cart.
 */
export function AddToCartButton({
  variantId,
  productName,
  quantity = 1,
  soldOut = false,
  appearance = "icon",
  className,
  onAddStart,
  onAdded,
}: Props) {
  const add = useAddToCart();
  const update = useUpdateCartLine();
  const { show } = useToast();
  const reduce = useReducedMotion();
  const [press, setPress] = useState(0);

  function onClick(e: MouseEvent<HTMLButtonElement>) {
    if (soldOut || add.isPending) return;
    setPress((p) => p + 1);

    const card = e.currentTarget.closest("[data-product-card], [data-quick-view]");
    const img = card?.querySelector<HTMLImageElement>("img") ?? document.querySelector<HTMLImageElement>("[data-product-hero] img");
    if (img) flyToCart(img, img.currentSrc || img.src);
    onAddStart?.();

    add.mutate(
      { variantId, quantity },
      {
        onSuccess: (cart) => {
          const line = cart.lines.find((l) => l.variantId === variantId);
          const previousQuantity = line ? line.quantity - quantity : 0;
          const actions: ToastAction[] = [];
          if (line) {
            actions.push({
              label: "Undo",
              onClick: () =>
                update.mutate(
                  { lineId: line.id, quantity: previousQuantity },
                  {
                    onSuccess: () => show({ title: "Removed from your pack", description: productName, icon: "check", duration: 2500 }),
                    onError: (err) => show({ title: "Couldn't undo that", description: err.message, icon: "alert" }),
                  },
                ),
            });
          }
          actions.push({ label: "View cart", href: "/cart" });
          show({ title: "Added to your pack!", description: productName, icon: "cart", actions });
          onAdded?.();
        },
        onError: (err) => show({ title: "Couldn't add that to your cart", description: err.message, icon: "alert" }),
      },
    );
  }

  const label = soldOut ? `${productName} is sold out` : `Add ${productName} to cart`;

  return (
    <m.button
      type="button"
      onClick={onClick}
      disabled={soldOut}
      aria-busy={add.isPending}
      aria-label={appearance === "icon" ? label : undefined}
      whileTap={reduce ? undefined : { scale: 0.93 }}
      className={cn(
        "relative z-10 inline-flex shrink-0 items-center justify-center gap-2 bg-ember font-bold text-white transition-colors duration-200 hover:bg-ember-hover",
        "shadow-[0_8px_18px_-10px_rgb(212_63_10/0.9)] disabled:bg-charcoal/20 disabled:text-charcoal/50 disabled:shadow-none",
        appearance === "icon" ? "size-11 rounded-2xl" : "h-13 rounded-full px-7 text-base",
        className,
      )}
    >
      {add.isPending && appearance === "full" ? (
        <Loader2 className="size-5 animate-spin" aria-hidden="true" />
      ) : (
        <ShoppingCart className="size-5" aria-hidden="true" />
      )}
      {appearance === "full" && <span>{soldOut ? "Sold out" : "Add to cart"}</span>}

      {/* The paw that "presses" the button */}
      {!reduce && (
        <AnimatePresence>
          {press > 0 && (
            <m.span
              key={press}
              aria-hidden="true"
              className="pointer-events-none absolute -top-5 left-1/2 -ml-3 text-forest"
              initial={{ y: -10, opacity: 0, scale: 1.15 }}
              animate={{ y: [-10, 6, 2], opacity: [0, 1, 0], scale: [1.15, 0.9, 0.95] }}
              transition={{ duration: 0.42, times: [0, 0.45, 1], ease: "easeOut" }}
            >
              <PawIcon className="size-6 drop-shadow" />
            </m.span>
          )}
        </AnimatePresence>
      )}
    </m.button>
  );
}
