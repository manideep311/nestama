"use client";

import { useId, useState, type ComponentProps, type ReactNode } from "react";
import { Eye, EyeOff } from "lucide-react";
import { cn } from "@/lib/cn";

export const inputClasses = cn(
  "h-12 w-full rounded-xl border border-line bg-white px-4 text-[15px] text-charcoal outline-none placeholder:text-muted/70",
  "transition-[border-color,box-shadow] focus:border-forest/50 focus:shadow-[0_0_0_4px_rgb(18_61_47/0.08)]",
  "aria-[invalid=true]:border-ember aria-[invalid=true]:focus:shadow-[0_0_0_4px_rgb(212_63_10/0.12)]",
  "disabled:bg-cream disabled:text-muted",
);

interface FieldShellProps {
  id: string;
  label: string;
  error?: string;
  hint?: ReactNode;
  optional?: boolean;
  className?: string;
  children: ReactNode;
}

function FieldShell({ id, label, error, hint, optional, className, children }: FieldShellProps) {
  return (
    <div className={className}>
      <label htmlFor={id} className="mb-1.5 flex items-baseline justify-between gap-3 text-sm font-bold text-forest">
        {label}
        {optional && <span className="text-xs font-semibold text-muted">Optional</span>}
      </label>
      {children}
      {error ? (
        <p id={`${id}-error`} className="mt-1.5 text-sm font-semibold text-orange-ink">
          {error}
        </p>
      ) : hint ? (
        <p id={`${id}-hint`} className="mt-1.5 text-xs text-muted">
          {hint}
        </p>
      ) : null}
    </div>
  );
}

function describedBy(id: string, error?: string, hint?: ReactNode) {
  return error ? `${id}-error` : hint ? `${id}-hint` : undefined;
}

type TextFieldProps = Omit<ComponentProps<"input">, "id"> & { label: string; error?: string; hint?: ReactNode; optional?: boolean };

export function TextField({ label, error, hint, optional, className, ...input }: TextFieldProps) {
  const id = useId();
  return (
    <FieldShell id={id} label={label} error={error} hint={hint} optional={optional} className={className}>
      <input
        id={id}
        aria-invalid={error ? true : undefined}
        aria-describedby={describedBy(id, error, hint)}
        className={inputClasses}
        {...input}
      />
    </FieldShell>
  );
}

/** Password input with a show/hide toggle (the toggle is a real button, announced as pressed). */
export function PasswordField({ label, error, hint, className, ...input }: TextFieldProps) {
  const id = useId();
  const [visible, setVisible] = useState(false);
  return (
    <FieldShell id={id} label={label} error={error} hint={hint} className={className}>
      <div className="relative">
        <input
          id={id}
          type={visible ? "text" : "password"}
          aria-invalid={error ? true : undefined}
          aria-describedby={describedBy(id, error, hint)}
          className={cn(inputClasses, "pr-12")}
          {...input}
        />
        <button
          type="button"
          onClick={() => setVisible((v) => !v)}
          aria-pressed={visible}
          aria-label="Show password"
          className="absolute top-1/2 right-1.5 grid size-9 -translate-y-1/2 place-items-center rounded-lg text-muted hover:bg-cream hover:text-forest"
        >
          {visible ? <EyeOff className="size-[18px]" aria-hidden="true" /> : <Eye className="size-[18px]" aria-hidden="true" />}
        </button>
      </div>
    </FieldShell>
  );
}

type SelectFieldProps = Omit<ComponentProps<"select">, "id"> & { label: string; error?: string; hint?: ReactNode };

export function SelectField({ label, error, hint, className, children, ...select }: SelectFieldProps) {
  const id = useId();
  return (
    <FieldShell id={id} label={label} error={error} hint={hint} className={className}>
      <select
        id={id}
        aria-invalid={error ? true : undefined}
        aria-describedby={describedBy(id, error, hint)}
        className={cn(inputClasses, "appearance-none bg-[length:16px] bg-[right_1rem_center] bg-no-repeat pr-10")}
        style={{
          backgroundImage:
            "url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24' fill='none' stroke='%23123D2F' stroke-width='2.5' stroke-linecap='round' stroke-linejoin='round'%3E%3Cpath d='m6 9 6 6 6-6'/%3E%3C/svg%3E\")",
        }}
        {...select}
      >
        {children}
      </select>
    </FieldShell>
  );
}

/** Server or form-level error, announced when it appears. */
export function FormAlert({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <div role="alert" className={cn("rounded-2xl bg-peach/70 px-4 py-3 text-sm font-semibold text-orange-ink", className)}>
      {children}
    </div>
  );
}
