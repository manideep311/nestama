import type { SVGProps } from "react";

export type SocialName = "instagram" | "facebook" | "youtube" | "x";

const paths: Record<SocialName, React.ReactNode> = {
  instagram: (
    <>
      <rect x="3" y="3" width="18" height="18" rx="5" fill="none" stroke="currentColor" strokeWidth="2" />
      <circle cx="12" cy="12" r="4" fill="none" stroke="currentColor" strokeWidth="2" />
      <circle cx="17.3" cy="6.7" r="1.2" fill="currentColor" />
    </>
  ),
  facebook: (
    <path
      fill="currentColor"
      d="M13.5 21v-7.5h2.5l.4-3h-2.9V8.6c0-.9.3-1.5 1.5-1.5h1.5V4.4c-.3 0-1.2-.1-2.2-.1-2.2 0-3.8 1.4-3.8 3.9v2.3H8v3h2.5V21h3Z"
    />
  ),
  youtube: (
    <>
      <rect x="2.5" y="5.5" width="19" height="13" rx="4" fill="none" stroke="currentColor" strokeWidth="2" />
      <path fill="currentColor" d="m10 9.2 5 2.8-5 2.8V9.2Z" />
    </>
  ),
  x: (
    <path
      fill="currentColor"
      d="M17.5 3.5h3l-6.6 7.5 7.8 9.5h-6.1l-4.8-5.9-5.4 5.9H2.4l7-7.9L2 3.5h6.2l4.3 5.4 5-5.4Zm-1 15.3h1.7L7.6 5.1H5.8l10.7 13.7Z"
    />
  ),
};

export function SocialIcon({ name, ...props }: { name: SocialName } & SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" {...props}>
      {paths[name]}
    </svg>
  );
}
