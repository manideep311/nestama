"use client";

import { Fragment, useEffect, useRef, useState, type ReactNode } from "react";
import { Button } from "./Button";

/**
 * A row of actions ending in a destructive one that asks first: pressing it swaps the row for a
 * prompt with confirm and cancel. The confirm button is always a fresh element and focus moves to
 * the safe cancel (and back), so a double click or a repeated Enter never confirms by accident.
 */
export function InlineConfirm({
  children,
  action,
  prompt,
  cancelLabel,
  pending,
  onConfirm,
}: {
  /** The row's other actions, shown until the destructive one is pressed. */
  children?: ReactNode;
  /** Labels both the first button and the confirm, e.g. "Delete". */
  action: string;
  prompt: string;
  cancelLabel: string;
  pending: boolean;
  onConfirm: () => void;
}) {
  const [confirming, setConfirming] = useState(false);
  const askRef = useRef<HTMLButtonElement>(null);
  const cancelRef = useRef<HTMLButtonElement>(null);
  const toggled = useRef(false);

  useEffect(() => {
    if (toggled.current) (confirming ? cancelRef : askRef).current?.focus();
  }, [confirming]);

  const toggle = (next: boolean) => {
    toggled.current = true;
    setConfirming(next);
  };

  return confirming ? (
    <Fragment key="confirm">
      <span className="text-sm font-semibold text-charcoal">{prompt}</span>
      <Button size="sm" disabled={pending} onClick={onConfirm}>
        {action}
      </Button>
      <Button ref={cancelRef} size="sm" variant="ghost" onClick={() => toggle(false)}>
        {cancelLabel}
      </Button>
    </Fragment>
  ) : (
    <Fragment key="idle">
      {children}
      <Button ref={askRef} size="sm" variant="ghost" className="text-muted" onClick={() => toggle(true)}>
        {action}
      </Button>
    </Fragment>
  );
}
