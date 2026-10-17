import type { SVGProps } from "react";

/** Brand paw print. Uses currentColor so it inherits text colour. */
export function PawIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true" {...props}>
      <ellipse cx="5.2" cy="10.2" rx="2.3" ry="2.9" transform="rotate(-18 5.2 10.2)" />
      <ellipse cx="9.4" cy="5.6" rx="2.3" ry="3" transform="rotate(-6 9.4 5.6)" />
      <ellipse cx="14.6" cy="5.6" rx="2.3" ry="3" transform="rotate(6 14.6 5.6)" />
      <ellipse cx="18.8" cy="10.2" rx="2.3" ry="2.9" transform="rotate(18 18.8 10.2)" />
      <path d="M12 11.2c-2.9 0-6.4 3.6-6.4 6.5 0 2 1.6 3 3.2 3 1.3 0 2.1-.7 3.2-.7s1.9.7 3.2.7c1.6 0 3.2-1 3.2-3 0-2.9-3.5-6.5-6.4-6.5Z" />
    </svg>
  );
}

/** Small curl of yarn — the brand's signature thread, used beside section eyebrows. */
export function YarnCurl(props: SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 40 16" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" aria-hidden="true" {...props}>
      <path d="M1.5 11c5-.5 7.5-8.5 12.5-8.5 4 0 3.5 5.5.5 5.5s-2-6 3.5-6c5 0 6 10 11 10 3.4 0 5-2.6 9.5-3.5" />
    </svg>
  );
}

/** Hand-drawn yarn underline for display headlines. Draws itself in when `animate` is set. */
export function YarnUnderline({ animate = false, ...props }: SVGProps<SVGSVGElement> & { animate?: boolean }) {
  return (
    <svg viewBox="0 0 320 24" fill="none" preserveAspectRatio="none" aria-hidden="true" {...props}>
      <path
        d="M3 15c38-7 77-11 117-9 22 1 30 7 21 9-10 2-12-8 7-10 40-4 99 3 169 1"
        stroke="currentColor"
        strokeWidth="5"
        strokeLinecap="round"
        strokeLinejoin="round"
        pathLength={1}
        className={animate ? "yarn-draw" : undefined}
      />
    </svg>
  );
}

export function HeartDoodle(props: SVGProps<SVGSVGElement>) {
  return (
    <svg
      viewBox="0 0 32 30"
      fill="none"
      stroke="currentColor"
      strokeWidth="2.4"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      {...props}
    >
      <path d="M16 27C9 21.5 3 16.6 3 10.2 3 6.3 6 3 9.8 3c2.7 0 4.9 1.6 6.2 4 1.3-2.4 3.5-4 6.2-4C26 3 29 6.3 29 10.2c0 6.4-6 11.3-13 16.8Z" />
    </svg>
  );
}
