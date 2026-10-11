import { describe, expect, it } from "vitest";

import { CHARACTER_SETS } from "@/lib/crypto/password";
import { BITS_PER_WORD } from "@/lib/crypto/wordlist";
import {
  characterEntropy,
  detectPatterns,
  estimateEntropy,
  poolSize,
  strengthLabel,
  wordEntropy,
} from "@/lib/entropy/calculator";

const ALL = { lowercase: true, uppercase: true, digits: true, symbols: true };

describe("poolSize", () => {
  it("returns zero when nothing is selected", () => {
    expect(poolSize({ lowercase: false, uppercase: false, digits: false, symbols: false })).toBe(0);
  });

  it("computes each group correctly", () => {
    expect(poolSize({ lowercase: true, uppercase: false, digits: false, symbols: false })).toBe(26);
    expect(poolSize({ lowercase: false, uppercase: true, digits: false, symbols: false })).toBe(26);
    expect(poolSize({ lowercase: false, uppercase: false, digits: true, symbols: false })).toBe(10);
  });

  it("sums the enabled groups", () => {
    // 26 + 26 + 10 = 62
    expect(poolSize({ lowercase: true, uppercase: true, digits: true, symbols: false })).toBe(62);
  });

  it("equals 86 for the full printable set we offer", () => {
    // 26 lowercase + 26 uppercase + 10 digits + 24 symbols.
    expect(poolSize(ALL)).toBe(86);
    expect(poolSize(ALL)).toBe(
      26 + 26 + 10 + CHARACTER_SETS.symbols.length,
    );
  });
});

describe("characterEntropy", () => {
  it("is zero for degenerate inputs", () => {
    expect(characterEntropy(0, 94)).toBe(0);
    expect(characterEntropy(10, 0)).toBe(0);
    expect(characterEntropy(-1, 94)).toBe(0);
  });

  it("matches length x log2(pool)", () => {
    expect(characterEntropy(10, 94)).toBeCloseTo(10 * Math.log2(94), 10);
    expect(characterEntropy(20, 62)).toBeCloseTo(20 * Math.log2(62), 10);
  });

  it("matches hand-checked values", () => {
    // 10 characters from a 2-symbol pool = 10 bits exactly.
    expect(characterEntropy(10, 2)).toBeCloseTo(10, 10);
    // 8 characters from a 256-symbol pool = 64 bits exactly.
    expect(characterEntropy(8, 256)).toBeCloseTo(64, 10);
    // 10 characters from a 1024-symbol pool = 100 bits exactly.
    expect(characterEntropy(10, 1024)).toBeCloseTo(100, 10);
  });

  it("scales linearly with length", () => {
    expect(characterEntropy(20, 86) / characterEntropy(10, 86)).toBeCloseTo(2, 10);
  });

  it("scales logarithmically with pool size", () => {
    expect(characterEntropy(10, 62)).toBeLessThan(characterEntropy(10, 86));
  });
});

describe("wordEntropy", () => {
  it("is zero for degenerate inputs", () => {
    expect(wordEntropy(0, 7776)).toBe(0);
    expect(wordEntropy(5, 0)).toBe(0);
  });

  it("matches wordCount x log2(listSize)", () => {
    expect(wordEntropy(6, 7776)).toBeCloseTo(6 * BITS_PER_WORD, 10);
    expect(wordEntropy(6, 7776)).toBeCloseTo(77.5488, 3);
  });

  it("matches hand-checked values", () => {
    // 6 words from a 64-word list = exactly 36 bits.
    expect(wordEntropy(6, 64)).toBeCloseTo(36, 10);
    // 4 words from a 256-word list = exactly 32 bits.
    expect(wordEntropy(4, 256)).toBeCloseTo(32, 10);
  });
});

describe("detectPatterns", () => {
  it("finds nothing in a random-looking value", () => {
    expect(detectPatterns("kR7#mZ2$vQ9!xL4&")).toHaveLength(0);
  });

  it("detects repeated characters", () => {
    const penalties = detectPatterns("aaaaX9k");
    expect(penalties.some((p) => p.label === "Repeated characters")).toBe(true);
  });

  it("detects ascending and descending sequences", () => {
    expect(detectPatterns("xyz9Kq").some((p) => p.label === "Sequential characters")).toBe(true);
    expect(detectPatterns("9876mKq").some((p) => p.label === "Sequential characters")).toBe(true);
  });

  it("detects keyboard walks", () => {
    expect(detectPatterns("qwertyui").some((p) => p.label === "Keyboard pattern")).toBe(true);
    expect(detectPatterns("asdfghjk").some((p) => p.label === "Keyboard pattern")).toBe(true);
  });

  it("detects a repeated substring", () => {
    expect(detectPatterns("abcabcabcabc").some((p) => p.label === "Repeated sequence")).toBe(true);
  });

  it("detects a year", () => {
    expect(detectPatterns("pass2024word").some((p) => p.label === "Contains a year")).toBe(true);
  });

  it("returns nothing for an empty value", () => {
    expect(detectPatterns("")).toHaveLength(0);
  });

  it("gives every penalty a factor below one", () => {
    const penalties = detectPatterns("aaaaqwerty2024abcabc");
    expect(penalties.length).toBeGreaterThan(1);
    for (const penalty of penalties) {
      expect(penalty.factor).toBeLessThan(1);
      expect(penalty.factor).toBeGreaterThan(0);
    }
  });
});

describe("estimateEntropy", () => {
  it("returns the maximum when no patterns are found", () => {
    const result = estimateEntropy("kR7#mZ2$vQ9!xL4&", ALL);
    expect(result.effectiveBits).toBeCloseTo(result.maxBits, 10);
    expect(result.penalties).toHaveLength(0);
  });

  it("reduces the estimate when patterns are present", () => {
    const result = estimateEntropy("aaaaaaaaaaaa", ALL);
    expect(result.effectiveBits).toBeLessThan(result.maxBits);
  });

  it("never exceeds the theoretical maximum", () => {
    for (const value of ["password", "aaaa", "qwerty", "abcabc", "pass2024"]) {
      const result = estimateEntropy(value, ALL);
      expect(result.effectiveBits).toBeLessThanOrEqual(result.maxBits);
    }
  });

  it("reports the pool size it assumed", () => {
    expect(estimateEntropy("abcdefgh", ALL).poolSizeValue).toBe(86);
  });
});

describe("strengthLabel", () => {
  it("escalates monotonically with entropy", () => {
    expect(strengthLabel(10).label).toBe("Very weak");
    expect(strengthLabel(50).label).toBe("Weak");
    expect(strengthLabel(70).label).toBe("Reasonable");
    expect(strengthLabel(100).label).toBe("Strong");
    expect(strengthLabel(140).label).toBe("Very strong");
  });

  it("always returns guidance text", () => {
    for (const bits of [0, 30, 60, 90, 120, 200]) {
      expect(strengthLabel(bits).guidance.length).toBeGreaterThan(10);
    }
  });

  it("maps to the expected tone", () => {
    expect(strengthLabel(10).tone).toBe("danger");
    expect(strengthLabel(70).tone).toBe("warning");
    expect(strengthLabel(140).tone).toBe("success");
  });
});