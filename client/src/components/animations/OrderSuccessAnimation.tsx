"use client";

import { useEffect, useState, type CSSProperties } from "react";
import { cn } from "@/lib/cn";
import { PawBurst } from "./PawBurst";
import { WaggingDogMascot } from "./WaggingDogMascot";

const COLORS = ["#FF571F", "#FFE3D2", "#E5EFE4", "#123D2F", "#FFB089", "#9CC3A0"];

// Fixed pieces (no randomness) so server and client render the same markup.
const PIECES = Array.from({ length: 16 }, (_, i) => {
  const angle = (i / 16) * Math.PI * 2 + (i % 3) * 0.18;
  const distance = 110 + (i % 4) * 26;
  return {
    dx: Math.round(Math.cos(angle) * distance),
    dy: Math.round(Math.sin(angle) * distance * 0.75 - 30),
    rot: (i * 67) % 360,
    color: COLORS[i % COLORS.length]!,
    round: i % 3 === 0,
    delay: (i % 5) * 40,
  };
});

/**
 * The paid-order celebration: the dog wags, and paw prints and confetti burst once.
 * Only ever mounted after the server confirms payment. Reduced motion: a still dog, no confetti.
 */
export function OrderSuccessAnimation({ className }: { className?: string }) {
  const [play, setPlay] = useState(0);
  useEffect(() => {
    const t = window.setTimeout(() => setPlay(1), 120);
    return () => window.clearTimeout(t);
  }, []);

  return (
    <div className={cn("relative mx-auto grid size-44 place-items-center", className)} aria-hidden="true">
      <span className="absolute inset-4 rounded-full bg-sage" />
      {play > 0 && (
        <span className="confetti pointer-events-none absolute top-1/2 left-1/2">
          {PIECES.map((p, i) => (
            <span
              key={i}
              className={cn("confetti-piece", p.round ? "size-2.5 rounded-full" : "h-3.5 w-2 rounded-[2px]")}
              style={
                {
                  "--dx": `${p.dx}px`,
                  "--dy": `${p.dy}px`,
                  "--rot": `${p.rot}deg`,
                  background: p.color,
                  animationDelay: `${p.delay}ms`,
                } as CSSProperties
              }
            />
          ))}
        </span>
      )}
      <PawBurst trigger={play} count={10} radius={96} />
      <WaggingDogMascot play={play} size="lg" className="relative" />
    </div>
  );
}
