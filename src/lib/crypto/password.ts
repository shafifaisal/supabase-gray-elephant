/**
 * Character sets and the password / random string generator.
 *
 * Pure, synchronous and dependency-free so it can be exhaustively unit-tested.
 * Nothing here performs I/O: generated values are returned to the caller and
 * never transmitted or persisted.
 */

import { randomInt, secureShuffle } from "./random";

export interface CharacterSets {
  lowercase: boolean;
  uppercase: boolean;
  digits: boolean;
  symbols: boolean;
}

export const CHARACTER_SETS = {
  lowercase: "abcdefghijklmnopqrstuvwxyz",
  uppercase: "ABCDEFGHIJKLMNOPQRSTUVWXYZ",
  digits: "0123456789",
  symbols: "!@#$%^&*()-_=+[]{};:,.?/",
} as const;

/**
 * Visually ambiguous characters, removed on request. Useful when a password
 * must be read aloud or transcribed from a screen.
 */
export const AMBIGUOUS_CHARACTERS = {
  lowercase: "ilo",
  uppercase: "IO",
  digits: "01",
  symbols: "|",
} as const;

export const ALL_AMBIGUOUS = Object.values(AMBIGUOUS_CHARACTERS).join("");

/** Hex characters, offered as a preset for tokens and checksums. */
export const HEX_CHARACTERS = "0123456789abcdef";

/** Base64url alphabet, without padding, suitable for URL-safe tokens. */
export const BASE64URL_CHARACTERS =
  "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-_";

export interface GenerationOptions {
  length: number;
  sets: CharacterSets;
  /** Remove characters that are easy to confuse with one another. */
  excludeAmbiguous?: boolean;
}

export interface GenerationError {
  code:
    | "INVALID_LENGTH"
    | "NO_SETS_ENABLED"
    | "LENGTH_TOO_SMALL_FOR_SETS";
  message: string;
  /** Minimum length needed to include every enabled character group. */
  minimumLength?: number;
}

export type GenerationResult =
  | { ok: true; value: string }
  | { ok: false; error: GenerationError };

/** Builds the character pool implied by the selected sets. */
export function buildPool(
  sets: CharacterSets,
  excludeAmbiguous = false,
): string {
  const pool: string[] = [];

  if (sets.lowercase) pool.push(CHARACTER_SETS.lowercase);
  if (sets.uppercase) pool.push(CHARACTER_SETS.uppercase);
  if (sets.digits) pool.push(CHARACTER_SETS.digits);
  if (sets.symbols) pool.push(CHARACTER_SETS.symbols);

  let combined = pool.join("");

  if (excludeAmbiguous) {
    const ambiguous = new Set(ALL_AMBIGUOUS.split(""));
    combined = [...combined].filter((char) => !ambiguous.has(char)).join("");
  }

  // De-duplicate defensively; the sets above are disjoint but this keeps the
  // function correct if a custom set ever overlaps.
  return [...new Set(combined)].join("");
}

/** Number of distinct character groups the user enabled. */
export function countEnabledSets(sets: CharacterSets): number {
  return Object.values(sets).filter(Boolean).length;
}

/**
 * Generates a random password.
 *
 * Guarantees:
 *  - Every character is drawn from the pool with a CSPRNG and no modulo bias.
 *  - Every enabled character group is represented at least once when the
 *    length allows it.
 *  - Impossible configurations are rejected rather than silently returning a
 *    weaker result.
 */
export function generatePassword(options: GenerationOptions): GenerationResult {
  const { length, sets } = options;
  const excludeAmbiguous = options.excludeAmbiguous ?? false;

  if (!Number.isInteger(length) || length < 1) {
    return {
      ok: false,
      error: {
        code: "INVALID_LENGTH",
        message: "Length must be a positive whole number.",
      },
    };
  }

  const enabledCount = countEnabledSets(sets);
  if (enabledCount === 0) {
    return {
      ok: false,
      error: {
        code: "NO_SETS_ENABLED",
        message: "Select at least one character group.",
      },
    };
  }

  // To include every enabled group at least once, we need at least that many
  // characters. Anything less is an impossible request.
  if (length < enabledCount) {
    return {
      ok: false,
      error: {
        code: "LENGTH_TOO_SMALL_FOR_SETS",
        message: `Length ${length} cannot include all ${enabledCount} selected character groups. Use at least ${enabledCount}.`,
        minimumLength: enabledCount,
      },
    };
  }

  const pool = buildPool(sets, excludeAmbiguous);

  if (pool.length === 0) {
    return {
      ok: false,
      error: {
        code: "NO_SETS_ENABLED",
        message:
          "The selected options exclude every character. Disable the ambiguous-character filter or select more groups.",
      },
    };
  }

  return { ok: true, value: generateFromPool(pool, length, sets, excludeAmbiguous) };
}

/**
 * Generates a uniformly random string from an explicit character pool.
 *
 * This is the primitive behind the password generator, the passphrase
 * generator (one call per word) and the random string generator.
 */
export function generateFromPool(
  pool: string,
  length: number,
  sets: CharacterSets,
  excludeAmbiguous: boolean,
): string {
  const chars: string[] = [];

  // Phase 1 — seed one character from each enabled group so the result is
  // guaranteed to satisfy the "must contain every selected type" expectation.
  const groups = buildGroups(sets, excludeAmbiguous).filter((g) => g.length > 0);

  for (const group of groups) {
    chars.push(group[randomInt(group.length)]!);
  }

  // Phase 2 — fill the remainder from the full pool.
  for (let i = chars.length; i < length; i += 1) {
    chars.push(pool[randomInt(pool.length)]!);
  }

  // Shuffle so the mandatory characters are not in predictable positions.
  return secureShuffle(chars).join("");
}

/** Per-group pools, after the ambiguous-character filter is applied. */
function buildGroups(sets: CharacterSets, excludeAmbiguous: boolean): string[] {
  const groups: string[] = [];
  const ambiguous = new Set(ALL_AMBIGUOUS.split(""));

  const filter = (value: string) =>
    excludeAmbiguous
      ? [...value].filter((char) => !ambiguous.has(char)).join("")
      : value;

  if (sets.lowercase) groups.push(filter(CHARACTER_SETS.lowercase));
  if (sets.uppercase) groups.push(filter(CHARACTER_SETS.uppercase));
  if (sets.digits) groups.push(filter(CHARACTER_SETS.digits));
  if (sets.symbols) groups.push(filter(CHARACTER_SETS.symbols));

  return groups;
}

export interface RandomStringOptions {
  length: number;
  charset: string;
}

/**
 * Generates a uniform random string from an arbitrary character set.
 *
 * Unlike `generatePassword` this makes no promise about composition — every
 * character is drawn independently from the whole pool. Used for API keys,
 * tokens and salts where the caller supplies their own alphabet.
 */
export function generateRandomString(
  options: RandomStringOptions,
): GenerationResult {
  const { length, charset } = options;

  if (!Number.isInteger(length) || length < 1) {
    return {
      ok: false,
      error: {
        code: "INVALID_LENGTH",
        message: "Length must be a positive whole number.",
      },
    };
  }

  const pool = [...new Set(charset)].join("");

  if (pool.length === 0) {
    return {
      ok: false,
      error: {
        code: "NO_SETS_ENABLED",
        message: "Select at least one character.",
      },
    };
  }

  const chars: string[] = [];
  for (let i = 0; i < length; i += 1) {
    chars.push(pool[randomInt(pool.length)]!);
  }

  return { ok: true, value: chars.join("") };
}