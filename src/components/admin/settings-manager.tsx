"use client";

import { useActionState } from "react";

import { ActionButton } from "@/components/admin/action-button";
import type { ActionState } from "@/lib/validation/article";

const inputClasses =
  "w-full rounded-md border border-border bg-background px-3 py-2.5 text-sm transition-colors focus:border-primary focus:outline-none";

type SettingsAction = (
  state: ActionState,
  formData: FormData,
) => Promise<ActionState>;

interface Preset {
  key: string;
  label: string;
  hint: string;
  value: string;
}

interface StoredSetting {
  key: string;
  value: string | null;
  is_secret: boolean;
}

/**
 * Settings editor.
 *
 * WHY ONE FORM PER SETTING
 * ------------------------
 * The save action reads a single `key` and a single `value` from the submitted
 * FormData. A form containing several fields of the same name collapses them to
 * the first match, so wrapping every setting in one form meant only the first
 * field could ever be saved — every other setting silently reverted. Giving each
 * setting its own <form> keeps exactly one `key`/`value` per submit, so each
 * field saves independently and reports its own result.
 */
export function SettingsManager({
  action,
  presets,
  existing,
}: {
  action: SettingsAction;
  presets: Preset[];
  existing: StoredSetting[];
}) {
  const current = new Map(existing.map((s) => [s.key, s]));

  return (
    <div className="mt-6 space-y-6">
      <div className="grid gap-4 md:grid-cols-2">
        {presets.map((preset) => {
          const stored = current.get(preset.key);

          return (
            <SettingForm
              key={preset.key}
              action={action}
              settingKey={preset.key}
              label={preset.label}
              hint={preset.hint}
              defaultValue={stored?.value ?? preset.value}
              isStored={stored !== undefined}
            />
          );
        })}
      </div>

      <SettingForm
        action={action}
        settingKey=""
        label="Custom setting"
        hint='Save an arbitrary key. The key must use lowercase letters, numbers and underscores. Values are parsed as JSON when possible, so a value of true or {"enabled": true} is stored as such.'
        defaultValue=""
        isStored={false}
        allowSecret
        placeholderKey="lowercase_with_underscores"
        placeholderValue='{"enabled": true}'
      />
    </div>
  );
}

function SettingForm({
  action,
  settingKey,
  label,
  hint,
  defaultValue,
  isStored,
  allowSecret = false,
  placeholderKey,
  placeholderValue,
}: {
  action: SettingsAction;
  /** "" renders an editable key field (used only by the custom-setting form). */
  settingKey: string;
  label: string;
  hint: string;
  defaultValue: string;
  isStored: boolean;
  allowSecret?: boolean;
  placeholderKey?: string;
  placeholderValue?: string;
}) {
  const [state, formAction] = useActionState(action, {});
  const valueId = `setting-${settingKey || "custom"}-value`;

  return (
    <form
      action={formAction}
      className="flex flex-col rounded-[var(--radius-card)] border border-border bg-background p-6"
    >
      <label htmlFor={valueId} className="block text-sm font-semibold">
        {label}
      </label>
      <p className="mt-0.5 text-xs text-muted-foreground">{hint}</p>

      {settingKey ? (
        // Exactly one `key` per form, so the action can never read the wrong one.
        <input type="hidden" name="key" value={settingKey} />
      ) : (
        <input
          id="setting-custom-key"
          name="key"
          defaultValue=""
          placeholder={placeholderKey}
          aria-label="Setting key"
          className={`${inputClasses} mt-2 font-mono`}
        />
      )}

      <input
        id={valueId}
        name="value"
        defaultValue={defaultValue}
        placeholder={placeholderValue}
        className={`${inputClasses} mt-2 font-mono`}
      />

      {allowSecret ? (
        <label className="mt-2 flex cursor-pointer items-center gap-2.5 text-sm">
          <input
            type="checkbox"
            name="is_secret"
            className="h-4 w-4 accent-primary"
          />
          Mark as secret (readable by administrators only)
        </label>
      ) : null}

      <p className="mt-1 text-xs text-muted-foreground">
        Key: <span className="font-mono">{settingKey || "(custom)"}</span>
        {settingKey
          ? isStored
            ? " · currently saved"
            : " · using default"
          : null}
      </p>

      <div className="mt-4 flex flex-wrap items-center gap-3">
        <ActionButton>Save</ActionButton>

        {state.success ? (
          <span role="status" className="text-xs font-medium text-success">
            Saved.
          </span>
        ) : null}
      </div>

      {state.error ? (
        <p role="alert" className="mt-2 text-xs text-danger">
          {state.error}
        </p>
      ) : null}

      {state.fieldErrors ? (
        <p role="alert" className="mt-2 text-xs text-danger">
          {Object.values(state.fieldErrors).join(" ")}
        </p>
      ) : null}
    </form>
  );
}
