import { cn } from "@/lib/cn";

/**
 * NESTAMA's golden dog mascot (flat SVG, brand palette). The tail is its own group so it can
 * wag independently; add `wagging` to play the 3-wag sequence once (see animations.css).
 */
export function DogMascot({ wagging = false, className, title }: { wagging?: boolean; className?: string; title?: string }) {
  return (
    <svg
      viewBox="0 0 140 140"
      className={cn("dog-mascot overflow-visible", wagging && "is-wagging", className)}
      role={title ? "img" : undefined}
      aria-label={title}
      aria-hidden={title ? undefined : true}
    >
      {/* Tail (behind the body) */}
      <g className="dog-tail" style={{ transformOrigin: "96px 104px" }}>
        <path d="M95 106c9-1 18-6 22-15 3-7 3-14 1-20" fill="none" stroke="#D99549" strokeWidth="12" strokeLinecap="round" />
        <path d="M113 82c3-4 4-9 4-13" fill="none" stroke="#F2C48A" strokeWidth="5" strokeLinecap="round" />
      </g>

      <g className="dog-body">
        {/* Haunches + body */}
        <ellipse cx="70" cy="104" rx="35" ry="26" fill="#E7A65A" />
        <ellipse cx="41" cy="121" rx="13" ry="8" fill="#D99549" />
        <ellipse cx="99" cy="121" rx="13" ry="8" fill="#D99549" />
        {/* Chest */}
        <ellipse cx="70" cy="97" rx="17" ry="22" fill="#FBE3C0" />
        {/* Front legs + paws */}
        <rect x="55" y="100" width="12" height="28" rx="6" fill="#E7A65A" />
        <rect x="73" y="100" width="12" height="28" rx="6" fill="#E7A65A" />
        <ellipse cx="61" cy="128" rx="8.5" ry="5" fill="#FBE3C0" />
        <ellipse cx="79" cy="128" rx="8.5" ry="5" fill="#FBE3C0" />

        {/* Collar + tag */}
        <path d="M51 71q19 9 38 0v7q-19 9-38 0z" fill="#123D2F" />
        <circle cx="70" cy="84" r="4.5" fill="#FF571F" />
        <circle cx="70" cy="84" r="1.6" fill="#FFE3D2" />

        {/* Head */}
        <g className="dog-head" style={{ transformOrigin: "70px 70px" }}>
          <ellipse cx="70" cy="49" rx="25" ry="23" fill="#E7A65A" />
          <ellipse cx="70" cy="38" rx="12" ry="7" fill="#F0B56E" opacity="0.7" />
          {/* Floppy ears */}
          <path d="M50 33c-12 0-18 16-14 30 2 8 12 6 14-2z" fill="#C9823A" />
          <path d="M90 33c12 0 18 16 14 30-2 8-12 6-14-2z" fill="#C9823A" />
          {/* Cheeks */}
          <circle cx="54" cy="57" r="4.5" fill="#FF8F6B" opacity="0.35" />
          <circle cx="86" cy="57" r="4.5" fill="#FF8F6B" opacity="0.35" />
          {/* Muzzle */}
          <ellipse cx="70" cy="60" rx="13.5" ry="10" fill="#FBE3C0" />
          <path d="M70 66q-5 10 4 9 4-1 3-9z" fill="#F28B82" />
          <path d="M70 58.5v4.5m-8 0q4 4.5 8 0 4 4.5 8 0" fill="none" stroke="#2A2420" strokeWidth="1.7" strokeLinecap="round" />
          <path d="M63.5 52.5q6.5-3.5 13 0-1 5.5-6.5 6-5.5-.5-6.5-6z" fill="#2A2420" />
          {/* Eyes */}
          <ellipse cx="60" cy="45" rx="3.3" ry="3.9" fill="#2A2420" />
          <ellipse cx="80" cy="45" rx="3.3" ry="3.9" fill="#2A2420" />
          <circle cx="61.1" cy="43.6" r="1.15" fill="#fff" />
          <circle cx="81.1" cy="43.6" r="1.15" fill="#fff" />
        </g>
      </g>
    </svg>
  );
}
