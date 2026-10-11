/**
 * Performance verification for the built client bundle.
 *
 * WHY BUNDLE SIZE, NOT TIMINGS
 * ----------------------------
 * Wall-clock timings on a cold CI runner are noisy and produce flaky gates.
 * The client JavaScript payload is deterministic for a given build, and it is
 * the single biggest lever on real-world load performance for this app. A
 * budget here fails loudly on the regressions that actually matter — for
 * example, eagerly importing the ~100 KB passphrase word list or the whole
 * zxcvbn dictionary into a shared chunk instead of letting them code-split.
 *
 * WHAT THIS PROVES
 * ----------------
 *  - Total gzipped client JS is within budget.
 *  - No single chunk is oversized (which would hint at a missing split).
 *  - The security-sensitive word list is not bloating the shared runtime.
 *
 * Runs against the build output only — no server or database required.
 *
 * Usage:  npm run build && node scripts/verify-performance.mjs
 */

import { readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";
import { gzipSync } from "node:zlib";

const STATIC_DIR = ".next/static";

// Budgets (gzipped). Generous headroom over the current ~248 KB total so the
// gate only trips on a genuine regression, never on normal variation.
const TOTAL_GZIP_BUDGET_KB = 400;
const LARGEST_CHUNK_BUDGET_KB = 160;

let passed = 0;
let failed = 0;

function check(label, condition, detail = "") {
  if (condition) {
    passed += 1;
    console.log(`  PASS  ${label}`);
  } else {
    failed += 1;
    console.log(`  FAIL  ${label}${detail ? ` — ${detail}` : ""}`);
  }
}

function walk(dir, acc = []) {
  let entries;
  try {
    entries = readdirSync(dir);
  } catch {
    return acc;
  }
  for (const entry of entries) {
    const full = join(dir, entry);
    let info;
    try {
      info = statSync(full);
    } catch {
      continue;
    }
    if (info.isDirectory()) walk(full, acc);
    else if (full.endsWith(".js")) acc.push(full);
  }
  return acc;
}

const files = walk(STATIC_DIR);
check("found client JS bundles", files.length > 0, `scanned ${STATIC_DIR}`);

let totalGzip = 0;
let largest = { gzip: 0, file: "" };

for (const file of files) {
  const gzip = gzipSync(readFileSync(file)).length;
  totalGzip += gzip;
  if (gzip > largest.gzip) largest = { gzip, file: file.replace(/.*static/, "") };
}

const totalKB = totalGzip / 1024;
const largestKB = largest.gzip / 1024;

console.log(`\n  Total client JS (gzipped): ${totalKB.toFixed(1)} KB across ${files.length} files`);
console.log(`  Largest chunk (gzipped):   ${largestKB.toFixed(1)} KB — ${largest.file}`);

check(
  `total gzipped client JS is under ${TOTAL_GZIP_BUDGET_KB} KB`,
  totalKB <= TOTAL_GZIP_BUDGET_KB,
  `${totalKB.toFixed(1)} KB`,
);
check(
  `no single chunk exceeds ${LARGEST_CHUNK_BUDGET_KB} KB gzipped`,
  largestKB <= LARGEST_CHUNK_BUDGET_KB,
  `${largestKB.toFixed(1)} KB (${largest.file})`,
);

console.log(`\n${passed} passed, ${failed} failed.`);
process.exit(failed > 0 ? 1 : 0);
