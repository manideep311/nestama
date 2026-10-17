import { cn } from "@/lib/cn";
import { DogMascot } from "./DogMascot";

/** A puppy peering into an empty food bowl (one gentle head tilt; static under reduced motion). */
export function EmptyCartIllustration({ className }: { className?: string }) {
  return (
    <div className={cn("empty-cart relative mx-auto flex h-40 w-64 items-end justify-center", className)} aria-hidden="true">
      <DogMascot className="relative z-10 -mr-6 size-36" />
      <svg viewBox="0 0 120 70" className="relative z-20 mb-1 w-28">
        {/* empty bowl */}
        <ellipse cx="60" cy="62" rx="52" ry="6" fill="#123D2F" opacity="0.08" />
        <path d="M10 26h100l-10 30q-2 8-12 8H32q-10 0-12-8z" fill="#FF571F" />
        <path d="M10 26h100l-2.5 7.5H12.5z" fill="#D43F0A" opacity="0.35" />
        <ellipse cx="60" cy="26" rx="50" ry="9" fill="#FF7A4D" />
        <ellipse cx="60" cy="27" rx="42" ry="6" fill="#FFE3D2" />
        {/* a lonely crumb */}
        <circle cx="74" cy="27.5" r="1.6" fill="#C9823A" />
        {/* paw on the bowl */}
        <g fill="#FFF8EF" opacity="0.9" transform="translate(51 38) scale(0.75)">
          <ellipse cx="4" cy="7" rx="2.2" ry="2.8" />
          <ellipse cx="9" cy="3" rx="2.2" ry="2.8" />
          <ellipse cx="15" cy="3" rx="2.2" ry="2.8" />
          <ellipse cx="20" cy="7" rx="2.2" ry="2.8" />
          <path d="M12 9c-3 0-6.5 3.5-6.5 6.3 0 2 1.6 3 3.2 3 1.3 0 2-.7 3.3-.7s2 .7 3.3.7c1.6 0 3.2-1 3.2-3C18.5 12.5 15 9 12 9z" />
        </g>
      </svg>
    </div>
  );
}
