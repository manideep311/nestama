import { Suspense } from "react";
import type { Metadata } from "next";
import { PageTransition } from "@/components/layout/PageTransition";
import { AuthShell } from "@/components/auth/AuthShell";
import { AuthFormSkeleton, RegisterForm } from "@/components/auth/AuthForms";

export const metadata: Metadata = { title: "Create your account", robots: { index: false } };

export default function RegisterPage() {
  return (
    <PageTransition>
      <AuthShell variant="register">
        <Suspense fallback={<AuthFormSkeleton />}>
          <RegisterForm />
        </Suspense>
      </AuthShell>
    </PageTransition>
  );
}
