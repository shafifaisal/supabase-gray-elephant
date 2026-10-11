"use client";

import { useMemo, useState } from "react";

import { CHARACTER_SETS } from "@/lib/crypto/password";
import { describeOfflineGuessing } from "@/lib/crypto/passphrase";
import {
  characterEntropy,
  detectPatterns,
  poolSize,
  strengthLabel,
  wordEntropy,
} from "@/lib/entropy/calculator";
import { BITS_PER_WORD, WORDLIST_SIZE } from "@/lib/crypto/wordlist";

type Mode = "characters" | "words";

interface CharacterOptions {
  length: number;
  lowercase: boolean;
  uppercase: boolean;
  digits: boolean;
  symbols: boolean;
}

interface WordOptions {
  wordCount: number;
  includeNumber: boolean;
  includeSymbol: boolean;
}

export function PasswordEntropyCalculatorTool() {
  const [mode, setMode] = useState<Mode>("characters");

  return (
    <div className="space-y-6">
      <div
        className="inline-flex rounded-md border border-border p-1"
        role="tablist"
        aria-label="Entropy calculation method"
      >
        <Tab
          id="tab-chars"
          selected={mode === "characters"}
          onSelect={() => setMode("characters")}
        >
          Character pool
        </Tab>
        <Tab
          id="tab-words"
          selected={mode === "words"}
          onSelect={() => setMode("words")}
        >
          Word list
        </Tab>
      </div>

      {mode === "characters" ? <CharacterCalculator /> : <WordCalculator />}
    </div>
  );
}

function Tab({
  id,
  selected,
  onSelect,
  children,
}: {
  id: string;
  selected: boolean;
  onSelect: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      id={id}
      type="button"
      role="tab"
      aria-selected={selected}
      aria-controls={id === "tab-chars" ? "panel-chars" : "panel-words"}
      onClick={onSelect}
      className={`rounded px-4 py-2 text-sm font-medium transition-colors ${
        selected ? "bg-primary text-primary-foreground" : "hover:bg-secondary"
      }`}
    >
      {children}
    </button>
  );
}

function CharacterCalculator() {
  const [options, setOptions] = useState<CharacterOptions>({
    length: 16,
    lowercase: true,
    uppercase: true,
    digits: true,
    symbols: true,
  });
  const [example, setExample] = useState("");

  const size = poolSize(options);
  const bits = characterEntropy(options.length, size);
  const rating = strengthLabel(bits);

  // Patterns only reduce the estimate when the user supplies a real value.
  const penalties = useMemo(
    () => (example ? detectPatterns(example) : []),
    [example],
  );
  const effective = penalties.length
    ? bits * penalties.reduce((total, p) => total * p.factor, 1)
    : bits;

  return (
    <div id="panel-chars" role="tabpanel" aria-labelledby="tab-chars" className="space-y-6">
      <div className="rounded-[var(--radius-card)] border border-border bg-background p-5 sm:p-6">
        <div className="flex items-baseline justify-between gap-3">
          <h2 className="text-lg font-semibold">Character-based entropy</h2>
          <span className="font-mono text-sm">{size} characters in pool</span>
        </div>

        <div className="mt-5">
          <label htmlFor="entropy-length" className="mb-1.5 block text-sm font-medium">
            Length: <span className="font-mono">{options.length}</span>
          </label>
          <input
            id="entropy-length"
            type="range"
            min={4}
            max={64}
            value={options.length}
            onChange={(event) =>
              setOptions({ ...options, length: Number(event.target.value) })
            }
            className="w-full accent-primary"
          />
        </div>

        <fieldset className="mt-5">
          <legend className="mb-2 text-sm font-medium">Character pool</legend>
          <div className="grid gap-2 sm:grid-cols-2">
            {(
              [
                ["lowercase", `Lowercase a–z (${CHARACTER_SETS.lowercase.length})`],
                ["uppercase", `Uppercase A–Z (${CHARACTER_SETS.uppercase.length})`],
                ["digits", `Digits 0–9 (${CHARACTER_SETS.digits.length})`],
                ["symbols", `Symbols (${CHARACTER_SETS.symbols.length})`],
              ] as const
            ).map(([key, label]) => (
              <label
                key={key}
                className="flex cursor-pointer items-center gap-2.5 rounded-md border border-border px-3 py-2.5 text-sm transition-colors hover:bg-secondary"
              >
                <input
                  type="checkbox"
                  checked={options[key]}
                  onChange={(event) =>
                    setOptions({ ...options, [key]: event.target.checked })
                  }
                  className="h-4 w-4 accent-primary"
                />
                {label}
              </label>
            ))}
          </div>
        </fieldset>
      </div>

      <ResultPanel
        bits={bits}
        rating={rating}
        size={size}
        count={options.length}
        unitLabel="Length (L)"
      />

      <PatternPanel
        example={example}
        setExample={setExample}
        penalties={penalties}
        effective={effective}
        base={bits}
      />
    </div>
  );
}

function WordCalculator() {
  const [options, setOptions] = useState<WordOptions>({
    wordCount: 5,
    includeNumber: false,
    includeSymbol: false,
  });

  const bits =
    wordEntropy(options.wordCount, WORDLIST_SIZE) +
    (options.includeNumber ? Math.log2(10) : 0) +
    (options.includeSymbol ? Math.log2(24) : 0);

  const rating = strengthLabel(bits);

  return (
    <div id="panel-words" role="tabpanel" aria-labelledby="tab-words" className="space-y-6">
      <div className="rounded-[var(--radius-card)] border border-border bg-background p-5 sm:p-6">
        <h2 className="text-lg font-semibold">Word-based entropy</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Assumes each word is chosen uniformly at random from the bundled
          EFF list of {WORDLIST_SIZE.toLocaleString("en-GB")} words.
        </p>

        <div className="mt-5">
          <label htmlFor="entropy-words" className="mb-1.5 block text-sm font-medium">
            Words: <span className="font-mono">{options.wordCount}</span>
          </label>
          <input
            id="entropy-words"
            type="range"
            min={1}
            max={12}
            value={options.wordCount}
            onChange={(event) =>
              setOptions({ ...options, wordCount: Number(event.target.value) })
            }
            className="w-full accent-primary"
          />
        </div>

        <div className="mt-4 space-y-2">
          <label className="flex cursor-pointer items-center gap-2.5 rounded-md border border-border px-3 py-2.5 text-sm transition-colors hover:bg-secondary">
            <input
              type="checkbox"
              checked={options.includeNumber}
              onChange={(event) =>
                setOptions({ ...options, includeNumber: event.target.checked })
              }
              className="h-4 w-4 accent-primary"
            />
            Plus one random digit (+{Math.log2(10).toFixed(2)} bits)
          </label>
          <label className="flex cursor-pointer items-center gap-2.5 rounded-md border border-border px-3 py-2.5 text-sm transition-colors hover:bg-secondary">
            <input
              type="checkbox"
              checked={options.includeSymbol}
              onChange={(event) =>
                setOptions({ ...options, includeSymbol: event.target.checked })
              }
              className="h-4 w-4 accent-primary"
            />
            Plus one random symbol (+{Math.log2(24).toFixed(2)} bits)
          </label>
        </div>
      </div>

      <ResultPanel
        bits={bits}
        rating={rating}
        size={WORDLIST_SIZE}
        count={options.wordCount}
        unitLabel="Words (L)"
      />
    </div>
  );
}

function ResultPanel({
  bits,
  rating,
  size,
  unitLabel,
  count,
}: {
  bits: number;
  rating: ReturnType<typeof strengthLabel>;
  size: number;
  unitLabel: string;
  count: number;
}) {
  return (
    <div className="rounded-[var(--radius-card)] border border-border bg-secondary/40 p-5">
      <h2 className="text-sm font-semibold">Calculation</h2>

      <div className="mt-3 rounded-md border border-border bg-background px-4 py-3 font-mono text-sm">
        <span className="text-muted-foreground">H = L × log₂(N)</span>
        <br />
        <span className="text-muted-foreground">
          H = {count} × log₂({size}) = {bits.toFixed(1)} bits
        </span>
      </div>

      <dl className="mt-4 space-y-2 text-sm">
        <div className="flex justify-between gap-3">
          <dt className="text-muted-foreground">{unitLabel} (L)</dt>
          <dd className="font-mono">{count}</dd>
        </div>
        <div className="flex justify-between gap-3">
          <dt className="text-muted-foreground">Pool or list size (N)</dt>
          <dd className="font-mono">{size}</dd>
        </div>
        <div className="flex justify-between gap-3">
          <dt className="text-muted-foreground">Entropy (H)</dt>
          <dd className="font-mono">{bits.toFixed(2)} bits</dd>
        </div>
        <div className="flex justify-between gap-3">
          <dt className="text-muted-foreground">Rating</dt>
          <dd className="font-semibold">{rating.label}</dd>
        </div>
        <div className="flex justify-between gap-3">
          <dt className="text-muted-foreground">
            Offline cracking at 10 billion guesses/sec
          </dt>
          <dd className="font-mono">{describeOfflineGuessing(bits)}</dd>
        </div>
      </dl>

      <p className="mt-4 text-xs text-muted-foreground">{rating.guidance}</p>
      <p className="mt-2 text-xs text-muted-foreground">
        A word list of {WORDLIST_SIZE.toLocaleString("en-GB")} entries
        contributes{" "}
        <span className="font-mono">{BITS_PER_WORD.toFixed(4)}</span> bits per
        word.
      </p>
    </div>
  );
}

function PatternPanel({
  example,
  setExample,
  penalties,
  effective,
  base,
}: {
  example: string;
  setExample: (value: string) => void;
  penalties: ReturnType<typeof detectPatterns>;
  effective: number;
  base: number;
}) {
  return (
    <div className="rounded-[var(--radius-card)] border border-border bg-background p-5 sm:p-6">
      <h2 className="text-lg font-semibold">Real-world patterns</h2>
      <p className="mt-1 text-sm text-muted-foreground">
        The figure above assumes perfect randomness. Paste a candidate value to
        see how obvious structure reduces the real-world estimate.
      </p>

      <label htmlFor="entropy-example" className="mt-4 mb-1.5 block text-sm font-medium">
        Example value (optional)
      </label>
      <input
        id="entropy-example"
        type="text"
        value={example}
        onChange={(event) => setExample(event.target.value)}
        autoComplete="off"
        spellCheck={false}
        placeholder="e.g. Summer2024!"
        className="w-full rounded-md border border-border bg-background px-4 py-2.5 font-mono text-sm transition-colors focus:border-primary focus:outline-none"
      />

      {example ? (
        penalties.length === 0 ? (
          <p className="mt-4 rounded-md border border-success/40 bg-success/10 px-4 py-3 text-sm text-success">
            No obvious patterns detected. That is encouraging, but it cannot
            prove the value was generated randomly.
          </p>
        ) : (
          <div className="mt-4 space-y-2">
            {penalties.map((penalty, index) => (
              <div
                key={index}
                className="rounded-md border border-warning/40 bg-warning/10 px-4 py-3"
              >
                <div className="flex items-center justify-between gap-3">
                  <span className="text-sm font-semibold text-warning">
                    {penalty.label}
                  </span>
                  <span className="font-mono text-xs text-warning">
                    ×{penalty.factor.toFixed(2)}
                  </span>
                </div>
                <p className="mt-1 text-xs text-muted-foreground">
                  {penalty.detail}
                </p>
              </div>
            ))}
            <p className="rounded-md border border-border bg-secondary/60 px-4 py-3 text-sm">
              Adjusted estimate:{" "}
              <strong className="font-mono">
                {effective.toFixed(1)} bits
              </strong>{" "}
              instead of the ideal {base.toFixed(1)} bits.
            </p>
          </div>
        )
      ) : null}

      <div className="mt-5 space-y-2 border-t border-border pt-4 text-sm text-muted-foreground">
        <p>
          <strong className="text-foreground">Limitations.</strong> This is a
          model, not a measurement. It cannot tell whether a value came from a
          CSPRNG or from a human choosing something memorable, and it says
          nothing about storage, reuse, or whether the value has already leaked.
        </p>
        <p>
          Real cracking tools try dictionary words and common patterns before
          any brute force, so a password that scores well on this page can
          still fall quickly in practice.
        </p>
      </div>
    </div>
  );
}

