"use client";

import { useCallback, useState } from "react";

import { CopyButton, RegenerateButton } from "@/components/tools/buttons";
import { ErrorMessage, SecretField, VisibilityToggle } from "@/components/tools/controls";
import { describeOfflineGuessing, generatePassphrase } from "@/lib/crypto/passphrase";
import { BITS_PER_WORD, WORDLIST_SIZE } from "@/lib/crypto/wordlist";
import { strengthLabel } from "@/lib/entropy/calculator";
import { useClientSecret } from "@/lib/hooks/use-client-secret";
import { useCopyToClipboard } from "@/lib/hooks/use-copy";

interface Options {
  wordCount: number;
  separator: string;
  capitalize: boolean;
  includeNumber: boolean;
  includeSymbol: boolean;
  unique: boolean;
}

const DEFAULT_OPTIONS: Options = {
  wordCount: 5,
  separator: "-",
  capitalize: false,
  includeNumber: false,
  includeSymbol: false,
  unique: false,
};

const SEPARATORS = ["-", ".", "_", " ", ""];

export function PassphraseGeneratorTool() {
  const [options, setOptions] = useState<Options>(DEFAULT_OPTIONS);
  const [visible, setVisible] = useState(false);
  const { copy, copied, error: copyError } = useCopyToClipboard();

  const generate = useCallback(
    () =>
      generatePassphrase(
        {
          wordCount: options.wordCount,
          separator: options.separator,
          capitalize: options.capitalize,
          includeNumber: options.includeNumber,
          includeSymbol: options.includeSymbol,
        },
        options.unique,
      ),
    [options],
  );

  // Generated in an effect so the passphrase never appears in server HTML.
  const { value: result, regenerate } = useClientSecret(generate, {
    ok: false,
    value: "",
    words: [],
    bits: 0,
  } as ReturnType<typeof generatePassphrase>);

  const passphrase = result.ok ? result.value : "";
  const error = result.ok ? null : result.error?.message ?? null;
  const rating = strengthLabel(result.bits);

  function update<K extends keyof Options>(key: K, value: Options[K]) {
    setOptions((current) => ({ ...current, [key]: value }));
  }

  return (
    <div className="space-y-8">
      <div className="rounded-[var(--radius-card)] border border-border bg-background p-5 sm:p-6">
        <SecretField label="Generated passphrase" value={passphrase}>
          <output
            id="generated-secret"
            className="flex min-h-12 flex-1 items-center overflow-x-auto rounded-md border border-border bg-secondary/60 px-4 py-3 font-mono text-lg break-all select-all"
          >
            {passphrase
              ? visible
                ? passphrase
                : "•".repeat(Math.min(passphrase.length, 64))
              : "—"}
          </output>

          <div className="flex gap-2">
            <VisibilityToggle
              visible={visible}
              onToggle={() => setVisible((v) => !v)}
              label={visible ? "Hide passphrase" : "Show passphrase"}
            />
            <CopyButton
              onClick={() => void copy(passphrase)}
              copied={copied}
              disabled={!passphrase}
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
          <label htmlFor="wordCount" className="mb-1.5 block text-sm font-medium">
            Words: <span className="font-mono">{options.wordCount}</span>
          </label>
          <input
            id="wordCount"
            type="range"
            min={3}
            max={12}
            step={1}
            value={options.wordCount}
            onChange={(event) =>
              update("wordCount", Number(event.target.value))
            }
            className="w-full accent-primary"
          />
          <p className="mt-1 text-xs text-muted-foreground">
            Each word adds about {BITS_PER_WORD.toFixed(2)} bits. Four words is
            already stronger than most passwords people choose.
          </p>
        </div>

        <fieldset className="mt-6">
          <legend className="mb-2 text-sm font-medium">Separator</legend>
          <div className="flex flex-wrap gap-2">
            {SEPARATORS.map((separator, index) => (
              <label
                key={index}
                className={`cursor-pointer rounded-md border px-4 py-2 font-mono text-sm transition-colors ${
                  options.separator === separator
                    ? "border-primary bg-secondary font-semibold"
                    : "border-border hover:bg-secondary"
                }`}
              >
                <input
                  type="radio"
                  name="separator"
                  className="sr-only"
                  checked={options.separator === separator}
                  onChange={() => update("separator", separator)}
                />
                {separator === "" ? "(none)" : separator}
              </label>
            ))}
          </div>
        </fieldset>

        <fieldset className="mt-6 space-y-2">
          <legend className="mb-2 text-sm font-medium">Formatting</legend>
          <Toggle
            id="capitalize"
            checked={options.capitalize}
            onChange={(v) => update("capitalize", v)}
            label="Capitalise each word"
          />
          <Toggle
            id="includeNumber"
            checked={options.includeNumber}
            onChange={(v) => update("includeNumber", v)}
            label="Append a random number"
          />
          <Toggle
            id="includeSymbol"
            checked={options.includeSymbol}
            onChange={(v) => update("includeSymbol", v)}
            label="Append a random symbol"
          />
          <Toggle
            id="unique"
            checked={options.unique}
            onChange={(v) => update("unique", v)}
            label="No repeated words"
          />
        </fieldset>
      </div>

      {result.ok ? (
        <div className="rounded-[var(--radius-card)] border border-border bg-secondary/40 p-5">
          <h2 className="text-sm font-semibold">Why this is strong</h2>

          <dl className="mt-3 space-y-2 text-sm">
            <div className="flex justify-between gap-3">
              <dt className="text-muted-foreground">Words chosen</dt>
              <dd className="font-mono">{options.wordCount}</dd>
            </div>
            <div className="flex justify-between gap-3">
              <dt className="text-muted-foreground">Word list size</dt>
              <dd className="font-mono">{WORDLIST_SIZE.toLocaleString("en-GB")}</dd>
            </div>
            <div className="flex justify-between gap-3">
              <dt className="text-muted-foreground">Entropy per word</dt>
              <dd className="font-mono">{BITS_PER_WORD.toFixed(4)} bits</dd>
            </div>
            <div className="flex justify-between gap-3">
              <dt className="text-muted-foreground">Total entropy</dt>
              <dd className="font-mono">{result.bits.toFixed(1)} bits</dd>
            </div>
            <div className="flex justify-between gap-3">
              <dt className="text-muted-foreground">Rating</dt>
              <dd className="font-semibold">{rating.label}</dd>
            </div>
            <div className="flex justify-between gap-3">
              <dt className="text-muted-foreground">Offline cracking time</dt>
              <dd className="font-mono">
                {describeOfflineGuessing(result.bits)}
              </dd>
            </div>
          </dl>

          <p className="mt-4 text-xs text-muted-foreground">
            Words are selected independently and uniformly at random using the
            browser&rsquo;s cryptographic generator, so each word carries
            exactly log2({WORDLIST_SIZE}) ≈ {BITS_PER_WORD.toFixed(4)} bits.
          </p>

          <p className="mt-2 text-xs text-muted-foreground">
            <strong className="text-foreground">
              Limitations worth understanding:
            </strong>{" "}
            this is an upper bound that assumes the passphrase was generated
            this way and is stored securely. A memorable passphrase is more
            exposed to human error and shoulder-surfing than a random string,
            and no passphrase is safe if it is reused across services.
          </p>
        </div>
      ) : null}
    </div>
  );
}

function Toggle({
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