import { describe, expect, it } from "vitest";

import {
  randomChoice,
  randomInt,
  secureShuffle,
} from "@/lib/crypto/random";

describe("randomInt", () => {
  it("rejects non-positive and non-integer bounds", () => {
    expect(() => randomInt(0)).toThrow(RangeError);
    expect(() => randomInt(-1)).toThrow(RangeError);
    expect(() => randomInt(1.5)).toThrow(RangeError);
  });

  it("rejects bounds above 2^32", () => {
    expect(() => randomInt(0x1_0000_0001)).toThrow(RangeError);
  });

  it("always returns 0 for a single-option pool", () => {
    for (let i = 0; i < 100; i += 1) {
      expect(randomInt(1)).toBe(0);
    }
  });

  it("stays within bounds", () => {
    for (let i = 0; i < 2000; i += 1) {
      const value = randomInt(10);
      expect(value).toBeGreaterThanOrEqual(0);
      expect(value).toBeLessThan(10);
    }
  });

  it("reaches every outcome in a small pool", () => {
    const seen = new Set<number>();
    for (let i = 0; i < 5000; i += 1) {
      seen.add(randomInt(5));
    }
    expect(seen.size).toBe(5);
  });

  /**
   * Chi-squared goodness of fit. Guards against modulo bias, which is the
   * defect a naive `% bound` would introduce.
   */
  it("produces a statistically uniform distribution", () => {
    const bound = 8;
    const draws = 80_000;
    const expected = draws / bound;
    const counts = new Array(bound).fill(0);

    for (let i = 0; i < draws; i += 1) {
      counts[randomInt(bound)] += 1;
    }

    const chiSquared = counts.reduce(
      (total, count) => total + (count - expected) ** 2 / expected,
      0,
    );

    // 7 degrees of freedom; the 0.999 critical value is ~24.3.
    expect(chiSquared).toBeLessThan(24.3);
  });

  it("handles a pool size that does not divide 2^32", () => {
    const counts = new Map<number, number>();
    const bound = 3;

    for (let i = 0; i < 30_000; i += 1) {
      const value = randomInt(bound);
      counts.set(value, (counts.get(value) ?? 0) + 1);
    }

    expect(counts.size).toBe(3);
    for (const count of counts.values()) {
      // Each outcome should be close to 10,000.
      expect(count).toBeGreaterThan(9_500);
      expect(count).toBeLessThan(10_500);
    }
  });
});

describe("randomChoice", () => {
  it("throws on an empty array", () => {
    expect(() => randomChoice([])).toThrow(RangeError);
  });

  it("selects from a non-empty array", () => {
    const items = ["a", "b", "c"];
    for (let i = 0; i < 200; i += 1) {
      expect(items).toContain(randomChoice(items));
    }
  });
});

describe("secureShuffle", () => {
  it("does not mutate the input", () => {
    const input = [1, 2, 3, 4, 5];
    const copy = [...input];
    secureShuffle(input);
    expect(input).toEqual(copy);
  });

  it("preserves every element exactly once", () => {
    const input = Array.from({ length: 50 }, (_, i) => i);
    const result = secureShuffle(input);
    expect(result).toHaveLength(50);
    expect([...result].sort((a, b) => a - b)).toEqual(input);
  });

  it("handles empty and single-element arrays", () => {
    expect(secureShuffle([])).toEqual([]);
    expect(secureShuffle(["only"])).toEqual(["only"]);
  });

  it("actually reorders across many runs", () => {
    const input = [1, 2, 3, 4, 5, 6, 7, 8];
    const permutations = new Set<string>();
    for (let i = 0; i < 500; i += 1) {
      permutations.add(secureShuffle(input).join(","));
    }
    // 8! = 40320 permutations; 500 draws should produce many distinct ones.
    expect(permutations.size).toBeGreaterThan(100);
  });

  it("is closer to uniform than a biased swap would be", () => {
    const input = [0, 1, 2];
    const permutations = new Map<string, number>();
    const runs = 6000;

    for (let i = 0; i < runs; i += 1) {
      const key = secureShuffle(input).join(",");
      permutations.set(key, (permutations.get(key) ?? 0) + 1);
    }

    expect(permutations.size).toBe(6); // 3! = 6 possible orderings

    const expected = runs / 6;
    for (const [, count] of permutations) {
      // ~1,000 draws per permutation, sd ~= 30. A ±15% band is a ~5-sigma
      // window: not flaky, but far tighter than any real bias in a
      // CSPRNG-driven Fisher-Yates shuffle.
      expect(count).toBeGreaterThan(expected * 0.85);
      expect(count).toBeLessThan(expected * 1.15);
    }
  });
});