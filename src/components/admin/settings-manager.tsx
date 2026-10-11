"use client";

import { useActionState } from "react";

import { ActionButton } from "@/components/admin/action-button";
import type { ActionState } from "@/lib/validation/article";

const inputClasses =
  "w-full rounded-md border border-border bg-background px-3 py-2.5 text-sm transition-colors focus:border-primary focus:outline-none";

export function SettingsManager({
  action,
  presets,
  existing,
}: {
  action: (state: ActionState, formData: FormData) => Promise<ActionState>;
  presets: { key: string; label: string; hint: string; value: string }[];
  existing: { key: string; value: string | null; is_secret: boolean }[];
}) {
  const [state, formAction] = useActionState(action, {});
  const current = new Map(existing.map((s) => [s.key, s]));

  return (
    <form action={formAction} className="mt-6 space-y-6">
      {state.success ? (
        <p
          role="status"
          className="rounded-md border border-success/40 bg-success/10 px-4 py-3 text-sm text-success"
        >
          Setting saved.
        </p>
      ) : null}

      {state.error ? (
        <p
          role="alert"
          className="rounded-md border border-danger/40 bg-danger/10 px-4 py-3 text-sm text-danger"
        >
          {state.error}
        </p>
      ) : null}

      <div className="grid gap-4 md:grid-cols-2">
        {presets.map((preset) => {
          const stored = current.get(preset.key);

          return (
            <div
              key={preset.key}
              className="rounded-[var(--radius-card)] border border-border bg-background p-4"
            >
              <label
                htmlFor={`setting-${preset.key}`}
                className="block text-sm font-semibold"
              >
                {preset.label}
              </label>
              <p className="mt-0.5 text-xs text-muted-foreground">{preset.hint}</p>

              <input
                type="hidden"
                name="key"
                value={preset.key}
              />

              <input
                id={`setting-${preset.key}`}
                name="value"
                defaultValue={stored?.value ?? preset.value}
                className={`${inputClasses} mt-2 font-mono`}
              />

              <p className="mt-1 text-xs text-muted-foreground">
                Key: <span className="font-mono">{preset.key}</span>
                {stored ? " · currently saved" : " · using default"}
              </p>
            </div>
          );
        })}
      </div>

      <div>
        <label htmlFor="custom-key" className="mb-1.5 block text-sm font-medium">
          Custom key
        </label>
        <input
          id="custom-key"
          name="key"
          defaultValue=""
          placeholder="lowercase_with_underscores"
          className={`${inputClasses} font-mono`}
        />
        <p className="mt-1 text-xs text-muted-foreground">
          Leave the key above blank to save only the custom key. Values are
          parsed as JSON when possible.
        </p>
      </div>

      <div>
        <label
          htmlFor="custom-value"
          className="mb-1.5 block text-sm font-medium"
        >
          Custom value
        </label>
        <textarea
          id="custom-value"
          name="value"
          rows={3}
          defaultValue=""
          placeholder='{"enabled": true}'
          className={`${inputClasses} font-mono`}
        />
      </div>

      <label className="flex cursor-pointer items-center gap-2.5 text-sm">
        <input type="checkbox" name="is_secret" className="h-4 w-4 accent-primary" />
        Mark as secret (readable by administrators only)
      </label>

      <ActionButton>Save settings</ActionButton>
    </form>
  );
}