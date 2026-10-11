/**
 * Downloads the EFF large wordlist and writes it into the repository as a
 * TypeScript module.
 *
 * Source: https://www.eff.org/files/2016/07/18/eff_large_wordlist.txt
 * License: Creative Commons Attribution 3.0 (CC BY 3.0)
 *
 * The list is reviewed by EFF and sized to 7776 words, so each word carries
 * exactly log2(7776) = 12.9257 bits of entropy. This attribution is preserved in
 * the generated file and in the passphrase tool's UI.
 *
 * Run once. The generated file is committed, so the build never depends on
 * network access.
 *
 * Usage: node scripts/build-wordlist.mjs
 */

import { writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const SOURCE_URL =
  "https://www.eff.org/files/2016/07/18/eff_large_wordlist.txt";

const here = dirname(fileURLToPath(import.meta.url));
const outputPath = join(here, "..", "src", "lib", "crypto", "wordlist.ts");

const response = await fetch(SOURCE_URL);

if (!response.ok) {
  console.error(`Download failed: ${response.status} ${response.statusText}`);
  process.exit(1);
}

const text = await response.text();

const words = text
  .split("\n")
  .map((line) => line.trim())
  .filter(Boolean)
  .map((line) => line.split(/\s+/).pop())
  // The official list contains four hyphenated entries
  // (drop-down, felt-tip, t-shirt, yo-yo), so hyphens are permitted.
  .filter((word) => /^[a-z-]+$/.test(word));

const unique = [...new Set(words)].sort();

if (unique.length !== 7776) {
  console.error(
    `Expected 7776 unique words, parsed ${unique.length}. Refusing to write a list of unexpected size.`,
  );
  process.exit(1);
}

const perWordBits = Math.log2(unique.length);

const body = unique
  .map((word) => `  "${word}",`)
  .join("\n");

const file = `/**
 * EFF Large Wordlist — 7,776 words.
 *
 * Copyright (c) 2016 Electronic Frontier Foundation.
 * Licensed under CC BY 3.0: https://creativecommons.org/licenses/by/3.0/
 *
 * The list is deliberately reviewed so that every word is common, unambiguous
 * when spoken aloud, and easy to type. 7,776 = 6^5, so a uniformly random word
 * carries exactly log2(7776) = ${perWordBits.toFixed(4)} bits of entropy.
 *
 * DO NOT EDIT BY HAND — regenerate with \`node scripts/build-wordlist.mjs\`.
 */

export const WORDLIST_ATTRIBUTION =
  "EFF Large Wordlist (c) 2016 Electronic Frontier Foundation, CC BY 3.0";

export const WORDLIST_LICENSE_URL =
  "https://creativecommons.org/licenses/by/3.0/";

/** Number of words in the list. */
export const WORDLIST_SIZE = ${unique.length};

/** Entropy contributed by a single uniformly chosen word, in bits. */
export const BITS_PER_WORD = ${perWordBits.toFixed(10)};

export const WORDS: readonly string[] = [
${body}
] as const;
`;

await writeFile(outputPath, file, "utf8");

console.log(`Wrote ${unique.length} words to ${outputPath}`);
console.log(`Entropy per word: ${perWordBits.toFixed(4)} bits`);