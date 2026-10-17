import { Suspense } from "react";
import type { Metadata } from "next";
import { PageTransition } from "@/components/layout/PageTransition";
import { AuthShell } from "@/components/auth/AuthShell";
import { AuthFormSkeleton, ResetPasswordForm } from "@/components/auth/AuthForms";

export const metadata: Metadata = { title: "Choose a new password", robots: { index: false } };

export default function ResetPasswordPage() {
  return (
    <PageTransition>
      <AuthShell variant="recover">
        <Suspense fallback={<AuthFormSkeleton />}>
          <ResetPasswordForm />
        </Suspense>
      </AuthShell>
    </PageTransition>
  );
}
