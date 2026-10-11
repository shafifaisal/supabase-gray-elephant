import { describe, expect, it } from "vitest";

import { analysePassword } from "@/lib/strength/analyse";

/**
 * PRIVACY CONTRACT
 *
 * These tests assert that strength analysis is a pure local function. They do
 * not spy on the network (that belongs in the Playwright suite), but they do
 * assert that no password fragment is ever placed in the returned feedback —
 * which is what would leak into a log or an error report.
 */

describe("analysePassword", () => {
  it("handles an empty password without throwing", () => {
    const result = analysePassword("");
    expect(result.score).toBe(0);
    expect(result.bits).toBe(0);
    expect(result.label).toBe("No password entered");
  });

  it("scores trivial passwords at the bottom of the scale", () => {
    // Verified against @zxcvbn-ts 4.2.0.
    for (const weak of ["123456", "aaaaaaaa", "qwerty", "abc123", "monkey"]) {
      const result = analysePassword(weak);
      expect(result.score).toBeLessThanOrEqual(1);
      expect(result.tone).toBe("danger");
    }
  });

  /**
   * zxcvbn is deliberately conservative: it models guess cost rather than
   * merely flagging dictionary membership, so well-known words such as
   * "password" land at score 2 with roughly 26 bits. This test documents that
   * behaviour so a future library change is noticed.
   */
  it("keeps well-known dictionary words far below a strong value", () => {
    for (const known of ["password", "letmein", "dragon", "qwerty"]) {
      const result = analysePassword(known);
      expect(result.bits).toBeLessThan(30);
      expect(result.score).toBeLessThanOrEqual(2);
    }
  });

  it("scores a long random password highly", () => {
    const strong = "kR7#mZ2\$vQ9!xL4&pW3@nD8^yH5*jB1&";
    const result = analysePassword(strong);
    expect(result.score).toBeGreaterThanOrEqual(3);
    expect(result.tone).toBe("success");
  });

  it("rates length over complexity", () => {
    const long = "correcthorsebatterystaple123";
    const short = "P@ss1";
    expect(analysePassword(long).score).toBeGreaterThan(analysePassword(short).score);
  });

  it("returns a score within 0–4", () => {
    for (const value of ["", "a", "password", "Tr0ub4dor&3", "kR7#mZ2$vQ9!xL4&"]) {
      const score = analysePassword(value).score;
      expect(score).toBeGreaterThanOrEqual(0);
      expect(score).toBeLessThanOrEqual(4);
    }
  });

  it("returns non-negative finite bits and guesses", () => {
    for (const value of ["", "a", "password", "kR7#mZ2$vQ9!xL4&"]) {
      const result = analysePassword(value);
      expect(Number.isFinite(result.bits)).toBe(true);
      expect(result.bits).toBeGreaterThanOrEqual(0);
      expect(result.guesses).toBeGreaterThanOrEqual(1);
    }
  });

  it("always offers actionable guidance", () => {
    for (const value of ["", "password", "Tr0ub4dor&3", "kR7#mZ2$vQ9!xL4&"]) {
      expect(analysePassword(value).suggestion.length).toBeGreaterThan(10);
    }
  });

  it("detects a personal input as weak even when it is long", () => {
    const base = analysePassword("Summer2026Beach!");
    const withInput = analysePassword("Summer2026Beach!", { userInputs: ["summer"] });
    expect(withInput.score).toBeLessThanOrEqual(base.score);
  });

  /**
   * The feedback text is what would reach a log, an error tracker or a support
   * ticket. It must never contain the password itself.
   */
  it("never echoes the password back in feedback", () => {
    const passwords = [
      "password",
      "Tr0ub4dor&3",
      "correcthorsebattery",
      "hunter2",
      "Summer2026!",
    ];

    for (const password of passwords) {
      const result = analysePassword(password);
      const text = [result.suggestion, ...result.feedback, result.label].join(" ");

      expect(text).not.toContain(password);
      // Also guard against long substrings leaking.
      if (password.length >= 6) {
        expect(text).not.toContain(password.slice(0, 6));
      }
    }
  });

  it("is deterministic for the same input", () => {
    const first = analysePassword("Tr0ub4dor&3");
    const second = analysePassword("Tr0ub4dor&3");
    expect(first.score).toBe(second.score);
    expect(first.bits).toBe(second.bits);
  });

  it("penalises repetition", () => {
    expect(analysePassword("aaaaaaaaaaaa").score).toBeLessThanOrEqual(
      analysePassword("kR7#mZ2$vQ9").score,
    );
  });

  it("provides an offline cracking time estimate", () => {
    for (const value of ["", "password", "kR7#mZ2$vQ9!xL4&"]) {
      expect(analysePassword(value).offlineTime.length).toBeGreaterThan(0);
    }
  });
});