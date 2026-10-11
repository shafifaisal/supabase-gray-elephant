/**
 * Transparent entropy calculation.
 *
 * Entropy is measured in bits: how much randomness a value actually contains.
 *
 * The important caveat, repeated throughout the UI: entropy computed here is an
 * UPPER BOUND derived from the *assumed* selection procedure. It is only
 * achievable if every character really was drawn uniformly at random from the
 * stated pool. Human-chosen or pattern-laden values score far lower in
 * practice, and no formula can rescue a password an attacker can guess by
 * pattern-matching.
 */

import { CHARACTER_SETS } from "@/lib/crypto/password";

export interface PoolDescription {
  lowercase: boolean;
  uppercase: boolean;
  digits: boolean;
  symbols: boolean;
}

/** Size of the character pool implied by the selected groups. */
export function poolSize(pool: PoolDescription): number {
  let size = 0;
  if (pool.lowercase) size += CHARACTER_SETS.lowercase.length;
  if (pool.uppercase) size += CHARACTER_SETS.uppercase.length;
  if (pool.digits) size += CHARACTER_SETS.digits.length;
  if (pool.symbols) size += CHARACTER_SETS.symbols.length;
  return size;
}

/**
 * Entropy of a uniformly random string of `length` characters drawn from a
 * pool of `poolSize` characters:  H = length x log2(poolSize).
 */
export function characterEntropy(length: number, poolSizeValue: number): number {
  if (length <= 0 || poolSizeValue <= 0) return 0;
  return length * Math.log2(poolSizeValue);
}

/** Entropy of `wordCount` uniformly chosen words from a list of `listSize`. */
export function wordEntropy(wordCount: number, listSize: number): number {
  if (wordCount <= 0 || listSize <= 0) return 0;
  return wordCount * Math.log2(listSize);
}

export interface PatternPenalty {
  /** Human-readable name of the detected pattern. */
  label: string;
  /** Multiplier applied to the base entropy, between 0 and 1. */
  factor: number;
  detail: string;
}

/**
 * Detects structure that reduces real-world entropy below the theoretical
 * maximum. Each finding shrinks the effective entropy estimate.
 */
export function detectPatterns(value: string): PatternPenalty[] {
  const penalties: PatternPenalty[] = [];

  if (value.length === 0) return penalties;

  // Repeating characters: "aaaa", "1111"
  const repeatMatch = value.match(/(.)\1{2,}/);
  if (repeatMatch) {
    penalties.push({
      label: "Repeated characters",
      factor: 0.75,
      detail: `The character "${repeatMatch[1]}" repeats ${repeatMatch[0].length} times in a row, which most generators would not produce.`,
    });
  }

  // Ascending or descending runs: "abcd", "9876"
  if (hasSequence(value, 1) || hasSequence(value, -1)) {
    penalties.push({
      label: "Sequential characters",
      factor: 0.8,
      detail:
        "The value contains a run of characters in order (such as abcd or 9876), which is trivial to guess.",
    });
  }

  // Keyboard walks: "qwerty", "asdfgh"
  if (hasKeyboardWalk(value)) {
    penalties.push({
      label: "Keyboard pattern",
      factor: 0.6,
      detail:
        "The value follows a keyboard row such as qwerty or asdf, one of the first patterns crackers try.",
    });
  }

  // Repeated chunks: "abcabcabc"
  if (hasRepeatedChunk(value)) {
    penalties.push({
      label: "Repeated sequence",
      factor: 0.7,
      detail: "A substring of the value repeats, so the true randomness is lower than it appears.",
    });
  }

  // A year, or other very common numbers.
  if (/(19|20)\d{2}/.test(value)) {
    penalties.push({
      label: "Contains a year",
      factor: 0.9,
      detail: "Four-digit years are a small enough space to be brute-forced quickly.",
    });
  }

  // Separated by a single repeated delimiter, e.g. "word-word-word".
  if (/(\w)[-_.]\1/i.test(value)) {
    penalties.push({
      label: "Repeating separator",
      factor: 0.95,
      detail: "A consistent separator reduces the number of choices actually used.",
    });
  }

  return penalties;
}

/** True if the value contains three or more consecutive ascending characters. */
function hasSequence(value: string, direction: 1 | -1): boolean {
  let run = 1;

  for (let i = 1; i < value.length; i += 1) {
    const delta = value.charCodeAt(i) - value.charCodeAt(i - 1);
    if (delta === direction) {
      run += 1;
      if (run >= 3) return true;
    } else {
      run = 1;
    }
  }

  return false;
}

const KEYBOARD_ROWS = ["qwertyuiop", "asdfghjkl", "zxcvbnm", "1234567890"];

function hasKeyboardWalk(value: string): boolean {
  const lower = value.toLowerCase();

  return KEYBOARD_ROWS.some((row) => {
    for (let i = 0; i + 3 <= row.length; i += 1) {
      const run = row.slice(i, i + 3);
      if (lower.includes(run) || lower.includes([...run].reverse().join(""))) {
        return true;
      }
    }
    return false;
  });
}

function hasRepeatedChunk(value: string): boolean {
  const lower = value.toLowerCase();

  for (let size = 2; size <= Math.floor(lower.length / 2); size += 1) {
    const chunk = lower.slice(0, size);
    if (lower === chunk.repeat(lower.length / size)) return true;
    if (lower.slice(0, size * 2) === chunk + chunk) return true;
  }

  return false;
}

export interface EntropyEstimate {
  /** Theoretical maximum under the assumed procedure. */
  maxBits: number;
  /** Estimate after pattern penalties are applied. */
  effectiveBits: number;
  poolSizeValue: number;
  penalties: PatternPenalty[];
}

/**
 * Estimates entropy for a value given the pool it is claimed to come from.
 */
export function estimateEntropy(
  value: string,
  pool: PoolDescription,
): EntropyEstimate {
  const size = poolSize(pool);
  const maxBits = characterEntropy(value.length, size);
  const penalties = detectPatterns(value);

  // Penalties compound multiplicatively; a value can exhibit several at once.
  const factor = penalties.reduce((total, item) => total * item.factor, 1);

  return {
    maxBits,
    effectiveBits: maxBits * factor,
    poolSizeValue: size,
    penalties,
  };
}

/**
 * Reference table of practical strength targets, used to colour meters.
 * Thresholds are illustrative, not a guarantee.
 */
export function strengthLabel(bits: number): {
  label: string;
  tone: "danger" | "warning" | "success";
  guidance: string;
} {
  if (bits < 40) {
    return {
      label: "Very weak",
      tone: "danger",
      guidance:
        "Far below the threshold for offline attacks. A well-resourced attacker would try this almost immediately.",
    };
  }

  if (bits < 60) {
    return {
      label: "Weak",
      tone: "danger",
      guidance:
        "Resists casual guessing only. Add length before adding complexity.",
    };
  }

  if (bits < 80) {
    return {
      label: "Reasonable",
      tone: "warning",
      guidance:
        "Acceptable for low-value accounts, but not for anything you would mind losing.",
    };
  }

  if (bits < 112) {
    return {
      label: "Strong",
      tone: "success",
      guidance:
        "Comfortable against offline cracking with current hardware. Reuse is still the main risk.",
    };
  }

  return {
    label: "Very strong",
    tone: "success",
    guidance:
      "Well beyond the reach of current offline attacks, assuming the value was generated randomly.",
  };
}