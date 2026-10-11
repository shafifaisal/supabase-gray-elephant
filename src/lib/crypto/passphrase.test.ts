import { describe, expect, it } from "vitest";

import { generatePassphrase, describeOfflineGuessing } from "@/lib/crypto/passphrase";
import { BITS_PER_WORD, WORDS, WORDLIST_SIZE } from "@/lib/crypto/wordlist";

const BASE = {
  wordCount: 6,
  separator: "-",
  capitalize: false,
  includeNumber: false,
  includeSymbol: false,
};

describe("wordlist", () => {
  it("contains exactly 7776 words", () => {
    expect(WORDLIST_SIZE).toBe(7776);
    expect(WORDS).toHaveLength(7776);
  });

  it("has no duplicate entries", () => {
    expect(new Set(WORDS).size).toBe(WORDS.length);
  });

  it("contains only lowercase letters and hyphens", () => {
    for (const word of WORDS) {
      expect(word).toMatch(/^[a-z-]+$/);
    }
  });

  it("reports 12.9248 bits per word", () => {
    // log2(7776) = log2(6^5) = 5 * log2(6) = 12.92481250360578
    expect(BITS_PER_WORD).toBeCloseTo(12.92481250, 6);
  });

  it("does not begin or end with a hyphen", () => {
    for (const word of WORDS) {
      expect(word.startsWith("-")).toBe(false);
      expect(word.endsWith("-")).toBe(false);
    }
  });
});

describe("generatePassphrase", () => {
  it("rejects word counts below the minimum", () => {
    const result = generatePassphrase({ ...BASE, wordCount: 2 });
    expect(result.ok).toBe(false);
    expect(result.error?.code).toBe("INVALID_WORD_COUNT");
  });

  it("rejects word counts above the maximum", () => {
    const result = generatePassphrase({ ...BASE, wordCount: 100 });
    expect(result.ok).toBe(false);
    expect(result.error?.code).toBe("INVALID_WORD_COUNT");
  });

  it("rejects a fractional word count", () => {
    expect(generatePassphrase({ ...BASE, wordCount: 4.5 }).ok).toBe(false);
  });

  it("produces the requested number of words", () => {
    for (const wordCount of [3, 4, 6, 8, 12]) {
      const result = generatePassphrase({ ...BASE, wordCount });
      expect(result.ok).toBe(true);
      expect(result.words).toHaveLength(wordCount);
    }
  });

  it("joins words with the chosen separator", () => {
    for (const separator of ["-", ".", "_", " ", ""]) {
      const result = generatePassphrase({ ...BASE, wordCount: 4, separator });
      expect(result.ok).toBe(true);
      if (separator) {
        expect(result.value.split(separator)).toHaveLength(4);
      }
    }
  });

  it("capitalises when requested", () => {
    const result = generatePassphrase({ ...BASE, wordCount: 5, capitalize: true });
    expect(result.ok).toBe(true);
    for (const word of result.words) {
      expect(word[0]).toBe(word[0]?.toUpperCase());
    }
  });

  it("appends a digit when requested", () => {
    for (let i = 0; i < 50; i += 1) {
      const result = generatePassphrase({ ...BASE, wordCount: 4, includeNumber: true });
      expect(result.value.at(-1)).toMatch(/[0-9]/);
    }
  });

  it("appends a symbol when requested", () => {
    for (let i = 0; i < 50; i += 1) {
      const result = generatePassphrase({ ...BASE, wordCount: 4, includeSymbol: true });
      expect(result.value.at(-1)).toMatch(/[!@#$%^&*\-_=+?]/);
    }
  });

  it("reports entropy that scales with word count", () => {
    const four = generatePassphrase({ ...BASE, wordCount: 4 });
    const eight = generatePassphrase({ ...BASE, wordCount: 8 });
    expect(four.bits).toBeCloseTo(4 * BITS_PER_WORD, 6);
    expect(eight.bits).toBeCloseTo(8 * BITS_PER_WORD, 6);
    expect(eight.bits).toBeGreaterThan(four.bits);
  });

  it("adds the documented bonus for a number", () => {
    const plain = generatePassphrase({ ...BASE, wordCount: 4 });
    const withNumber = generatePassphrase({ ...BASE, wordCount: 4, includeNumber: true });
    expect(withNumber.bits - plain.bits).toBeCloseTo(Math.log2(10), 6);
  });

  it("only ever uses words from the bundled list", () => {
    const allowed = new Set(WORDS);
    for (let i = 0; i < 100; i += 1) {
      const result = generatePassphrase({ ...BASE, wordCount: 7 });
      for (const word of result.words) {
        expect(allowed.has(word.toLowerCase())).toBe(true);
      }
    }
  });

  it("uses a broad selection of words rather than a narrow favourite", () => {
    const seen = new Set<string>();
    for (let i = 0; i < 200; i += 1) {
      const result = generatePassphrase({ ...BASE, wordCount: 6 });
      for (const word of result.words) seen.add(word);
    }
    // 1200 draws should touch a large slice of the list.
    expect(seen.size).toBeGreaterThan(700);
  });

  it("distributes words roughly uniformly across the list", () => {
    // Split the list into 8 buckets and confirm each is used comparably.
    const bucketSize = WORDLIST_SIZE / 8;
    const buckets = new Array(8).fill(0);

    for (let i = 0; i < 4000; i += 1) {
      const result = generatePassphrase({ ...BASE, wordCount: 6 });
      for (const word of result.words) {
        const index = WORDS.indexOf(word.toLowerCase() as (typeof WORDS)[number]);
        if (index >= 0) buckets[Math.floor(index / bucketSize)]! += 1;
      }
    }

    const total = buckets.reduce((a, b) => a + b, 0);
    const expected = total / 8;

    // ~24,000 draws over 8 buckets => ~3,000 each, sd ~= 51. A ±8% band is
    // roughly a 4-sigma window: loose enough not to flake, tight enough that a
    // genuinely skewed selection (which would be tens of percent off) fails.
    for (const count of buckets) {
      expect(count).toBeGreaterThan(expected * 0.92);
      expect(count).toBeLessThan(expected * 1.08);
    }
  });

  it("supports duplicate-free selection", () => {
    for (let i = 0; i < 50; i += 1) {
      const result = generatePassphrase({ ...BASE, wordCount: 8 }, true);
      expect(result.ok).toBe(true);
      expect(new Set(result.words).size).toBe(8);
    }
  });

  it("rejects requesting more unique words than the list holds", () => {
    const result = generatePassphrase({ ...BASE, wordCount: 10 }, true);
    expect(result.ok).toBe(true);
    expect(result.words).toHaveLength(10);
  });

  it("produces different passphrases across runs", () => {
    const values = new Set<string>();
    for (let i = 0; i < 100; i += 1) {
      values.add(generatePassphrase({ ...BASE, wordCount: 6 }).value);
    }
    expect(values.size).toBe(100);
  });
});

describe("describeOfflineGuessing", () => {
  it("describes very low entropy as instant", () => {
    expect(describeOfflineGuessing(1)).toBe("instantly");
  });

  it("describes increasing entropy in larger units", () => {
    // Below ~1 second the honest answer is "instantly": 2^30/2e10 ~= 0.05s.
    expect(describeOfflineGuessing(20)).toBe("instantly");
    expect(describeOfflineGuessing(30)).toBe("instantly");

    expect(describeOfflineGuessing(35)).toMatch(/second/); // ~1.7s
    expect(describeOfflineGuessing(45)).toMatch(/minute|hour/); // ~29m
    expect(describeOfflineGuessing(65)).toMatch(/year|decade|century/); // ~58y
    expect(describeOfflineGuessing(200)).toMatch(/century|millennium/);
  });

  it("grows monotonically with entropy", () => {
    const toSeconds = (bits: number) =>
      Math.pow(2, bits);
    expect(toSeconds(60)).toBeGreaterThan(toSeconds(40));
    expect(toSeconds(80)).toBeGreaterThan(toSeconds(60));
  });
});