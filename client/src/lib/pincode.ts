"use client";

import { useSyncExternalStore } from "react";

// Delivery pincode chosen by the shopper. Lives in localStorage (a per-browser convenience)
// and is shared across components through a tiny external store.

const KEY = "nst_pincode";
const EVENT = "nst:pincode";

export const PINCODE_PATTERN = /^[1-9][0-9]{5}$/;

function read(): string | null {
  try {
    return localStorage.getItem(KEY);
  } catch {
    return null;
  }
}

function subscribe(onChange: () => void) {
  window.addEventListener(EVENT, onChange);
  window.addEventListener("storage", onChange);
  return () => {
    window.removeEventListener(EVENT, onChange);
    window.removeEventListener("storage", onChange);
  };
}

export function savePincode(pincode: string) {
  try {
    localStorage.setItem(KEY, pincode);
  } catch {
    // Storage blocked (private mode) — the choice simply won't persist.
  }
  window.dispatchEvent(new Event(EVENT));
}

export function usePincode(): string | null {
  return useSyncExternalStore(subscribe, read, () => null);
}
