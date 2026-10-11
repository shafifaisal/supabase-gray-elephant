"use client";

import { useCallback, useMemo, useState } from "react";

import { CopyButton, RegenerateButton } from "@/components/tools/buttons";
import { ErrorMessage, SecretField, VisibilityToggle } from "@/components/tools/controls";
import {
  ALL_AMBIGUOUS,
  BASE64URL_CHARACTERS,
  CHARACTER_SETS,
  HEX_CHARACTERS,
  generateRandomString,
} from "@/lib/crypto/password";
import { characterEntropy, strengthLabel } from "@/lib/entropy/calculator";
import { useClientSecret } from "@/lib/hooks/use-client-secret";
import { useCopyToClipboard } from "@/lib/hooks/use-copy";

type Preset = "custom" | "alphanumeric" | "hex" | "base64url" | "digits" | "letters";

const PRESETS: Record<Exclude<Preset, "custom">, { charset: string; label: string }> = {
  alphanumeric: {
    charset: CHARACTER_SETS.lowercase + CHARACTER_SETS.uppercase + CHARACTER_SETS.digits,
    label: "Alphanumeric (letters + numbers)",
  },
  hex: { charset: HEX_CHARACTERS, label: "Hex (0-9, a-f)" },
  base64url: { charset: BASE64URL_CHARACTERS, label: "Base64url (URL-safe)" },
  digits: { charset: CHARACTER_SETS.digits, label: "Digits only" },
  letters: {
    charset: CHARACTER_SETS.lowercase + CHARACTER_SETS.uppercase,
    label: "Letters only",
  },
};

const MIN_LENGTH = 1;
const MAX_LENGTH = 512;

export function RandomStringGeneratorTool() {
  const [preset, setPreset] = useState<Preset>("alphanumeric");
  const [customCharset, setCustomCharset] = useState(
    CHARACTER_SETS.lowercase + CHARACTER_SETS.uppercase + CHARACTER_SETS.digits + CHARACTER_SETS.symbols,
  );
  const [length, setLength] = useState(32);
  const [excludeAmbiguous, setExcludeAmbiguous] = useState(false);
  const [visible, setVisible] = useState(false);
  const { copy, copied, error: copyError } = useCopyToClipboard();

  const charset = useMemo(() => {
    let value = preset === "custom" ? customCharset : PRESETS[preset].charset;
    if (excludeAmbiguous) {
      const ambiguous = new Set(ALL_AMBIGUOUS.split(""));
      value = [...value].filter((char) => !ambiguous.has(char)).join("");
    }
    return value;
  }, [preset, customCharset, excludeAmbiguous]);

  const generate = useCallback(
    () => generateRandomString({ length, charset }),
    [length, charset],
  );

  // Generated in an effect so the value never appears in server-rendered HTML.
  const { value: result, regenerate } = useClientSecret(generate, {
    ok: false,
    error: { code: "INVALID_LENGTH", message: "" },
  } as ReturnType<typeof generateRandomString>);

  const value = result.ok ? result.value : "";
  const error = result.ok ? null : result.error.message || null;

  const uniqueChars = new Set(charset).size;
  const bits = value ? characterEntropy(value.length, uniqueChars) : 0;
  const rating = strengthLabel(bits);

  const ambiguous = excludeAmbiguous
    ? [...customCharset].filter((char) => ALL_AMBIGUOUS.includes(char))
    : [];

  return (
    <div className="space-y-8">
      <div className="rounded-[var(--radius-card)] border border-border bg-background p-5 sm:p-6">
        <SecretField label="Generated string" value={value}>
          <output
            id="generated-secret"
            className="flex min-h-12 flex-1 items-center overflow-x-auto rounded-md border border-border bg-secondary/60 px-4 py-3 font-mono text-sm break-all select-all"
          >
            {value
              ? visible
                ? value
                : "•".repeat(Math.min(value.length, 64))
              : "—"}
          </output>

          <div className="flex gap-2">
            <VisibilityToggle
              visible={visible}
              onToggle={() => setVisible((v) => !v)}
              label={visible ? "Hide string" : "Show string"}
            />
            <CopyButton
              onClick={() => void copy(value)}
              copied={copied}
              disabled={!value}
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
          <label htmlFor="string-length" className="mb-1.5 block text-sm font-medium">
            Length: <span className="font-mono">{length}</span>
          </label>
          <input
            id="string-length"
            type="range"
            min={MIN_LENGTH}
            max={MAX_LENGTH}
            value={length}
            onChange={(event) => setLength(Number(event.target.value))}
            className="w-full accent-primary"
            aria-describedby="string-length-hint"
          />
          <p id="string-length-hint" className="mt-1 text-xs text-muted-foreground">
            Between {MIN_LENGTH} and {MAX_LENGTH} characters.
          </p>
        </div>

        <fieldset className="mt-6">
          <legend className="mb-2 text-sm font-medium">Character set</legend>
          <div className="space-y-2">
            {(
              Object.entries(PRESETS) as [Exclude<Preset, "custom">, { label: string }][]
            ).map(([key, config]) => (
              <label
                key={key}
                className={`flex cursor-pointer items-center gap-2.5 rounded-md border px-3 py-2.5 text-sm transition-colors ${
                  preset === key
                    ? "border-primary bg-secondary font-medium"
                    : "border-border hover:bg-secondary"
                }`}
              >
                <input
                  type="radio"
                  name="preset"
                  checked={preset === key}
                  onChange={() => setPreset(key)}
                  className="h-4 w-4 accent-primary"
                />
                {config.label}
              </label>
            ))}

            <label
              className={`flex cursor-pointer items-center gap-2.5 rounded-md border px-3 py-2.5 text-sm transition-colors ${
                preset === "custom"
                  ? "border-primary bg-secondary font-medium"
                  : "border-border hover:bg-secondary"
              }`}
            >
              <input
                type="radio"
                name="preset"
                checked={preset === "custom"}
                onChange={() => setPreset("custom")}
                className="h-4 w-4 accent-primary"
              />
              Custom character set
            </label>
          </div>
        </fieldset>

        {preset === "custom" ? (
          <div className="mt-4">
            <label htmlFor="custom-charset" className="mb-1.5 block text-sm font-medium">
              Characters to use
            </label>
            <input
              id="custom-charset"
              type="text"
              value={customCharset}
              onChange={(event) => setCustomCharset(event.target.value)}
              spellCheck={false}
              className="w-full rounded-md border border-border bg-background px-4 py-2.5 font-mono text-sm transition-colors focus:border-primary focus:outline-none"
            />
            <p className="mt-1 text-xs text-muted-foreground">
              {uniqueChars} distinct character{uniqueChars === 1 ? "" : "s"}.
              Duplicate entries are ignored.
            </p>
          </div>
        ) : null}

        <div className="mt-4">
          <label
            htmlFor="exclude-ambiguous"
            className="flex cursor-pointer items-center gap-2.5 rounded-md border border-border px-3 py-2.5 text-sm transition-colors hover:bg-secondary"
          >
            <input
              id="exclude-ambiguous"
              type="checkbox"
              checked={excludeAmbiguous}
              onChange={(event) => setExcludeAmbiguous(event.target.checked)}
              className="h-4 w-4 accent-primary"
            />
            Exclude ambiguous characters
          </label>
          {excludeAmbiguous && ambiguous.length > 0 ? (
            <p className="mt-1 text-xs text-muted-foreground">
              Removing:{" "}
              <span className="font-mono">{ambiguous.join(" ")}</span>
            </p>
          ) : null}
        </div>
      </div>

      {value ? (
        <div className="rounded-[var(--radius-card)] border border-border bg-secondary/40 p-5">
          <h2 className="text-sm font-semibold">Estimated randomness</h2>
          <dl className="mt-3 space-y-2 text-sm">
            <div className="flex justify-between gap-3">
              <dt className="text-muted-foreground">Distinct characters</dt>
              <dd className="font-mono">{uniqueChars}</dd>
            </div>
            <div className="flex justify-between gap-3">
              <dt className="text-muted-foreground">Entropy</dt>
              <dd className="font-mono">{bits.toFixed(1)} bits</dd>
            </div>
            <div className="flex justify-between gap-3">
              <dt className="text-muted-foreground">Rating</dt>
              <dd className="font-semibold">{rating.label}</dd>
            </div>
          </dl>
          <p className="mt-3 text-xs text-muted-foreground">
            Assumes every character is drawn independently and uniformly from
            the selected set. Use at least 128 bits for long-lived secrets such
            as API keys and session tokens.
          </p>
        </div>
      ) : null}
    </div>
  );
}