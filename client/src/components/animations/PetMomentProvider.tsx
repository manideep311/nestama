"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { AnimatePresence, useReducedMotion } from "motion/react";
import * as m from "motion/react-m";
import { WaggingDogMascot } from "./WaggingDogMascot";

interface PetMomentApi {
  /** Show the wagging dog + speech bubble for a moment. No-op under reduced motion. */
  celebrate(message?: string): void;
}

const PetMomentContext = createContext<PetMomentApi | null>(null);

const DEFAULT_MESSAGE = "Good choice! Your furry friend will love this.";
const VISIBLE_MS = 1600;

/**
 * Layout-level overlay, so the moment keeps playing over the next page while navigation
 * proceeds — the dog never holds up the route change.
 */
export function PetMomentProvider({ children }: { children: ReactNode }) {
  const reduce = useReducedMotion();
  const [moment, setMoment] = useState<{ id: number; message: string } | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);

  const celebrate = useCallback(
    (message = DEFAULT_MESSAGE) => {
      if (reduce) return;
      clearTimeout(timer.current);
      setMoment((m) => ({ id: (m?.id ?? 0) + 1, message }));
      timer.current = setTimeout(() => setMoment(null), VISIBLE_MS);
    },
    [reduce],
  );

  useEffect(() => () => clearTimeout(timer.current), []);

  const api = useMemo(() => ({ celebrate }), [celebrate]);

  return (
    <PetMomentContext.Provider value={api}>
      {children}
      <div aria-hidden="true" className="pointer-events-none fixed bottom-0 left-0 z-[85] p-3 sm:p-5">
        <AnimatePresence>
          {moment && (
            <m.div
              key="pet-moment"
              className="flex items-end gap-1"
              initial={{ y: 90, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              exit={{ y: 90, opacity: 0, transition: { duration: 0.25, ease: [0.4, 0, 1, 1] } }}
              transition={{ type: "spring", stiffness: 420, damping: 26 }}
            >
              <WaggingDogMascot
                play={moment.id}
                size="md"
                className="-mb-3 size-16 drop-shadow-[0_8px_14px_rgb(18_61_47/0.25)] sm:size-24"
              />
              <m.p
                key={moment.id}
                initial={{ scale: 0.6, opacity: 0, originX: 0, originY: 1 }}
                animate={{ scale: 1, opacity: 1 }}
                transition={{ type: "spring", stiffness: 500, damping: 24, delay: 0.12 }}
                className="relative mb-12 max-w-[13rem] rounded-2xl rounded-bl-sm bg-white px-3.5 py-2.5 text-[13px] leading-snug font-bold text-forest shadow-lift ring-1 ring-line sm:mb-16 sm:max-w-[15rem] sm:text-sm"
              >
                {moment.message}
              </m.p>
            </m.div>
          )}
        </AnimatePresence>
      </div>
    </PetMomentContext.Provider>
  );
}

export function usePetMoment(): PetMomentApi {
  const ctx = useContext(PetMomentContext);
  if (!ctx) throw new Error("usePetMoment must be used inside <PetMomentProvider>");
  return ctx;
}
