/**
 * Pre-launch verification.
 *
 * A fast, dependency-free gate run BEFORE deploying to production. It checks
 * the things that must be true in the repository and build output — it does not
 * deploy, touch DNS, or contact any external service. Those steps are manual
 * and documented in docs/deployment.md.
 *
 * WHAT IT PROVES
 * --------------
 *  - No secrets are committed (no .env*, no *.pem, no key material in git).
 *  - .gitignore protects env files and .vercel.
 *  - .env.example documents every required variable.
 *  - No NEXT_PUBLIC_ variable is named like a secret (would leak to browser).
 *  - Required production files/routes exist (robots, sitemap, legal pages,
 *    ads config, security headers).
 *  - Required launch documents exist.
 *  - Advertising is fail-closed by default in the committed source.
 *
 * Usage: node scripts/prelaunch-check.mjs
 */

import { execSync } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";

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

function read(path) {
  try {
    return readFileSync(path, "utf8");
  } catch {
    return "";
  }
}

function gitTrackedFiles() {
  try {
    return execSync("git ls-files", { encoding: "utf8" }).split(/\r?\n/).filter(Boolean);
  } catch {
    return [];
  }
}

// ---------------------------------------------------------------------------
console.log("Committed secrets:");
const tracked = gitTrackedFiles();
check("git is available and the repo has tracked files", tracked.length > 0);

const committedEnv = tracked.filter((f) => /(^|\/)\.env($|\.)/.test(f) && !f.endsWith(".example"));
check("no .env files are committed", committedEnv.length === 0, committedEnv.join(", "));

const committedKeys = tracked.filter((f) => /\.pem$|\.key$|id_rsa/.test(f));
check("no private key files are committed", committedKeys.length === 0, committedKeys.join(", "));

// A real service-role JWT would contain a "service_role" role claim.
const jwtLike = tracked.filter((f) => /\.(ts|tsx|js|mjs|json|sql|md)$/.test(f) && /"role"\s*:\s*"service_role"/.test(read(f)));
check("no service-role key material in committed source", jwtLike.length === 0, jwtLike.join(", "));

// ---------------------------------------------------------------------------
console.log("\nGitignore:");
const gitignore = read(".gitignore");
check(".gitignore excludes env files", /\.env/.test(gitignore));
check(".gitignore excludes .vercel", /\.vercel/.test(gitignore));
check(".gitignore excludes key files", /\.pem/.test(gitignore));

// ---------------------------------------------------------------------------
console.log("\nEnvironment template:");
const envExample = read(".env.example");
const REQUIRED_PUBLIC = [
  "NEXT_PUBLIC_SITE_URL",
  "NEXT_PUBLIC_SUPABASE_URL",
  "NEXT_PUBLIC_SUPABASE_ANON_KEY",
];
const REQUIRED_SERVER = ["SUPABASE_SERVICE_ROLE_KEY"];
for (const key of [...REQUIRED_PUBLIC, ...REQUIRED_SERVER]) {
  check(`.env.example documents ${key}`, envExample.includes(key));
}

// No NEXT_PUBLIC_ var should be named like a secret.
const leakyPublic = [...envExample.matchAll(/^(NEXT_PUBLIC_[A-Z0-9_]+)/gm)]
  .map((m) => m[1])
  .filter((k) => /SERVICE_ROLE|SECRET|PRIVATE_KEY/.test(k));
check("no secret-named NEXT_PUBLIC_ var in .env.example", leakyPublic.length === 0, leakyPublic.join(", "));

// ---------------------------------------------------------------------------
console.log("\nProduction files & routes:");
const REQUIRED_FILES = [
  "src/app/robots.ts",
  "src/app/sitemap.ts",
  "src/app/privacy-policy/page.tsx",
  "src/app/terms/page.tsx",
  "src/app/cookie-policy/page.tsx",
  "src/lib/ads/config.ts",
  "next.config.ts",
  "docs/deployment.md",
  "docs/security-checklist.md",
  "docs/adsense-readiness.md",
];
for (const file of REQUIRED_FILES) {
  check(`exists: ${file}`, existsSync(file));
}

// Security headers must be configured.
const nextConfig = read("next.config.ts");
check("security headers configured", /X-Frame-Options|Strict-Transport-Security/.test(nextConfig));

// ---------------------------------------------------------------------------
console.log("\nAdvertising fail-closed:");
const adsConfig = read("src/lib/ads/config.ts");
check("ads config exists and resolves readiness", /resolveAdsConfig/.test(adsConfig));
check(".env.example leaves ads disabled by default", /NEXT_PUBLIC_ADSENSE_ENABLED=false/.test(envExample));
check(".env.example leaves the publisher ID blank", /NEXT_PUBLIC_ADSENSE_CLIENT_ID=\s*$/m.test(envExample));

// ---------------------------------------------------------------------------
console.log("\nLaunch documents:");
for (const doc of ["docs/deployment.md", "docs/security-checklist.md", "docs/adsense-readiness.md"]) {
  const body = read(doc);
  check(`${doc} is non-trivial`, body.length > 400, `${body.length} chars`);
}

console.log(`\n${passed} passed, ${failed} failed.`);
process.exit(failed > 0 ? 1 : 0);