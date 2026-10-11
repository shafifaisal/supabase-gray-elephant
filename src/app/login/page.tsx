import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";

import { AuthForm } from "@/components/auth/auth-form";
import { EmailField, PasswordField } from "@/components/auth/fields";
import { BrandMark } from "@/components/layout/nav-links";
import { getSessionUser } from "@/lib/auth/session";

import { loginAction } from "./actions";

export const metadata: Metadata = {
  title: "Sign in",
  description: "Administrator sign-in.",
  robots: { index: false, follow: false },
};

/**
 * Reads the session cookie to skip the form for signed-in users, so this
 * route must not be prerendered. See Next 16 `cacheComponents`.
 */

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ next?: string }>;
}) {
  const { next } = await searchParams;

  // Already signed in? Skip the form.
  const user = await getSessionUser();
  if (user) {
    redirect(next && next.startsWith("/") && !next.startsWith("//") ? next : "/admin");
  }

  return (
    <div className="container-page flex min-h-[70vh] items-center justify-center py-16">
      <div className="w-full max-w-md">
        <div className="mb-8 text-center">
          <div className="mb-4 inline-flex items-center gap-2 rounded-full border border-border bg-secondary px-3 py-1 text-sm font-medium">
            <BrandMark className="h-4 w-4 text-primary" />
            iPassGenerator
          </div>
          <h1 className="text-3xl font-bold tracking-tight">
            Administrator sign in
          </h1>
          <p className="mt-2 text-sm text-muted-foreground">
            Access to this panel is restricted to authorised staff.
          </p>
        </div>

        <div className="rounded-[var(--radius-card)] border border-border bg-background p-6 shadow-sm">
          <AuthForm action={loginAction} label="Sign in">
            {next ? <input type="hidden" name="next" value={next} /> : null}
            <EmailField />
            <PasswordField />
          </AuthForm>
        </div>

        <p className="mt-6 text-center text-sm text-muted-foreground">
          <Link
            href="/auth/forgot-password"
            className="rounded underline underline-offset-2 hover:text-foreground"
          >
            Forgot your password?
          </Link>
        </p>
      </div>
    </div>
  );
}