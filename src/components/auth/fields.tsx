"use client";

import { FormField, inputClasses, useFormState } from "@/components/auth/auth-form";

/** Field components read form state from context, keeping the boundary clean. */
export function EmailField() {
  const state = useFormState();

  return (
    <FormField id="email" label="Email" error={state.fieldErrors?.email}>
      <input
        id="email"
        name="email"
        type="email"
        autoComplete="email"
        required
        aria-invalid={Boolean(state.fieldErrors?.email) || undefined}
        aria-describedby={state.fieldErrors?.email ? "email-error" : undefined}
        className={inputClasses}
        placeholder="you@example.com"
      />
    </FormField>
  );
}

export function PasswordField({
  id = "password",
  label = "Password",
  autoComplete = "current-password",
  minLength,
}: {
  id?: string;
  label?: string;
  autoComplete?: string;
  minLength?: number;
}) {
  const state = useFormState();

  return (
    <FormField id={id} label={label} error={state.fieldErrors?.[id]}>
      <input
        id={id}
        name={id}
        type="password"
        autoComplete={autoComplete}
        required
        minLength={minLength}
        aria-invalid={Boolean(state.fieldErrors?.[id]) || undefined}
        aria-describedby={state.fieldErrors?.[id] ? `${id}-error` : undefined}
        className={inputClasses}
      />
    </FormField>
  );
}