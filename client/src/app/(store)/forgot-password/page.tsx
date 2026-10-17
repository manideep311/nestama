import type { Metadata } from "next";
import { PageTransition } from "@/components/layout/PageTransition";
import { AuthShell } from "@/components/auth/AuthShell";
import { ForgotPasswordForm } from "@/components/auth/AuthForms";

export const metadata: Metadata = { title: "Reset your password", robots: { index: false } };

export default function ForgotPasswordPage() {
  return (
    <PageTransition>
      <AuthShell variant="recover">
        <ForgotPasswordForm />
      </AuthShell>
    </PageTransition>
  );
}
