"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { AnimatePresence, useReducedMotion } from "motion/react";
import * as m from "motion/react-m";
import { AlertCircle, Check, Heart, ShoppingCart, X } from "lucide-react";
import { PawIcon } from "@/components/ui/icons";
import { cn } from "@/lib/cn";
import type { Toast, ToastIcon } from "./ToastProvider";

const icons: Record<ToastIcon, { node: React.ReactNode; tone: string }> = {
  paw: { node: <PawIcon className="size-5" />, tone: "bg-peach text-ember" },
  heart: { node: <Heart className="size-5 fill-current" aria-hidden="true" />, tone: "bg-peach text-orange" },
  cart: { node: <ShoppingCart className="size-5" aria-hidden="true" />, tone: "bg-sage text-forest" },
  check: { node: <Check className="size-5" aria-hidden="true" />, tone: "bg-sage text-forest" },
  alert: { node: <AlertCircle className="size-5" aria-hidden="true" />, tone: "bg-peach text-orange-ink" },
};

/** Polite live region with stacked toasts: bottom-centre on phones, bottom-right on larger screens. */
export function Toaster({ toasts, onDismiss }: { toasts: Toast[]; onDismiss: (id: string) => void }) {
  return (
    <div
      role="status"
      aria-live="polite"
      className="pointer-events-none fixed inset-x-0 bottom-0 z-[90] flex flex-col items-center gap-2 p-3 sm:items-end sm:p-5"
    >
      <AnimatePresence initial={false}>
        {toasts.map((t) => (
          <ToastCard key={t.id} toast={t} onDismiss={() => onDismiss(t.id)} />
        ))}
      </AnimatePresence>
    </div>
  );
}

function ToastCard({ toast, onDismiss }: { toast: Toast; onDismiss: () => void }) {
  const reduce = useReducedMotion();
  const [paused, setPaused] = useState(false);
  const remaining = useRef(toast.duration ?? 4000);
  const startedAt = useRef(0);

  useEffect(() => {
    if (paused) return;
    startedAt.current = Date.now();
    const timer = setTimeout(onDismiss, remaining.current);
    return () => {
      clearTimeout(timer);
      remaining.current -= Date.now() - startedAt.current;
    };
  }, [paused, onDismiss]);

  const icon = icons[toast.icon ?? "paw"];

  return (
    <m.div
      initial={reduce ? { opacity: 0 } : { opacity: 0, y: 24, scale: 0.96 }}
      animate={reduce ? { opacity: 1 } : { opacity: 1, y: 0, scale: 1 }}
      exit={reduce ? { opacity: 0 } : { opacity: 0, y: 12, scale: 0.98, transition: { duration: 0.18 } }}
      transition={{ type: "spring", stiffness: 420, damping: 32 }}
      onMouseEnter={() => setPaused(true)}
      onMouseLeave={() => setPaused(false)}
      onFocusCapture={() => setPaused(true)}
      onBlurCapture={() => setPaused(false)}
      className="pointer-events-auto flex w-full max-w-sm items-start gap-3 rounded-2xl bg-white p-3.5 pr-2.5 shadow-lift ring-1 ring-line"
    >
      <span className={cn("grid size-10 shrink-0 place-items-center rounded-xl", icon.tone)}>{icon.node}</span>
      <div className="min-w-0 flex-1 pt-0.5">
        <p className="font-bold text-forest">{toast.title}</p>
        {toast.description && <p className="mt-0.5 text-sm text-muted">{toast.description}</p>}
        {toast.actions && toast.actions.length > 0 && (
          <div className="mt-2 flex flex-wrap gap-3">
            {toast.actions.map((a) =>
              a.href ? (
                <Link key={a.label} href={a.href} onClick={onDismiss} className="text-sm font-bold text-orange-ink hover:text-forest">
                  {a.label}
                </Link>
              ) : (
                <button
                  key={a.label}
                  type="button"
                  onClick={() => {
                    a.onClick?.();
                    onDismiss();
                  }}
                  className="text-sm font-bold text-orange-ink hover:text-forest"
                >
                  {a.label}
                </button>
              ),
            )}
          </div>
        )}
      </div>
      <button type="button" onClick={onDismiss} className="grid size-8 shrink-0 place-items-center rounded-full text-muted hover:bg-cream">
        <X className="size-4" aria-hidden="true" />
        <span className="sr-only">Dismiss notification</span>
      </button>
    </m.div>
  );
}
