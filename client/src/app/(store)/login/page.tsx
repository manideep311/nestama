import { Suspense } from "react";
import type { Metadata } from "next";
import { PageTransition } from "@/components/layout/PageTransition";
import { AuthShell } from "@/components/auth/AuthShell";
import { AuthFormSkeleton, LoginForm } from "@/components/auth/AuthForms";

export const metadata: Metadata = { title: "Sign in", robots: { index: false } };

export default function LoginPage() {
  return (
    <PageTransition>
      <AuthShell variant="signin">
        <Suspense fallback={<AuthFormSkeleton />}>
          <LoginForm />
        </Suspense>
      </AuthShell>
    </PageTransition>
  );
}
