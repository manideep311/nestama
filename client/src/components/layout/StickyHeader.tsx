"use client";

import { useEffect, useState, type ReactNode } from "react";
import { cn } from "@/lib/cn";

/** Sticky header shell that gains a soft shadow once the page scrolls. */
export function StickyHeader({ children }: { children: ReactNode }) {
  const [scrolled, setScrolled] = useState(false);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 8);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  return (
    <header
      // Anchored during route view transitions so only page content moves.
      style={{ viewTransitionName: "site-header" }}
      className={cn(
        "sticky top-0 z-50 bg-cream/92 backdrop-blur-md transition-shadow duration-300",
        scrolled ? "shadow-[0_8px_30px_-16px_rgb(18_61_47/0.35)]" : "shadow-none",
      )}
    >
      {children}
    </header>
  );
}
