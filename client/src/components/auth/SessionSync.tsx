"use client";

import { useEffect, useRef } from "react";
import { useQueryClient } from "@tanstack/react-query";
import type { WishlistDTO } from "@nestama/shared";
import { useSession } from "@/lib/auth-client";
import { apiFetch, cartKey } from "@/lib/cart-client";
import { currentWishlist, replaceWishlist, setWishlistAccount } from "@/lib/wishlist-store";

async function pullWishlist() {
  try {
    const merged = await apiFetch<WishlistDTO>("/wishlist/sync", {
      method: "POST",
      body: JSON.stringify({ productIds: currentWishlist() }),
    });
    replaceWishlist(merged.productIds);
  } catch {
    // Offline or signed out meanwhile: the local list stays as it was.
  }
}

/**
 * Keeps client state in step with the session:
 * - signing in: the cart refetches (the server folds the guest cart in) and the local wishlist
 *   is merged into the account's, which then becomes the local list;
 * - signing out: the cart refetches and the local wishlist is cleared (shared devices).
 */
export function SessionSync() {
  const { data, isPending } = useSession();
  const userId = data?.user.id ?? null;
  const queryClient = useQueryClient();
  const previous = useRef<string | null | undefined>(undefined);

  useEffect(() => {
    if (isPending) return;
    const before = previous.current;
    previous.current = userId;
    setWishlistAccount(Boolean(userId));

    if (before === undefined) {
      if (userId) void pullWishlist();
      return;
    }
    if (before === userId) return;

    void queryClient.invalidateQueries({ queryKey: cartKey });
    void queryClient.removeQueries({ queryKey: ["account"] });
    if (userId) void pullWishlist();
    else replaceWishlist([]);
  }, [userId, isPending, queryClient]);

  return null;
}
