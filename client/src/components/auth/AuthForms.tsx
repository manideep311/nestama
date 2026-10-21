"use client";

import { useState, type FormEvent } from "react";
import dynamic from "next/dynamic";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { ArrowRight, CheckCircle2, Loader2, MailCheck } from "lucide-react";
import { authClient, authErrorMessage, reloadTo, useSession } from "@/lib/auth-client";
import { afterSignIn, safeNext } from "@/lib/safe-next";
import { Button, ButtonLink, buttonClasses } from "@/components/ui/Button";
import { FormAlert, PasswordField, TextField } from "@/components/ui/Field";
import { useEngraveName } from "./AuthShell";

// Only needed after an account exists, so the form (and its validation schema) loads on demand
// instead of weighing down the sign-in and sign-up pages.
const PetForm = dynamic(() => import("@/components/pets/PetForm").then((m) => m.PetForm), {
  loading: () => <div className="h-96 skeleton rounded-2xl" aria-busy="true" />,
});

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function Heading({ title, children }: { title: string; children?: React.ReactNode }) {
  return (
    <header className="mb-7">
      <h1 className="text-3xl font-extrabold sm:text-4xl">{title}</h1>
      {children && <p className="mt-2 text-[15px] text-muted">{children}</p>}
    </header>
  );
}

function SubmitButton({ pending, children }: { pending: boolean; children: React.ReactNode }) {
  return (
    <Button type="submit" size="lg" className="mt-2 w-full" disabled={pending} aria-busy={pending || undefined}>
      {pending ? <Loader2 className="size-5 animate-spin" aria-hidden="true" /> : null}
      {children}
    </Button>
  );
}

/** Shown on /login and /register when a session already exists. */
function AlreadySignedIn({ name, next }: { name: string; next: string }) {
  // A plain link, not <Link>: the router may hold a prefetch of `next` from before signing in.
  const [leaving, setLeaving] = useState(false);
  return (
    <div>
      <Heading title="You’re signed in">You’re signed in as {name}.</Heading>
      <div className="flex flex-wrap gap-3">
        <a href={next} className={buttonClasses({ size: "lg" })}>
          Continue <ArrowRight className="size-5" aria-hidden="true" />
        </a>
        <Button
          variant="outline"
          size="lg"
          disabled={leaving}
          onClick={async () => {
            setLeaving(true);
            await authClient.signOut();
            setLeaving(false);
          }}
        >
          Sign out
        </Button>
      </div>
    </div>
  );
}

export function LoginForm() {
  const params = useSearchParams();
  const next = safeNext(params.get("next"));
  const session = useSession();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [errors, setErrors] = useState<{ email?: string; password?: string }>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  if (session.data && !pending) {
    return <AlreadySignedIn name={session.data.user.name} next={afterSignIn(params.get("next"), session.data.user.role)} />;
  }

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    const found = {
      email: EMAIL.test(email.trim()) ? undefined : "Enter the email you signed up with.",
      password: password ? undefined : "Enter your password.",
    };
    setErrors(found);
    if (found.email || found.password) return;

    setPending(true);
    setFormError(null);
    const { data, error } = await authClient.signIn.email({ email: email.trim(), password, rememberMe: true });
    if (error) {
      setPending(false);
      setFormError(authErrorMessage(error));
      return;
    }
    reloadTo(afterSignIn(params.get("next"), data?.user.role));
  }

  const registerHref = `/register${next !== "/account" ? `?next=${encodeURIComponent(next)}` : ""}`;

  return (
    <div>
      <Heading title="Sign in">Welcome back to the pack.</Heading>
      <form onSubmit={onSubmit} noValidate className="space-y-4">
        {formError && <FormAlert>{formError}</FormAlert>}
        <TextField
          label="Email"
          type="email"
          name="email"
          autoComplete="email"
          inputMode="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          error={errors.email}
          required
        />
        <PasswordField
          label="Password"
          name="password"
          autoComplete="current-password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          error={errors.password}
          required
        />
        <p className="-mt-1 text-right text-sm">
          <Link href="/forgot-password" className="font-semibold text-orange-ink underline-offset-4 hover:underline">
            Forgot password?
          </Link>
        </p>
        <SubmitButton pending={pending}>Sign in</SubmitButton>
      </form>
      <p className="mt-6 text-center text-sm text-muted">
        New to NESTAMA?{" "}
        <Link href={registerHref} className="font-bold text-forest underline-offset-4 hover:underline">
          Create an account
        </Link>
      </p>
    </div>
  );
}

/** Sign-up step 2 (optional): the shopper's first pet, so recommendations start right away. */
function PetStep({ next }: { next: string }) {
  return (
    <div>
      <Heading title="Tell us about your pet">
        We&apos;ll pick food, toys and gear that suit them. You can add more pets from your account any time.
      </Heading>
      <PetForm
        submitLabel="Save and continue"
        onSaved={() => reloadTo(next)}
        secondary={
          <Button variant="ghost" onClick={() => reloadTo(next)}>
            Skip for now
          </Button>
        }
      />
    </div>
  );
}

export function RegisterForm() {
  const params = useSearchParams();
  const next = safeNext(params.get("next"));
  const session = useSession();
  const engrave = useEngraveName();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [errors, setErrors] = useState<{ name?: string; email?: string; password?: string }>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  const [step, setStep] = useState<"account" | "pet">("account");

  // Checked before the signed-in screen: the new account is signed in by the time step 2 shows.
  if (step === "pet") return <PetStep next={next} />;
  if (session.data && !pending) return <AlreadySignedIn name={session.data.user.name} next={next} />;

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    const trimmed = name.trim();
    const found = {
      name: trimmed.length >= 2 ? undefined : "Enter your name.",
      email: EMAIL.test(email.trim()) ? undefined : "Enter a valid email address.",
      password: password.length >= 8 ? undefined : "Use at least 8 characters.",
    };
    setErrors(found);
    if (found.name || found.email || found.password) return;

    setPending(true);
    setFormError(null);
    const { error } = await authClient.signUp.email({ name: trimmed, email: email.trim(), password });
    setPending(false);
    if (error) {
      setFormError(authErrorMessage(error));
      return;
    }
    setStep("pet");
  }

  const loginHref = `/login${next !== "/account" ? `?next=${encodeURIComponent(next)}` : ""}`;

  return (
    <div>
      <Heading title="Create your account">Save addresses, track orders and keep your wishlist on every device.</Heading>
      <form onSubmit={onSubmit} noValidate className="space-y-4">
        {formError && <FormAlert>{formError}</FormAlert>}
        <TextField
          label="Your name"
          name="name"
          autoComplete="name"
          value={name}
          maxLength={60}
          onChange={(e) => {
            setName(e.target.value);
            engrave(e.target.value);
          }}
          error={errors.name}
          required
        />
        <TextField
          label="Email"
          type="email"
          name="email"
          autoComplete="email"
          inputMode="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          error={errors.email}
          required
        />
        <PasswordField
          label="Password"
          name="password"
          autoComplete="new-password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          error={errors.password}
          hint="At least 8 characters."
          required
        />
        <SubmitButton pending={pending}>Create account</SubmitButton>
      </form>
      <p className="mt-6 text-center text-sm text-muted">
        Already have an account?{" "}
        <Link href={loginHref} className="font-bold text-forest underline-offset-4 hover:underline">
          Sign in
        </Link>
      </p>
    </div>
  );
}

export function ForgotPasswordForm() {
  const [email, setEmail] = useState("");
  const [error, setError] = useState<string | undefined>();
  const [formError, setFormError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  const [sentTo, setSentTo] = useState<string | null>(null);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    if (!EMAIL.test(email.trim())) {
      setError("Enter the email you signed up with.");
      return;
    }
    setError(undefined);
    setPending(true);
    setFormError(null);
    const { error: apiError } = await authClient.requestPasswordReset({ email: email.trim(), redirectTo: "/reset-password" });
    setPending(false);
    if (apiError) setFormError(authErrorMessage(apiError));
    else setSentTo(email.trim());
  }

  if (sentTo) {
    return (
      <div role="status">
        <MailCheck className="mb-4 size-10 text-forest" aria-hidden="true" />
        <Heading title="Check your inbox">
          If an account exists for <strong className="text-charcoal">{sentTo}</strong>, a reset link is on its way. It works for one hour.
        </Heading>
        {process.env.NODE_ENV !== "production" && (
          <p className="rounded-2xl bg-sage/70 px-4 py-3 text-sm text-forest">
            Running NESTAMA locally? The link is printed in the API server’s console.
          </p>
        )}
        <p className="mt-6 text-sm text-muted">
          <Link href="/login" className="font-bold text-forest underline-offset-4 hover:underline">
            Back to sign in
          </Link>
        </p>
      </div>
    );
  }

  return (
    <div>
      <Heading title="Reset your password">Enter the email you signed up with and we’ll send you a link to choose a new password.</Heading>
      <form onSubmit={onSubmit} noValidate className="space-y-4">
        {formError && <FormAlert>{formError}</FormAlert>}
        <TextField
          label="Email"
          type="email"
          name="email"
          autoComplete="email"
          inputMode="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          error={error}
          required
        />
        <SubmitButton pending={pending}>Send reset link</SubmitButton>
      </form>
      <p className="mt-6 text-center text-sm text-muted">
        Remembered it?{" "}
        <Link href="/login" className="font-bold text-forest underline-offset-4 hover:underline">
          Sign in
        </Link>
      </p>
    </div>
  );
}

export function ResetPasswordForm() {
  const params = useSearchParams();
  const token = params.get("token");
  const linkError = params.get("error");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | undefined>();
  const [formError, setFormError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  const [done, setDone] = useState(false);

  if (!token || linkError) {
    return (
      <div>
        <Heading title="This link has expired">
          Reset links work once, for one hour. Request a new one and we’ll send it straight away.
        </Heading>
        <ButtonLink href="/forgot-password" size="lg">
          Request a new link
        </ButtonLink>
      </div>
    );
  }

  if (done) {
    return (
      <div role="status">
        <CheckCircle2 className="mb-4 size-10 text-forest" aria-hidden="true" />
        <Heading title="Password updated">Sign in with your new password. For your security, other devices have been signed out.</Heading>
        <ButtonLink href="/login" size="lg">
          Sign in
        </ButtonLink>
      </div>
    );
  }

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    if (password.length < 8) {
      setError("Use at least 8 characters.");
      return;
    }
    setError(undefined);
    setPending(true);
    setFormError(null);
    const { error: apiError } = await authClient.resetPassword({ newPassword: password, token: token! });
    setPending(false);
    if (apiError) setFormError(authErrorMessage(apiError));
    else setDone(true);
  }

  return (
    <div>
      <Heading title="Choose a new password">Pick something you haven’t used here before.</Heading>
      <form onSubmit={onSubmit} noValidate className="space-y-4">
        {formError && <FormAlert>{formError}</FormAlert>}
        <PasswordField
          label="New password"
          name="new-password"
          autoComplete="new-password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          error={error}
          hint="At least 8 characters."
          required
        />
        <SubmitButton pending={pending}>Save new password</SubmitButton>
      </form>
    </div>
  );
}

/** Same footprint as the forms, so the card doesn't jump while search params resolve. */
export function AuthFormSkeleton() {
  return (
    <div aria-hidden="true" className="space-y-4">
      <div className="h-9 w-48 skeleton rounded-xl" />
      <div className="h-4 w-64 skeleton rounded-full" />
      <div className="mt-6 h-12 w-full skeleton rounded-xl" />
      <div className="h-12 w-full skeleton rounded-xl" />
      <div className="h-13 w-full skeleton rounded-full" />
    </div>
  );
}
