import { ViewTransition, type ReactNode } from "react";

/**
 * Wraps a page's content so route changes fade + rise (≈200 ms) while the header stays put.
 * Put it in each page.tsx — layouts persist, so enter/exit never fire there.
 */
export function PageTransition({ children }: { children: ReactNode }) {
  return (
    <ViewTransition enter="page-in" exit="page-out" default="none">
      <div>{children}</div>
    </ViewTransition>
  );
}
