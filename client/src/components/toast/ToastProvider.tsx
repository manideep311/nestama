"use client";

import { createContext, useCallback, useContext, useMemo, useRef, useState, type ReactNode } from "react";
import { Toaster } from "./Toaster";

export type ToastIcon = "paw" | "heart" | "cart" | "check" | "alert";

export interface ToastAction {
  label: string;
  onClick?: () => void;
  href?: string;
}

export interface ToastInput {
  title: string;
  description?: string;
  icon?: ToastIcon;
  actions?: ToastAction[];
  /** Milliseconds before auto-dismiss. Default 4000. */
  duration?: number;
}

export interface Toast extends ToastInput {
  id: string;
}

interface ToastApi {
  show(toast: ToastInput): string;
  dismiss(id: string): void;
}

const ToastContext = createContext<ToastApi | null>(null);

const MAX_VISIBLE = 3;

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);
  const counter = useRef(0);

  const dismiss = useCallback((id: string) => {
    setToasts((list) => list.filter((t) => t.id !== id));
  }, []);

  const show = useCallback((toast: ToastInput) => {
    const id = `toast-${++counter.current}`;
    setToasts((list) => [...list, { ...toast, id }].slice(-MAX_VISIBLE));
    return id;
  }, []);

  const api = useMemo(() => ({ show, dismiss }), [show, dismiss]);

  return (
    <ToastContext.Provider value={api}>
      {children}
      <Toaster toasts={toasts} onDismiss={dismiss} />
    </ToastContext.Provider>
  );
}

export function useToast(): ToastApi {
  const ctx = useContext(ToastContext);
  if (!ctx) throw new Error("useToast must be used inside <ToastProvider>");
  return ctx;
}
