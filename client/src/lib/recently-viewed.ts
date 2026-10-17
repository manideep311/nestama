"use client";

import { useSyncExternalStore } from "react";
import { parseList } from "./wishlist-store";

// Recently viewed product ids, newest first (localStorage — a per-browser convenience).

export const MAX_RECENT = 12;
const KEY = "nst_recent";
const EVENT = "nst:recent";
const EMPTY: string[] = [];

export function pushRecent(list: string[], id: string): string[] {
  return [id, ...list.filter((x) => x !== id)].slice(0, MAX_RECENT);
}

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

export function recordView(id: string) {
  try {
    localStorage.setItem(KEY, JSON.stringify(pushRecent(snapshot(), id)));
    window.dispatchEvent(new Event(EVENT));
  } catch {
    // Storage unavailable — nothing to remember.
  }
}

export function useRecentlyViewed(): string[] {
  return useSyncExternalStore(subscribe, snapshot, () => EMPTY);
}
