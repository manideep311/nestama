"use client";

import { Fragment, useEffect, useId, useRef, useState, type ReactNode } from "react";
import { X } from "lucide-react";
import { cn } from "@/lib/cn";

/** Matches the longest `.quick-view` exit transition (animations.css). */
const EXIT_MS = 340;

/**
 * A native modal `<dialog>` (focus trap, Escape and focus restore built in), styled like the quick
 * view: bottom sheet on phones, centred card from `md`. Content stays mounted through the closing
 * fade, then unmounts, and each opening mounts it afresh so forms start clean.
 */
export function Modal({
  open,
  onClose,
  title,
  children,
  size = "narrow",
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  children: ReactNode;
  size?: "narrow" | "wide";
}) {
  const ref = useRef<HTMLDialogElement>(null);
  const titleId = useId();
  const [mounted, setMounted] = useState(open);
  const [session, setSession] = useState(0);
  const [wasOpen, setWasOpen] = useState(open);
  if (open !== wasOpen) {
    setWasOpen(open);
    if (open) {
      setMounted(true);
      setSession((s) => s + 1);
    }
  }

  useEffect(() => {
    const dialog = ref.current;
    if (!dialog) return;
    if (open) {
      if (!dialog.open) dialog.showModal();
      return;
    }
    // Only unmount after a fade we started. A dialog already closed by Escape keeps its content
    // mounted while hidden, which is harmless: the next opening remounts it.
    if (!dialog.open) return;
    dialog.close();
    const timer = window.setTimeout(() => setMounted(false), EXIT_MS);
    return () => window.clearTimeout(timer);
  }, [open]);

  return (
    <dialog
      ref={ref}
      aria-labelledby={titleId}
      onClose={onClose}
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
      className={cn("quick-view bg-cream text-charcoal shadow-lift", size === "narrow" && "dialog-narrow")}
    >
      <div className="p-5 sm:p-7">
        <div className="mb-5 flex items-start justify-between gap-4">
          <h2 id={titleId} className="text-2xl font-extrabold">
            {title}
          </h2>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="-mt-1 -mr-1 grid size-10 shrink-0 place-items-center rounded-full bg-white text-forest shadow-card hover:bg-sage"
          >
            <X className="size-5" aria-hidden="true" />
          </button>
        </div>
        {mounted && <Fragment key={session}>{children}</Fragment>}
      </div>
    </dialog>
  );
}

/**
 * What a modal is showing, kept through the closing fade so its title and form don't flip to the
 * empty state while they're still visible.
 */
export function useModalTarget<T>() {
  const [state, setState] = useState<{ open: boolean; target: T | null }>({ open: false, target: null });
  return {
    open: state.open,
    target: state.target,
    show: (target: T) => setState({ open: true, target }),
    close: () => setState((s) => ({ ...s, open: false })),
  };
}
