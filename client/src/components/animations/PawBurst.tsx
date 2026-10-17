"use client";

import { AnimatePresence, useReducedMotion } from "motion/react";
import * as m from "motion/react-m";
import { PawIcon } from "@/components/ui/icons";
import { cn } from "@/lib/cn";

/**
 * A ring of small paw prints that pops outward once each time `trigger` increments.
 * Positioned absolutely at the centre of its (relatively positioned) parent.
 */
export function PawBurst({
  trigger,
  count = 7,
  radius = 40,
  className,
}: {
  trigger: number;
  count?: number;
  radius?: number;
  className?: string;
}) {
  // The wrapper renders either way: useReducedMotion() is unknown on the server, so returning null
  // here under reduced motion made the client's HTML differ from the server's (hydration error).
  const reduce = useReducedMotion();

  return (
    <span aria-hidden="true" className={cn("pointer-events-none absolute top-1/2 left-1/2 z-30 size-0", className)}>
      {!reduce && (
        <AnimatePresence>
          {trigger > 0 && (
            <m.span key={trigger} className="absolute inset-0" initial={{ opacity: 1 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
              {Array.from({ length: count }, (_, i) => {
                const angle = (i / count) * Math.PI * 2 - Math.PI / 2;
                const distance = radius * (i % 2 ? 0.8 : 1);
                return (
                  <m.span
                    key={i}
                    className="absolute -top-2 -left-2 text-orange"
                    initial={{ x: 0, y: 0, scale: 0.3, opacity: 0, rotate: 0 }}
                    animate={{
                      x: Math.cos(angle) * distance,
                      y: Math.sin(angle) * distance,
                      scale: [0.3, 1, 0.85],
                      opacity: [0, 1, 0],
                      rotate: (angle * 180) / Math.PI + 90,
                    }}
                    transition={{ duration: 0.65, ease: [0.2, 0.8, 0.2, 1], times: [0, 0.35, 1] }}
                  >
                    <PawIcon className="size-4" />
                  </m.span>
                );
              })}
            </m.span>
          )}
        </AnimatePresence>
      )}
    </span>
  );
}
