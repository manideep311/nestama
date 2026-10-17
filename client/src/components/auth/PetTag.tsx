import { useId } from "react";
import { cn } from "@/lib/cn";

export interface TagText {
  top: string;
  main: string;
  bottom: string;
}

/** Engraving size steps down so longer names still fit the disc. */
function mainSize(text: string) {
  if (text.length <= 7) return 25;
  if (text.length <= 10) return 20;
  return 16;
}

/**
 * An orange enamel collar tag hanging from a split ring — the auth pages' signature. It swings in
 * once on arrival (static under reduced motion) and is purely decorative for assistive tech.
 */
export function PetTag({ text, className }: { text: TagText; className?: string }) {
  const sheen = useId();
  const main = text.main.length > 13 ? `${text.main.slice(0, 12)}…` : text.main;
  return (
    <svg viewBox="0 0 200 250" className={cn("pet-tag", className)} aria-hidden="true">
      {/* split ring */}
      <circle cx="100" cy="26" r="17" fill="none" stroke="#E9D9B8" strokeWidth="5" />
      <circle
        cx="100"
        cy="26"
        r="17"
        fill="none"
        stroke="#FFF8EF"
        strokeWidth="1.5"
        strokeDasharray="20 87"
        strokeLinecap="round"
        opacity="0.8"
      />
      {/* tag body: metal rim, enamel face, highlight */}
      <circle cx="100" cy="140" r="86" fill="#E9D9B8" />
      <circle cx="100" cy="140" r="78" fill="#FF571F" />
      <circle cx="100" cy="140" r="78" fill={`url(#${sheen})`} />
      <circle cx="100" cy="60" r="9" fill="#123D2F" />
      <circle cx="100" cy="60" r="5" fill="#E9D9B8" />
      <defs>
        <radialGradient id={sheen} cx="0.32" cy="0.28" r="0.8">
          <stop offset="0" stopColor="#fff" stopOpacity="0.35" />
          <stop offset="0.45" stopColor="#fff" stopOpacity="0.04" />
          <stop offset="1" stopColor="#000" stopOpacity="0.12" />
        </radialGradient>
      </defs>
      {/* engraving */}
      <g fill="#FFF8EF" textAnchor="middle" style={{ fontFamily: "var(--font-display)" }}>
        <text x="100" y="106" fontSize="11" fontWeight="700" letterSpacing="4">
          {text.top}
        </text>
        <text key={main} className="pet-tag-name" x="100" y="148" fontSize={mainSize(main)} fontWeight="800" letterSpacing="1.5">
          {main.toUpperCase()}
        </text>
        <text x="100" y="178" fontSize="9.5" fontWeight="700" letterSpacing="2.6" opacity="0.92">
          {text.bottom}
        </text>
      </g>
      {/* tiny engraved paw */}
      <g fill="#FFF8EF" opacity="0.85" transform="translate(91 190) scale(0.75)">
        <ellipse cx="4" cy="7" rx="2.2" ry="2.8" />
        <ellipse cx="9" cy="3" rx="2.2" ry="2.8" />
        <ellipse cx="15" cy="3" rx="2.2" ry="2.8" />
        <ellipse cx="20" cy="7" rx="2.2" ry="2.8" />
        <path d="M12 9c-3 0-6.5 3.5-6.5 6.3 0 2 1.6 3 3.2 3 1.3 0 2-.7 3.3-.7s2 .7 3.3.7c1.6 0 3.2-1 3.2-3C18.5 12.5 15 9 12 9z" />
      </g>
    </svg>
  );
}
