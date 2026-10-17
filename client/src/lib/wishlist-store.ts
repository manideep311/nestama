"use client";

import { useCallback, useSyncExternalStore } from "react";
import { apiFetch } from "./cart-client";

// Wishlist: product ids in localStorage, shared across tabs and components. Signed in, the list
// mirrors the account (SessionSync pulls it on sign-in and each toggle is sent to the server).

export const MAX_WISHLIST = 200;
const KEY = "nst_wishlist";
const EVENT = "nst:wishlist";
const EMPTY: string[] = [];

export function parseList(raw: string | null): string[] {
  if (!raw) return [];
  try {
    const value: unknown = JSON.parse(raw);
    if (!Array.isArray(value)) return [];
    return [...new Set(value.filter((v): v is string => typeof v === "string"))];
  } catch {
    return [];
  }
}

export function toggleId(list: string[], id: string): { list: string[]; saved: boolean } {
  if (list.includes(id)) return { list: list.filter((x) => x !== id), saved: false };
  return { list: [id, ...list].slice(0, MAX_WISHLIST), saved: true };
}

// useSyncExternalStore needs a stable snapshot: cache the parsed list per raw string.
let cachedRaw: string | null = null;
let cachedList: string[] = EMPTY;

function snapshot(): string[] {
  let raw: string | null = null;
  try {
    raw = localStorage.getItem(KEY);
  } catch {
    return EMPTY;
  }
  if (raw !== cachedRaw) {
    cachedRaw = raw;
    cachedList = parseList(raw);
  }
  return cachedList;
}

function subscribe(onChange: () => void) {
  window.addEventListener(EVENT, onChange);
  window.addEventListener("storage", onChange);
  return () => {
    window.removeEventListener(EVENT, onChange);
    window.removeEventListener("storage", onChange);
  };
}

function write(list: string[]) {
  try {
    localStorage.setItem(KEY, JSON.stringify(list));
  } catch {
    // Storage unavailable: the change lasts for this page only.
    cachedRaw = JSON.stringify(list);
    cachedList = list;
  }
  window.dispatchEvent(new Event(EVENT));
}

let mirrorToAccount = false;

/** Called by SessionSync: while signed in, toggles are also saved to the account. */
export function setWishlistAccount(signedIn: boolean) {
  mirrorToAccount = signedIn;
}

export function currentWishlist(): string[] {
  return snapshot();
}

export function replaceWishlist(list: string[]) {
  write(list.slice(0, MAX_WISHLIST));
}

export function useWishlist() {
  const ids = useSyncExternalStore(subscribe, snapshot, () => EMPTY);
  const has = useCallback((id: string) => ids.includes(id), [ids]);
  const toggle = useCallback((id: string) => {
    const next = toggleId(snapshot(), id);
    write(next.list);
    if (mirrorToAccount) {
      // Best effort: the next sign-in sync reconciles anything that fails here.
      const request = next.saved
        ? apiFetch("/wishlist", { method: "POST", body: JSON.stringify({ productId: id }) })
        : apiFetch(`/wishlist/${encodeURIComponent(id)}`, { method: "DELETE" });
      request.catch(() => {});
    }
    return next.saved;
  }, []);
  return { ids, has, toggle };
}
