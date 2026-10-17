"use client";

import { useId, useState } from "react";
import { Check, Loader2 } from "lucide-react";

type State = { status: "idle" | "loading" } | { status: "done"; message: string } | { status: "error"; message: string };

// A quick shape check only: the API validates properly. (Importing the shared Zod schema here put Zod
// in every page's bundle, because the footer renders this form everywhere.)
const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
const INVALID = "Enter a valid email address, like name@example.com.";

export function NewsletterForm() {
  const [email, setEmail] = useState("");
  const [state, setState] = useState<State>({ status: "idle" });
  const id = useId();

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    const value = email.trim().toLowerCase();
    if (!EMAIL.test(value) || value.length > 254) {
      setState({ status: "error", message: INVALID });
      return;
    }
    setState({ status: "loading" });
    try {
      const res = await fetch("/api/v1/newsletter", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ email: value }),
      });
      if (res.status === 400) {
        setState({ status: "error", message: INVALID });
        return;
      }
      if (!res.ok) throw new Error(String(res.status));
      const body = (await res.json()) as { alreadySubscribed: boolean };
      setState({
        status: "done",
        message: body.alreadySubscribed
          ? "You're already on the list — thanks for being part of the pack."
          : "You're in! Look out for pet care tips and early offers.",
      });
      setEmail("");
    } catch {
      setState({ status: "error", message: "We couldn't subscribe you just now. Check your connection and try again." });
    }
  }

  return (
    <form onSubmit={onSubmit} noValidate className="w-full max-w-md">
      <label htmlFor={id} className="sr-only">
        Email address
      </label>
      <div className="flex rounded-full bg-white p-1.5 shadow-card has-[input:focus-visible]:outline-2 has-[input:focus-visible]:outline-offset-3 has-[input:focus-visible]:outline-orange">
        <input
          id={id}
          type="email"
          autoComplete="email"
          value={email}
          onChange={(e) => {
            setEmail(e.target.value);
            if (state.status === "error") setState({ status: "idle" });
          }}
          placeholder="Your email address"
          aria-invalid={state.status === "error"}
          aria-describedby={`${id}-status`}
          className="min-w-0 flex-1 rounded-full bg-transparent px-4 text-[15px] text-charcoal outline-none placeholder:text-muted"
        />
        <button
          type="submit"
          disabled={state.status === "loading"}
          className="inline-flex h-11 items-center gap-2 rounded-full bg-ember px-5 text-sm font-bold text-white transition-colors hover:bg-ember-hover disabled:opacity-70"
        >
          {state.status === "loading" && <Loader2 className="size-4 animate-spin" aria-hidden="true" />}
          Subscribe
        </button>
      </div>
      <p id={`${id}-status`} role="status" className="mt-2 min-h-5 text-sm">
        {state.status === "done" && (
          <span className="inline-flex items-center gap-1.5 text-peach">
            <Check className="size-4" aria-hidden="true" /> {state.message}
          </span>
        )}
        {state.status === "error" && <span className="text-peach">{state.message}</span>}
      </p>
    </form>
  );
}
