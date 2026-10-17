/**
 * Inline script that runs during HTML parsing (before first paint) on full page loads.
 * Rendered as text/plain on the client so React doesn't warn or re-run it.
 */
export function InlineScript({ html }: { html: string }) {
  return (
    <script
      type={typeof window === "undefined" ? "text/javascript" : "text/plain"}
      suppressHydrationWarning
      dangerouslySetInnerHTML={{ __html: html }}
    />
  );
}
