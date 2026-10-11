/**
 * Security verification for the running production build.
 *
 * WHAT THIS PROVES
 * ----------------
 *  1. Security headers are present on responses (defence-in-depth defaults).
 *  2. Admin routes are never cached publicly (Cache-Control: no-store).
 *  3. No secret reaches the CLIENT bundle. The service-role/secret key must
 *     never appear in .next/static (the only code shipped to browsers), and a
 *     set of high-confidence secret patterns must be absent.
 *  4. No environment variable whose name implies a secret is exposed to the
 *     browser via the NEXT_PUBLIC_ prefix.
 *
 * This is a release gate, not app code. It is intentionally standalone so it
 * can run in CI against a built + started server, independent of the test DB.
 *
 * Usage:
 *   npm run build && npm start
 *   node --env-file=.env.local scripts/verify-security.mjs
 */

import { readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";

const BASE = (process.env.SECURITY_BASE_URL ?? "http://localhost:3000").replace(/\/$/, "");
const STATIC_DIR = ".next/static";

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

/** Recursively list files under `dir` matching `ext`. */
function walk(dir, ext, acc = []) {
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
    if (info.isDirectory()) walk(full, ext, acc);
    else if (full.endsWith(ext)) acc.push(full);
  }
  return acc;
}

// ---------------------------------------------------------------------------
console.log("Security headers:\n");

const home = await fetch(`${BASE}/`, { redirect: "manual" });
const h = home.headers;

check("X-Content-Type-Options is nosniff", h.get("x-content-type-options") === "nosniff");
check("X-Frame-Options is DENY", h.get("x-frame-options") === "DENY");
check(
  "Referrer-Policy is set",
  (h.get("referrer-policy") ?? "").length > 0,
  h.get("referrer-policy") ?? "missing",
);
check(
  "Permissions-Policy restricts sensitive features",
  /camera=\(\)/.test(h.get("permissions-policy") ?? ""),
  h.get("permissions-policy") ?? "missing",
);
check(
  "Strict-Transport-Security is set",
  /max-age=\d+/.test(h.get("strict-transport-security") ?? ""),
  h.get("strict-transport-security") ?? "missing",
);

// ---------------------------------------------------------------------------
console.log("\nAdmin caching:\n");

// An unauthenticated request to /admin is redirected to /login, and the
// redirect (and every admin response) must carry no-store.
const admin = await fetch(`${BASE}/admin`, { redirect: "manual" });
check(
  "/admin response is not publicly cacheable",
  /no-store/.test(admin.headers.get("cache-control") ?? ""),
  admin.headers.get("cache-control") ?? "missing",
);
check("/admin redirects an anonymous visitor", admin.status === 307 || admin.status === 302, `got ${admin.status}`);

// ---------------------------------------------------------------------------
console.log("\nClient bundle secret scan:\n");

const clientFiles = walk(STATIC_DIR, ".js");
check("found client JS bundles to scan", clientFiles.length > 0, `scanned ${STATIC_DIR}`);

// The single most important assertion: the real service-role/secret key value
// must never appear in any client-shipped file.
const serviceKey =
  process.env.SUPABASE_SERVICE_ROLE_KEY ?? process.env.SUPABASE_SECRET_KEY ?? "";

const SECRET_PATTERNS = [
  { name: "service_role claim", re: /"role"\s*:\s*"service_role"/ },
  { name: "service role env name", re: /SUPABASE_SERVICE_ROLE/i },
  { name: "private key block", re: /-----BEGIN [A-Z ]*PRIVATE KEY-----/ },
  { name: "stripe-style secret", re: /sk_live_[0-9a-zA-Z]{16,}/ },
  { name: "aws access key id", re: /AKIA[0-9A-Z]{16}/ },
];

let secretLeaks = [];
for (const file of clientFiles) {
  const content = readFileSync(file, "utf8");

  if (serviceKey && serviceKey.length >= 20 && content.includes(serviceKey)) {
    secretLeaks.push(`${file}: contains the service-role key value`);
  }
  for (const { name, re } of SECRET_PATTERNS) {
    if (re.test(content)) {
      secretLeaks.push(`${file}: matched ${name}`);
    }
  }
}

check(
  "no secret found in client bundles",
  secretLeaks.length === 0,
  secretLeaks.slice(0, 5).join("; "),
);

// ---------------------------------------------------------------------------
console.log("\nEnvironment exposure audit:\n");

// Any env var whose name implies a secret must NOT be prefixed NEXT_PUBLIC_,
// because that prefix inlines the value into the client bundle.
const leakyPublicSecrets = Object.keys(process.env).filter(
  (key) =>
    key.startsWith("NEXT_PUBLIC_") &&
    /(SECRET|SERVICE_ROLE|PRIVATE_KEY|_KEY$|TOKEN|PASSWORD)/i.test(key) &&
    // The publishable anon key is intentionally public and safe under RLS.
    !/NEXT_PUBLIC_SUPABASE_(ANON_KEY|PUBLISHABLE_KEY)/.test(key),
);

check(
  "no secret-named variable is exposed via NEXT_PUBLIC_",
  leakyPublicSecrets.length === 0,
  leakyPublicSecrets.join(", "),
);

// ---------------------------------------------------------------------------
console.log(`\n${passed} passed, ${failed} failed.`);
process.exit(failed > 0 ? 1 : 0);
