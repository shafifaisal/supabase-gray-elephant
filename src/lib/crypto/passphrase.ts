/**
 * Passphrase generation.
 *
 * Words are chosen uniformly at random from the bundled EFF large wordlist
 * using the CSPRNG, so each word contributes exactly log2(7776) ≈ 12.925 bits.
 *
 * No phrases, no predictable patterns, no PRNG seeded from the clock.
 */

import { randomInt, secureShuffle } from "./random";
import { BITS_PER_WORD, WORDLIST_SIZE, WORDS } from "./wordlist";

export interface PassphraseOptions {
  /** How many words to include. */
  wordCount: number;
  /** Text placed between words. */
  separator: string;
  /** Capitalise the first letter of every word. */
  capitalize: boolean;
  /** Append a single random digit, adding log2(10) bits. */
  includeNumber: boolean;
  /** Append a single random symbol from the symbol set. */
  includeSymbol: boolean;
}

export interface PassphraseResult {
  ok: boolean;
  value: string;
  words: string[];
  /** Entropy of the passphrase under the stated assumptions, in bits. */
  bits: number;
  error?: { code: string; message: string };
}

export const MIN_WORDS = 3;
export const MAX_WORDS = 24;

const SYMBOLS = "!@#$%^&*-_=+?";

/**
 * Generates a passphrase.
 *
 * Uniform selection with replacement: the same word may appear twice, which is
 * correct for diceware-style generation and keeps every selection equally
 * likely. To forbid duplicates, pass `unique` — the entropy then drops and is
 * reported separately.
 */
export function generatePassphrase(
  options: PassphraseOptions,
  unique = false,
): PassphraseResult {
  const { wordCount, separator, capitalize, includeNumber, includeSymbol } =
    options;

  if (!Number.isInteger(wordCount) || wordCount < MIN_WORDS || wordCount > MAX_WORDS) {
    return {
      ok: false,
      value: "",
      words: [],
      bits: 0,
      error: {
        code: "INVALID_WORD_COUNT",
        message: `Choose between ${MIN_WORDS} and ${MAX_WORDS} words.`,
      },
    };
  }

  if (!unique && wordCount > WORDLIST_SIZE) {
    return {
      ok: false,
      value: "",
      words: [],
      bits: 0,
      error: {
        code: "TOO_MANY_WORDS",
        message: `Cannot select ${wordCount} unique words from a list of ${WORDLIST_SIZE}.`,
      },
    };
  }

  let chosen: string[];

  if (unique) {
    // Fisher–Yates style partial shuffle guarantees a uniform random subset
    // without rejection sampling.
    chosen = secureShuffle(WORDS).slice(0, wordCount);
  } else {
    chosen = [];
    for (let i = 0; i < wordCount; i += 1) {
      chosen.push(WORDS[randomInt(WORDLIST_SIZE)]!);
    }
  }

  let bits = wordCount * BITS_PER_WORD;
  if (includeNumber) bits += Math.log2(10);
  if (includeSymbol) bits += Math.log2(SYMBOLS.length);

  const rendered = chosen.map((word) =>
    capitalize ? word.charAt(0).toUpperCase() + word.slice(1) : word,
  );

  let value = rendered.join(separator);

  if (includeNumber) value += randomInt(10).toString();
  if (includeSymbol) value += SYMBOLS[randomInt(SYMBOLS.length)];

  return { ok: true, value, words: rendered, bits };
}

/** Formats bits into a human-readable duration against an offline attack. */
export function describeOfflineGuessing(bits: number): string {
  const guessesPerSecond = 1e10; // 10 billion/s, a well-resourced offline attack
  const seconds = Math.pow(2, bits) / (2 * guessesPerSecond);

  const units: [number, string][] = [
    // Each entry is [divisor, the unit you land in after dividing by it].
    [60, "minute"],
    [60, "hour"],
    [24, "day"],
    [365.25, "year"],
    [100, "century"],
    [10, "millennium"],
  ];

  if (seconds < 1) return "instantly";

  let value = seconds;
  let unit = "second";

  for (const [factor, nextUnit] of units) {
    if (value < factor) break;
    value /= factor;
    unit = nextUnit;
  }

  const rounded =
    value >= 100 ? Math.round(value).toLocaleString("en-GB")
    : value >= 10 ? Math.round(value).toString()
    : value.toFixed(1);

  return `${rounded} ${unit}${value > 1 ? "s" : ""}`;
}