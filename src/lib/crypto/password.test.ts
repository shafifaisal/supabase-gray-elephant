import { describe, expect, it } from "vitest";

import {
  ALL_AMBIGUOUS,
  buildPool,
  generatePassword,
  generateRandomString,
} from "@/lib/crypto/password";

const ALL_SETS = { lowercase: true, uppercase: true, digits: true, symbols: true };

describe("buildPool", () => {
  it("is empty when nothing is selected", () => {
    expect(buildPool({ lowercase: false, uppercase: false, digits: false, symbols: false })).toBe("");
  });

  it("has the expected size for a single group", () => {
    expect(buildPool({ lowercase: true, uppercase: false, digits: false, symbols: false })).toHaveLength(26);
    expect(buildPool({ lowercase: false, uppercase: true, digits: false, symbols: false })).toHaveLength(26);
    expect(buildPool({ lowercase: false, uppercase: false, digits: true, symbols: false })).toHaveLength(10);
  });

  it("never contains duplicates", () => {
    const pool = buildPool(ALL_SETS);
    expect(new Set(pool).size).toBe(pool.length);
  });

  it("removes every ambiguous character when asked", () => {
    const pool = buildPool(ALL_SETS, true);
    for (const char of ALL_AMBIGUOUS.split("")) {
      expect(pool).not.toContain(char);
    }
  });
});

describe("generatePassword", () => {
  it("rejects a non-positive length", () => {
    const result = generatePassword({ length: 0, sets: ALL_SETS });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error.code).toBe("INVALID_LENGTH");
  });

  it("rejects a fractional length", () => {
    const result = generatePassword({ length: 8.5, sets: ALL_SETS });
    expect(result.ok).toBe(false);
  });

  it("rejects when no character group is enabled", () => {
    const result = generatePassword({
      length: 16,
      sets: { lowercase: false, uppercase: false, digits: false, symbols: false },
    });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error.code).toBe("NO_SETS_ENABLED");
  });

  it("rejects a length too small to include every enabled group", () => {
    const result = generatePassword({ length: 2, sets: ALL_SETS });
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.code).toBe("LENGTH_TOO_SMALL_FOR_SETS");
      expect(result.error.minimumLength).toBe(4);
    }
  });

  it("accepts exactly the minimum length for the enabled groups", () => {
    const result = generatePassword({ length: 4, sets: ALL_SETS });
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.value).toHaveLength(4);
  });

  it("returns the requested length", () => {
    for (const length of [4, 8, 16, 32, 64, 128]) {
      const result = generatePassword({ length, sets: ALL_SETS });
      expect(result.ok).toBe(true);
      if (result.ok) expect(result.value).toHaveLength(length);
    }
  });

  it("only ever emits characters from the enabled pool", () => {
    const sets = { lowercase: true, uppercase: false, digits: true, symbols: false };
    const pool = buildPool(sets);

    for (let i = 0; i < 200; i += 1) {
      const result = generatePassword({ length: 24, sets });
      expect(result.ok).toBe(true);
      if (!result.ok) continue;
      for (const char of result.value) {
        expect(pool).toContain(char);
      }
    }
  });

  /** The headline guarantee: every selected group is represented. */
  it("always includes at least one character from each enabled group", () => {
    const checks = [
      { sets: { lowercase: true, uppercase: false, digits: false, symbols: false }, test: /[a-z]/ },
      { sets: { lowercase: false, uppercase: true, digits: false, symbols: false }, test: /[A-Z]/ },
      { sets: { lowercase: false, uppercase: false, digits: true, symbols: false }, test: /[0-9]/ },
      { sets: { lowercase: false, uppercase: false, digits: false, symbols: true }, test: /[!@#$%^&*()\-_=+[\]{};:,.?/]/ },
    ];

    for (let i = 0; i < 500; i += 1) {
      for (const { sets, test } of checks) {
        const result = generatePassword({ length: 8, sets });
        expect(result.ok).toBe(true);
        if (result.ok) expect(result.value).toMatch(test);
      }
    }
  });

  it("includes all four groups at once", () => {
    for (let i = 0; i < 500; i += 1) {
      const result = generatePassword({ length: 16, sets: ALL_SETS });
      expect(result.ok).toBe(true);
      if (!result.ok) continue;
      expect(result.value).toMatch(/[a-z]/);
      expect(result.value).toMatch(/[A-Z]/);
      expect(result.value).toMatch(/[0-9]/);
      expect(result.value).toMatch(/[!@#$%^&*()\-_=+[\]{};:,.?/]/);
    }
  });

  it("never emits ambiguous characters when excluded", () => {
    for (let i = 0; i < 300; i += 1) {
      const result = generatePassword({
        length: 32,
        sets: ALL_SETS,
        excludeAmbiguous: true,
      });
      expect(result.ok).toBe(true);
      if (!result.ok) continue;
      for (const char of result.value) {
        expect(ALL_AMBIGUOUS).not.toContain(char);
      }
    }
  });

  it("produces different values across runs", () => {
    const values = new Set<string>();
    for (let i = 0; i < 200; i += 1) {
      const result = generatePassword({ length: 24, sets: ALL_SETS });
      if (result.ok) values.add(result.value);
    }
    // Collisions are astronomically unlikely at 24 characters.
    expect(values.size).toBe(200);
  });

  it("shuffles so mandatory characters are not stuck at the start", () => {
    // With digits-only plus lowercase, the first character is lowercase for
    // most positions. Verify the leading character varies.
    const sets = { lowercase: true, uppercase: false, digits: true, symbols: false };
    const firstChars = new Set<string>();

    for (let i = 0; i < 400; i += 1) {
      const result = generatePassword({ length: 10, sets });
      if (result.ok) firstChars.add(result.value[0]!);
    }

    expect(firstChars.size).toBeGreaterThan(20);
  });

  it("does not always place the seeded characters in order", () => {
    // A weakness of naive implementations is seeding then appending without
    // shuffling. Count how often the value is already sorted ascending.
    let sortedCount = 0;
    const runs = 400;

    for (let i = 0; i < runs; i += 1) {
      const result = generatePassword({ length: 8, sets: ALL_SETS });
      if (!result.ok) continue;
      const sorted = [...result.value].sort().join("");
      if (result.value === sorted) sortedCount += 1;
    }

    // 1/8! chance by chance; a missing shuffle would give ~100%.
    expect(sortedCount).toBeLessThan(runs * 0.05);
  });

  it("handles very long lengths", () => {
    const result = generatePassword({ length: 1024, sets: ALL_SETS });
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.value).toHaveLength(1024);
  });
});

describe("generateRandomString", () => {
  it("rejects an invalid length", () => {
    expect(generateRandomString({ length: 0, charset: "abc" }).ok).toBe(false);
    expect(generateRandomString({ length: -5, charset: "abc" }).ok).toBe(false);
  });

  it("rejects an empty charset", () => {
    const result = generateRandomString({ length: 10, charset: "" });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error.code).toBe("NO_SETS_ENABLED");
  });

  it("returns the requested length using only the given charset", () => {
    for (let i = 0; i < 200; i += 1) {
      const result = generateRandomString({ length: 40, charset: "abc123" });
      expect(result.ok).toBe(true);
      if (!result.ok) continue;
      expect(result.value).toHaveLength(40);
      expect(result.value).toMatch(/^[abc123]+$/);
    }
  });

  it("supports a single-character charset", () => {
    const result = generateRandomString({ length: 12, charset: "x" });
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.value).toBe("xxxxxxxxxxxx");
  });

  it("de-duplicates the charset", () => {
    const result = generateRandomString({ length: 50, charset: "aaaaabbbbb" });
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.value).toMatch(/^[ab]+$/);
  });

  it("eventually uses every character in a small charset", () => {
    const seen = new Set<string>();
    for (let i = 0; i < 500; i += 1) {
      const result = generateRandomString({ length: 20, charset: "abcdef" });
      if (result.ok) for (const char of result.value) seen.add(char);
    }
    expect(seen.size).toBe(6);
  });

  it("does not promise composition", () => {
    // A single-character alphabet can only ever produce that character.
    const result = generateRandomString({ length: 10, charset: "a" });
    if (result.ok) expect(result.value).toBe("aaaaaaaaaa");
  });
});