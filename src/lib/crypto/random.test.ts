import { describe, expect, it } from "vitest";

import {
  randomChoice,
  randomInt,
  secureSample,
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

describe("secureSample", () => {
  it("does not mutate the input", () => {
    const input = [1, 2, 3, 4, 5];
    const copy = [...input];
    secureSample(input, 3);
    expect(input).toEqual(copy);
  });

  it("returns the requested number of distinct elements", () => {
    const input = Array.from({ length: 100 }, (_, i) => i);
    const result = secureSample(input, 8);
    expect(result).toHaveLength(8);
    expect(new Set(result).size).toBe(8);
    for (const value of result) expect(input).toContain(value);
  });

  it("handles the empty, zero-count and full-count edge cases", () => {
    expect(secureSample([], 0)).toEqual([]);
    expect(secureSample(["a", "b"], 0)).toEqual([]);
    expect([...secureSample(["a"], 1)]).toEqual(["a"]);
    // count === items.length must behave like a full shuffle.
    const full = secureSample([1, 2, 3, 4, 5], 5);
    expect(full).toHaveLength(5);
    expect([...full].sort((a, b) => a - b)).toEqual([1, 2, 3, 4, 5]);
  });

  it("rejects invalid counts", () => {
    expect(() => secureSample([1, 2, 3], -1)).toThrow(RangeError);
    expect(() => secureSample([1, 2, 3], 1.5)).toThrow(RangeError);
    expect(() => secureSample([1, 2, 3], 4)).toThrow(RangeError);
  });

  /**
   * The whole point of the rewrite: the sample must be unbiased, not merely
   * distinct. If selection favoured early positions this would fail.
   */
  it("selects each element with equal probability", () => {
    const size = 6;
    const count = 2;
    const input = Array.from({ length: size }, (_, i) => i);
    const runs = 12_000;
    const counts = new Array(size).fill(0) as number[];

    for (let i = 0; i < runs; i += 1) {
      for (const value of secureSample(input, count)) counts[value] += 1;
    }

    // Each element should be drawn count/size of the time: 4,000.
    const expected = (runs * count) / size;
    for (const observed of counts) {
      expect(observed).toBeGreaterThan(expected * 0.92);
      expect(observed).toBeLessThan(expected * 1.08);
    }
  });

  it("preserves the full permutation distribution when count equals length", () => {
    const input = [0, 1, 2];
    const seen = new Map<string, number>();
    const runs = 6000;

    for (let i = 0; i < runs; i += 1) {
      const key = secureSample(input, 3).join(",");
      seen.set(key, (seen.get(key) ?? 0) + 1);
    }

    expect(seen.size).toBe(6);
    const expected = runs / 6;
    for (const observed of seen.values()) {
      expect(observed).toBeGreaterThan(expected * 0.85);
      expect(observed).toBeLessThan(expected * 1.15);
    }
  });
});