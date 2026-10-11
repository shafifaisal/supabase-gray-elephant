"use client";

import { createContext, useActionState, useContext } from "react";
import { useFormStatus } from "react-dom";

export interface FormState {
  error?: string;
  success?: string;
  fieldErrors?: Record<string, string>;
}

/**
 * Form state is exposed through context rather than a render prop, because a
 * function prop cannot be serialised across the Server Component -> Client
 * Component boundary.
 */
const FormStateContext = createContext<FormState>({});

export function useFormState(): FormState {
  return useContext(FormStateContext);
}

function SubmitButton({ label }: { label: string }) {
  const { pending } = useFormStatus();

  return (
    <button
      type="submit"
      disabled={pending}
      className="inline-flex h-11 w-full items-center justify-center rounded-md bg-primary px-6 text-sm font-semibold text-primary-foreground transition-opacity hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-60"
    >
      {pending ? "Please wait…" : label}
    </button>
  );
}

export const inputClasses =
  "w-full rounded-md border border-border bg-background px-3 py-2.5 text-sm transition-colors placeholder:text-muted-foreground focus:border-primary focus:outline-none";

/**
 * Accessible auth form.
 *
 * Descendant fields read the current FormState with `useFormState()` so they
 * can show per-field validation errors. Form-level errors are announced in a
 * live region; success messages use role="status".
 */
export function AuthForm({
  action,
  label,
  children,
}: {
  action: (state: FormState, formData: FormData) => Promise<FormState>;
  label: string;
  children: React.ReactNode;
}) {
  const [state, formAction] = useActionState(action, {});

  return (
    <FormStateContext.Provider value={state}>
      <form action={formAction} className="space-y-4" noValidate>
        {children}

        <div aria-live="polite" aria-atomic="true">
          {state.error ? (
            <p
              role="alert"
              className="rounded-md border border-danger/40 bg-danger/10 px-4 py-3 text-sm text-danger"
            >
              {state.error}
            </p>
          ) : null}
          {state.success ? (
            <p
              role="status"
              className="rounded-md border border-success/40 bg-success/10 px-4 py-3 text-sm text-success"
            >
              {state.success}
            </p>
          ) : null}
        </div>

        <SubmitButton label={label} />
      </form>
    </FormStateContext.Provider>
  );
}

export function FormField({
  id,
  label,
  error,
  children,
}: {
  id: string;
  label: string;
  error?: string;
  children: React.ReactNode;
}) {
  return (
    <div>
      <label htmlFor={id} className="mb-1.5 block text-sm font-medium">
        {label}
      </label>
      {children}
      {error ? (
        <p id={`${id}-error`} className="mt-1.5 text-sm text-danger">
          {error}
        </p>
      ) : null}
    </div>
  );
}