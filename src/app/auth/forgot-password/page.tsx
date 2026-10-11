import type { Metadata } from "next";

import { AuthForm } from "@/components/auth/auth-form";
import { EmailField } from "@/components/auth/fields";
import { forgotPasswordAction } from "@/app/login/actions";

export const metadata: Metadata = {
  title: "Reset your password",
  robots: { index: false, follow: false },
};

export default function ForgotPasswordPage() {
  return (
    <div className="container-page flex min-h-[70vh] items-center justify-center py-16">
      <div className="w-full max-w-md">
        <h1 className="mb-2 text-3xl font-bold tracking-tight">
          Reset your password
        </h1>
        <p className="mb-8 text-sm text-muted-foreground">
          Enter your email address and we&rsquo;ll send you a reset link.
        </p>

        <div className="rounded-[var(--radius-card)] border border-border bg-background p-6 shadow-sm">
          <AuthForm action={forgotPasswordAction} label="Send reset link">
            <EmailField />
          </AuthForm>
        </div>
      </div>
    </div>
  );
}