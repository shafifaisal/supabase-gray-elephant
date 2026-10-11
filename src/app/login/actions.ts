"use server";

import { redirect } from "next/navigation";

import type { FormState } from "@/components/auth/auth-form";
import { createClient } from "@/lib/supabase/server";
import { loginSchema } from "@/lib/validation/auth";

/**
 * Signs a user in using Supabase Auth.
 *
 * The generic error message is deliberate: revealing whether an address exists
 * would enable account enumeration.
 */
export async function loginAction(
  _prevState: FormState,
  formData: FormData,
): Promise<FormState> {
  const parsed = loginSchema.safeParse({
    email: formData.get("email"),
    password: formData.get("password"),
    next: formData.get("next") || undefined,
  });

  if (!parsed.success) {
    const fieldErrors: Record<string, string> = {};
    for (const issue of parsed.error.issues) {
      const key = issue.path[0];
      if (typeof key === "string" && !fieldErrors[key]) {
        fieldErrors[key] = issue.message;
      }
    }
    return { fieldErrors };
  }

  const supabase = await createClient();

  const { error } = await supabase.auth.signInWithPassword({
    email: parsed.data.email,
    password: parsed.data.password,
  });

  if (error) {
    // Deliberately vague.
    return { error: "Invalid email or password." };
  }

  const target = parsed.data.next ?? "/admin";
  redirect(target);
}

/** Sends a password-reset email. Always reports the same neutral message. */
export async function forgotPasswordAction(
  _prevState: FormState,
  formData: FormData,
): Promise<FormState> {
  const parsed = loginSchema.shape.email.safeParse(formData.get("email"));

  if (!parsed.success) {
    return { fieldErrors: { email: "Enter a valid email address" } };
  }

  const supabase = await createClient();
  const origin = process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000";

  await supabase.auth.resetPasswordForEmail(parsed.data, {
    redirectTo: `${origin}/auth/reset-password`,
  });

  return {
    success:
      "If an account exists for that address, a password reset link has been sent.",
  };
}

/** Signs the current user out and clears the session cookies. */
export async function signOutAction(): Promise<void> {
  const supabase = await createClient();
  await supabase.auth.signOut();
  redirect("/login");
}