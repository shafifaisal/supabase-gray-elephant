import type { Metadata } from "next";
import { redirect } from "next/navigation";

import { AuthForm } from "@/components/auth/auth-form";
import { PasswordField } from "@/components/auth/fields";
import { createClient } from "@/lib/supabase/server";

import { resetPasswordAction } from "./actions";

export const metadata: Metadata = {
  title: "Choose a new password",
  robots: { index: false, follow: false },
};

/** Reads the recovery session cookie, so it cannot be prerendered. */

export default async function ResetPasswordPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  // Without a valid recovery session there is nothing to reset.
  if (!user) redirect("/auth/forgot-password");

  return (
    <div className="container-page flex min-h-[70vh] items-center justify-center py-16">
      <div className="w-full max-w-md">
        <h1 className="mb-2 text-3xl font-bold tracking-tight">
          Choose a new password
        </h1>
        <p className="mb-8 text-sm text-muted-foreground">
          Use at least 12 characters with upper case, lower case and a number.
        </p>

        <div className="rounded-[var(--radius-card)] border border-border bg-background p-6 shadow-sm">
          <AuthForm action={resetPasswordAction} label="Update password">
            <PasswordField id="password" label="New password" autoComplete="new-password" minLength={12} />
            <PasswordField id="confirmPassword" label="Confirm new password" autoComplete="new-password" minLength={12} />
          </AuthForm>
        </div>
      </div>
    </div>
  );
}