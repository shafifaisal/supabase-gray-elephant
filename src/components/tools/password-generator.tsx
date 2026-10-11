"use client";

import { useCallback, useState } from "react";

import { CopyButton, RegenerateButton } from "@/components/tools/buttons";
import { ErrorMessage, SecretField, VisibilityToggle } from "@/components/tools/controls";
import { CHARACTER_SETS, generatePassword } from "@/lib/crypto/password";
import { characterEntropy, strengthLabel } from "@/lib/entropy/calculator";
import { useClientSecret } from "@/lib/hooks/use-client-secret";
import { useCopyToClipboard } from "@/lib/hooks/use-copy";

interface Options {
  length: number;
  lowercase: boolean;
  uppercase: boolean;
  digits: boolean;
  symbols: boolean;
  excludeAmbiguous: boolean;
}

const DEFAULT_OPTIONS: Options = {
  length: 20,
  lowercase: true,
  uppercase: true,
  digits: true,
  symbols: true,
  excludeAmbiguous: false,
};

const MIN_LENGTH = 8;
const MAX_LENGTH = 128;

export function PasswordGeneratorTool() {
  const [options, setOptions] = useState<Options>(DEFAULT_OPTIONS);
  const [visible, setVisible] = useState(false);
  const { copy, copied, error: copyError } = useCopyToClipboard();

  // Stable generator derived from options. Generating happens in an effect on
  // the client, so the secret never reaches server-rendered HTML.
  const generate = useCallback(
    () =>
      generatePassword({
        length: options.length,
        sets: {
          lowercase: options.lowercase,
          uppercase: options.uppercase,
          digits: options.digits,
          symbols: options.symbols,
        },
        excludeAmbiguous: options.excludeAmbiguous,
      }),
    [options],
  );

  const { value: result, regenerate } = useClientSecret(generate, {
    ok: false,
    error: { code: "INVALID_LENGTH", message: "" },
  } as ReturnType<typeof generatePassword>);

  const password = result.ok ? result.value : "";
  // Suppress the empty placeholder error before the first client generation.
  const error = result.ok ? null : result.error.message || null;

  const bits = password
    ? characterEntropy(
        password.length,
        poolSizeFor(options),
      )
    : 0;
  const rating = strengthLabel(bits);

  function update<K extends keyof Options>(key: K, value: Options[K]) {
    setOptions((current) => ({ ...current, [key]: value }));
  }

  return (
    <div className="space-y-8">
      <div className="rounded-[var(--radius-card)] border border-border bg-background p-5 sm:p-6">
        <SecretField label="Generated password" value={password}>
          <output
            id="generated-secret"
            className="flex min-h-12 flex-1 items-center overflow-x-auto rounded-md border border-border bg-secondary/60 px-4 py-3 font-mono text-lg break-all select-all"
          >
            {password
              ? visible
                ? password
                : "•".repeat(Math.min(password.length, 64))
              : "—"}
          </output>

          <div className="flex gap-2">
            <VisibilityToggle
              visible={visible}
              onToggle={() => setVisible((v) => !v)}
              label={visible ? "Hide password" : "Show password"}
            />
            <CopyButton
              onClick={() => void copy(password)}
              copied={copied}
              disabled={!password}
            />
            <RegenerateButton onClick={regenerate} />
          </div>
        </SecretField>

        {error ? (
          <div className="mt-4">
            <ErrorMessage>{error}</ErrorMessage>
          </div>
        ) : null}

        {copyError ? (
          <div className="mt-4">
            <ErrorMessage>{copyError}</ErrorMessage>
          </div>
        ) : null}
      </div>

      <div className="rounded-[var(--radius-card)] border border-border bg-background p-5 sm:p-6">
        <h2 className="text-lg font-semibold">Options</h2>

        <div className="mt-4">
          <label htmlFor="length" className="mb-1.5 block text-sm font-medium">
            Length: <span className="font-mono">{options.length}</span>
          </label>
          <input
            id="length"
            type="range"
            min={MIN_LENGTH}
            max={MAX_LENGTH}
            step={1}
            value={options.length}
            onChange={(event) => update("length", Number(event.target.value))}
            className="w-full accent-primary"
            aria-describedby="length-hint"
          />
          <p id="length-hint" className="mt-1 text-xs text-muted-foreground">
            Between {MIN_LENGTH} and {MAX_LENGTH} characters. Longer is
            meaningfully stronger — length adds entropy faster than extra
            symbols do.
          </p>
        </div>

        <fieldset className="mt-6">
          <legend className="mb-2 text-sm font-medium">Character groups</legend>
          <div className="grid gap-2 sm:grid-cols-2">
            <Checkbox
              id="opt-lowercase"
              checked={options.lowercase}
              onChange={(v) => update("lowercase", v)}
              label={`Lowercase (${CHARACTER_SETS.lowercase.length})`}
            />
            <Checkbox
              id="opt-uppercase"
              checked={options.uppercase}
              onChange={(v) => update("uppercase", v)}
              label={`Uppercase (${CHARACTER_SETS.uppercase.length})`}
            />
            <Checkbox
              id="opt-digits"
              checked={options.digits}
              onChange={(v) => update("digits", v)}
              label={`Numbers (${CHARACTER_SETS.digits.length})`}
            />
            <Checkbox
              id="opt-symbols"
              checked={options.symbols}
              onChange={(v) => update("symbols", v)}
              label={`Symbols (${CHARACTER_SETS.symbols.length})`}
            />
          </div>
        </fieldset>

        <div className="mt-4">
          <Checkbox
            id="opt-ambiguous"
            checked={options.excludeAmbiguous}
            onChange={(v) => update("excludeAmbiguous", v)}
            label="Exclude ambiguous characters (I, l, 1, O, 0, |)"
          />
          <p className="mt-1 text-xs text-muted-foreground">
            Helpful when a password must be read aloud or typed from a screen.
          </p>
        </div>
      </div>

      {password ? (
        <div className="rounded-[var(--radius-card)] border border-border bg-secondary/40 p-5">
          <h2 className="text-sm font-semibold">Estimated strength</h2>
          <div className="mt-3 flex items-baseline justify-between gap-3">
            <span className="font-semibold">{rating.label}</span>
            <span className="font-mono text-sm">{bits.toFixed(1)} bits</span>
          </div>
          <p className="mt-2 text-sm text-muted-foreground">{rating.guidance}</p>
          <p className="mt-3 text-xs text-muted-foreground">
            This figure assumes the value was produced by a uniform random
            process over a {poolSizeFor(options)}-character pool. It is an
            estimate, not a guarantee, and it says nothing about whether you
            reuse this password elsewhere.
          </p>
        </div>
      ) : null}
    </div>
  );
}

function poolSizeFor(options: Options): number {
  let size = 0;
  if (options.lowercase) size += CHARACTER_SETS.lowercase.length;
  if (options.uppercase) size += CHARACTER_SETS.uppercase.length;
  if (options.digits) size += CHARACTER_SETS.digits.length;
  if (options.symbols) size += CHARACTER_SETS.symbols.length;
  return size;
}

function Checkbox({
  id,
  checked,
  onChange,
  label,
}: {
  id: string;
  checked: boolean;
  onChange: (value: boolean) => void;
  label: string;
}) {
  return (
    <label
      htmlFor={id}
      className="flex cursor-pointer items-center gap-2.5 rounded-md border border-border px-3 py-2.5 text-sm transition-colors hover:bg-secondary"
    >
      <input
        id={id}
        type="checkbox"
        checked={checked}
        onChange={(event) => onChange(event.target.checked)}
        className="h-4 w-4 accent-primary"
      />
      {label}
    </label>
  );
}