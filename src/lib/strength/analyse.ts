/**
 * Local-only password strength estimation.
 *
 * Uses the Dropbox zxcvbn algorithm via the actively maintained
 * `@zxcvbn-ts` TypeScript port. It matches the password against a bundled
 * corpus of common passwords and English words, applies l33t-substitution
 * normalisation, and detects spatial (keyboard), repeat and sequence patterns.
 *
 * PRIVACY
 * -------
 * The password is analysed in this module, in the browser, and is never passed
 * to a server, stored, or logged. Callers must not add telemetry around it.
 *
 * A score is an ESTIMATE of resistance to guessing. It is not a guarantee of
 * safety, and it cannot know whether the same password protects other
 * accounts. See the disclaimer in the tool UI.
 */

import { ZxcvbnFactory } from "@zxcvbn-ts/core";
import type { FeedbackType, Score, ZxcvbnResult } from "@zxcvbn-ts/core";

import { describeOfflineGuessing } from "@/lib/crypto/passphrase";

export interface StrengthResult {
  /** 0–4, matching the conventional meter scale. */
  score: Score;
  /** Estimated guesses required to find this password offline. */
  guesses: number;
  /** Estimated bits of entropy: log2(guesses). */
  bits: number;
  label: string;
  tone: "danger" | "warning" | "success";
  /** Human-readable reasons for the score. Never includes the password. */
  feedback: string[];
  /** The single most useful improvement. */
  suggestion: string;
  /** Time to crack at 10 billion guesses/second. */
  offlineTime: string;
}

const SCORE_LABELS: Record<number, string> = {
  0: "Very weak",
  1: "Weak",
  2: "Reasonable",
  3: "Strong",
  4: "Very strong",
};

const SCORE_TONES: Record<number, StrengthResult["tone"]> = {
  0: "danger",
  1: "danger",
  2: "warning",
  3: "success",
  4: "success",
};

/**
 * Instantiated once. Construction builds the matcher indexes, which is
 * comparatively expensive, so this is deliberately module-level rather than
 * per-call.
 */
const zxcvbn = new ZxcvbnFactory();

export interface AnalyseOptions {
  /**
   * Personal strings (name, username, email prefix). Used only to flag a
   * password that embeds them. Compared locally; never transmitted.
   */
  userInputs?: (string | number)[];
}

/**
 * Turns zxcvbn's warnings and suggestions into one actionable next step.
 * Deliberately generic — it must never echo the password.
 */
function buildSuggestion(feedback: FeedbackType): string {
  const warning = (feedback.warning ?? "").toLowerCase();

  if (warning.includes("dictionary") || warning.includes("predictable")) {
    return "This looks like a common password. Use several unrelated words, or a generated random string, instead.";
  }

  if (warning.includes("repeat")) {
    return "Repeated characters add almost no strength. Use a longer value with no repetition.";
  }

  if (warning.includes("sequence")) {
    return "Sequences such as abc or 1234 are among the first things tried. Replace them with unrelated characters.";
  }

  if (warning.includes("spatial")) {
    return "Keyboard runs such as qwerty are well known to attackers. Avoid them.";
  }

  if (warning.includes("l33t") || warning.includes("leet")) {
    return "Swapping a for @ and o for 0 helps very little — cracking tools undo those substitutions automatically.";
  }

  if (warning.includes("date") || warning.includes("year")) {
    return "Dates and years are easy to guess. Leave them out.";
  }

  if (warning.includes("short")) {
    return "Length beats complexity. Aim for at least 16 characters for important accounts.";
  }

  return "Longer and more random beats more complicated. A generated passphrase of four or more words is a good target.";
}

/** Collects warning text and suggestions without ever including the input. */
function collectFeedback(feedback: FeedbackType): string[] {
  const messages: string[] = [];

  if (feedback.warning) messages.push(feedback.warning);
  for (const suggestion of feedback.suggestions ?? []) {
    messages.push(suggestion);
  }

  return messages;
}

/**
 * Analyses a password entirely on the client.
 */
export function analysePassword(
  password: string,
  options: AnalyseOptions = {},
): StrengthResult {
  if (password.length === 0) {
    return {
      score: 0 as Score,
      guesses: 1,
      bits: 0,
      label: "No password entered",
      tone: "danger",
      feedback: [],
      suggestion: "Type or paste a password to estimate its strength.",
      offlineTime: "instantly",
    };
  }

  const result: ZxcvbnResult = zxcvbn.check(
    password,
    options.userInputs ?? [],
  );

  const score = Math.min(4, Math.max(0, result.score)) as Score;
  const guesses = Math.max(1, result.guesses);
  const bits = Math.log2(guesses);

  return {
    score,
    guesses,
    bits,
    label: SCORE_LABELS[score] ?? "Unknown",
    tone: SCORE_TONES[score] ?? "warning",
    feedback: collectFeedback(result.feedback),
    suggestion: buildSuggestion(result.feedback),
    offlineTime: describeOfflineGuessing(bits),
  };
}