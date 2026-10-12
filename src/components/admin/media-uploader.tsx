"use client";

import { useActionState, useEffect, useRef } from "react";

import { ActionButton } from "@/components/admin/action-button";
import type { ActionState } from "@/lib/validation/article";

const inputClasses =
  "w-full rounded-md border border-border bg-background px-3 py-2 text-sm transition-colors focus:border-primary focus:outline-none";

export function MediaUploader({
  action,
}: {
  action: (state: ActionState, formData: FormData) => Promise<ActionState>;
}) {
  const [state, formAction] = useActionState(action, {});
  const formRef = useRef<HTMLFormElement>(null);

  // Clear the picker after a successful upload so the next one starts fresh.
  useEffect(() => {
    if (state.success) formRef.current?.reset();
  }, [state]);

  return (
    <form
      ref={formRef}
      action={formAction}
      className="mt-6 rounded-[var(--radius-card)] border border-border bg-secondary/40 p-5"
    >
      <h2 className="text-sm font-semibold">Upload</h2>

      {state.success ? (
        <p
          role="status"
          className="mt-3 rounded-md border border-success/40 bg-success/10 px-4 py-3 text-sm text-success"
        >
          Uploaded.
        </p>
      ) : null}

      {state.error ? (
        <p
          role="alert"
          className="mt-3 rounded-md border border-danger/40 bg-danger/10 px-4 py-3 text-sm text-danger"
        >
          {state.error}
        </p>
      ) : null}

      <div className="mt-3 grid gap-4 sm:grid-cols-2">
        <div className="sm:col-span-2">
          <label htmlFor="media-file" className="block text-sm font-medium">
            File
          </label>
          <input
            id="media-file"
            name="file"
            type="file"
            required
            accept="image/png,image/jpeg,image/webp,image/avif,image/svg+xml,image/gif"
            className={`${inputClasses} mt-1 file:mr-3 file:rounded file:border-0 file:bg-secondary file:px-3 file:py-1 file:text-sm file:font-semibold`}
          />
          <p className="mt-1 text-xs text-muted-foreground">
            PNG, JPEG, WebP, AVIF, SVG or GIF, up to 5 MB.
          </p>
          {state.fieldErrors?.file ? (
            <p className="mt-1 text-sm text-danger">{state.fieldErrors.file}</p>
          ) : null}
        </div>

        <div>
          <label htmlFor="media-alt" className="block text-sm font-medium">
            Alt text
          </label>
          <input
            id="media-alt"
            name="alt_text"
            type="text"
            maxLength={200}
            className={`${inputClasses} mt-1`}
          />
          <p className="mt-1 text-xs text-muted-foreground">
            Describe the image for screen readers and search engines.
          </p>
        </div>

        <div>
          <label htmlFor="media-visibility" className="block text-sm font-medium">
            Visibility
          </label>
          <select
            id="media-visibility"
            name="visibility"
            defaultValue="public"
            className={`${inputClasses} mt-1`}
          >
            <option value="public">Public</option>
            <option value="private">Private (staff only)</option>
          </select>
          <p className="mt-1 text-xs text-muted-foreground">
            Private assets are readable by staff only.
          </p>
        </div>
      </div>

      <div className="mt-4">
        <ActionButton>Upload</ActionButton>
      </div>

      <p className="mt-3 text-xs text-muted-foreground">
        Files are stored in Supabase Storage, not on the server disk — Vercel
        functions have no persistent filesystem.
      </p>
    </form>
  );
}
