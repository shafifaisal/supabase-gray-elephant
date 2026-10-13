"use client";

import { useActionState } from "react";
import { useFormStatus } from "react-dom";

import type { ContactState } from "@/app/contact/actions";

const inputClasses =
  "w-full rounded-md border border-border bg-background px-3 py-2.5 text-sm transition-colors focus:border-primary focus:outline-none";

function Submit() {
  const { pending } = useFormStatus();

  return (
    <button
      type="submit"
      disabled={pending}
      className="inline-flex h-11 items-center justify-center rounded-md bg-primary px-6 text-sm font-semibold text-primary-foreground transition-opacity hover:opacity-90 disabled:opacity-60"
    >
      {pending ? "Sending…" : "Send message"}
    </button>
  );
}

export function ContactForm({
  action,
}: {
  action: (state: ContactState, formData: FormData) => Promise<ContactState>;
}) {
  const [state, formAction] = useActionState(action, {});

  if (state.success) {
    return (
      <div
        role="status"
        className="rounded-[var(--radius-card)] border border-success/40 bg-success/10 p-6"
      >
        <h2 className="text-lg font-semibold text-success">Message sent</h2>
        <p className="mt-2 text-sm text-muted-foreground">
          Thanks for getting in touch. We read every message.
        </p>
      </div>
    );
  }

  return (
    <form action={formAction} className="space-y-4">
      {state.error ? (
        <p
          role="alert"
          className="rounded-md border border-danger/40 bg-danger/10 px-4 py-3 text-sm text-danger"
        >
          {state.error}
        </p>
      ) : null}

      <p className="text-sm text-muted-foreground">
        Your feedback matters to us! If you have any questions or inquiries,
        feel free to contact our team. We&rsquo;re always happy to help and will
        get back to you as soon as possible.
      </p>

      <div>
        <label htmlFor="name" className="mb-1.5 block text-sm font-medium">
          Your name
        </label>
        <input id="name" name="name" required className={inputClasses} />
        {state.fieldErrors?.name ? (
          <p className="mt-1 text-sm text-danger">{state.fieldErrors.name}</p>
        ) : null}
      </div>

      <div>
        <label htmlFor="email" className="mb-1.5 block text-sm font-medium">
          Email
        </label>
        <input
          id="email"
          name="email"
          type="email"
          autoComplete="email"
          required
          className={inputClasses}
        />
        {state.fieldErrors?.email ? (
          <p className="mt-1 text-sm text-danger">{state.fieldErrors.email}</p>
        ) : null}
      </div>

      <div>
        <label htmlFor="mobile" className="mb-1.5 block text-sm font-medium">
          Whatsapp No.
        </label>
        <input
          id="mobile"
          name="mobile"
          type="tel"
          autoComplete="tel"
          className={inputClasses}
        />
        {state.fieldErrors?.mobile ? (
          <p className="mt-1 text-sm text-danger">{state.fieldErrors.mobile}</p>
        ) : null}
      </div>

      <div>
        <label htmlFor="subject" className="mb-1.5 block text-sm font-medium">
          Subject
        </label>
        <input id="subject" name="subject" required className={inputClasses} />
        {state.fieldErrors?.subject ? (
          <p className="mt-1 text-sm text-danger">{state.fieldErrors.subject}</p>
        ) : null}
      </div>

      <div>
        <label htmlFor="message" className="mb-1.5 block text-sm font-medium">
          Message
        </label>
        <textarea
          id="message"
          name="message"
          rows={6}
          required
          className={inputClasses}
        />
        {state.fieldErrors?.message ? (
          <p className="mt-1 text-sm text-danger">{state.fieldErrors.message}</p>
        ) : null}
      </div>

      {/* Honeypot: hidden from humans, tempting to bots. */}
      <div className="hidden" aria-hidden="true">
        <label htmlFor="website">Website</label>
        <input id="website" name="website" tabIndex={-1} autoComplete="off" />
      </div>

      <Submit />
    </form>
  );
}