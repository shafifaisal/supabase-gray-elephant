/**
 * Verifies that the generator pages behave correctly in a real browser and,
 * critically, that generated secrets never leave the device.
 *
 * Requires a running production server and Playwright browsers:
 *   npm run build && npm run start
 *   npx playwright install chromium
 *   node --env-file=.env.local scripts/verify-tools.mjs
 */

import { chromium } from "@playwright/test";

const BASE = process.env.SMOKE_BASE_URL ?? "http://localhost:3000";

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

const browser = await chromium.launch();
const context = await browser.newContext();
const page = await context.newPage();

/** Third-party and app API requests, excluding the initial document load. */
let requests = [];

page.on("request", (request) => {
  const url = request.url();
  if (!url.startsWith(BASE)) return;
  if (request.resourceType() === "document") return;
  requests.push({ url, method: request.method(), body: request.postData() });
});

console.log(`Verifying tools at ${BASE}\n`);

// --- Password generator ---------------------------------------------------
console.log("Password generator:");
await page.goto(`${BASE}/password-generator`, { waitUntil: "networkidle" });

const passwordOutput = page.locator("#generated-secret");
await passwordOutput.waitFor();

// Reveal first, then wait for a real value (the value is produced in a client
// effect, so it is never present in the server HTML).
await page.getByRole("button", { name: "Show password" }).click();
await page.waitForFunction(
  () => {
    const text = document.querySelector("#generated-secret")?.textContent ?? "";
    return text.length > 1 && !text.includes("•");
  },
  { timeout: 10_000 },
);

const initial = await passwordOutput.textContent();
check("renders a password on load", (initial ?? "").length >= 8, `got ${initial?.length}`);
check("is revealed on request", !(initial ?? "").includes("•"));

const lengthLabel = await page.locator("label[for='length']").textContent();
check("shows the length control", /Length:\s*20/.test(lengthLabel ?? ""), lengthLabel ?? "");

// Regenerate must produce a different value.
const before = initial;
await page.getByRole("button", { name: "Generate a new value" }).click();
await page.waitForTimeout(300);
const after = await passwordOutput.textContent();
check("regenerate produces a different password", before !== after);

// Every enabled group must appear.
check("includes lowercase", /[a-z]/.test(after ?? ""));
check("includes uppercase", /[A-Z]/.test(after ?? ""));
check("includes a digit", /[0-9]/.test(after ?? ""));
check("includes a symbol", /[!@#$%^&*()\-_=+[\]{};:,.?/]/.test(after ?? ""));

// Length slider must be respected.
await page.locator("input#length").fill("32");
const at32 = await passwordOutput.textContent();
check("respects the length slider", (at32 ?? "").length === 32, `got ${at32?.length}`);

// Disable all groups -> error, not a broken password.
for (const id of ["opt-lowercase", "opt-uppercase", "opt-digits", "opt-symbols"]) {
  await page.locator(`#${id}`).uncheck();
}
await page.waitForTimeout(200);
const errorShown = await page.getByRole("alert").first().textContent();
check("rejects an empty character selection", /at least one character group/i.test(errorShown ?? ""), errorShown ?? "");

// Restore all groups, then exercise hide/show directly.
await page.locator("#opt-lowercase").check();
await page.locator("#opt-uppercase").check();
await page.waitForTimeout(300);

await page.getByRole("button", { name: "Hide password" }).click();
await page.waitForTimeout(300);
const hidden = await passwordOutput.textContent();
check("masks the password after hiding", (hidden ?? "").startsWith("•"));

await page.getByRole("button", { name: "Show password" }).click();
await page.waitForTimeout(300);
const shown = await passwordOutput.textContent();
check("reveals the password on request", !(shown ?? "").startsWith("•"));

// --- Passphrase -----------------------------------------------------------
console.log("\nPassphrase generator:");
await page.goto(`${BASE}/passphrase-generator`, { waitUntil: "networkidle" });
const phraseOutput = page.locator("#generated-secret");
await phraseOutput.waitFor();

// Reveal before reading: the passphrase is masked by default.
await page.getByRole("button", { name: "Show passphrase" }).click();
await page.waitForTimeout(300);

const phrase = await phraseOutput.textContent();
check("renders a passphrase", (phrase ?? "").includes("-"), phrase ?? "");
const words = (phrase ?? "").split("-");
check("uses the default five words", words.length === 5, `got ${words.length}`);

await page.locator("input#wordCount").fill("8");
await page.waitForTimeout(300);
const longer = await phraseOutput.textContent();
check("respects the word count slider", (longer ?? "").split("-").length === 8);

await page.getByLabel("Capitalise each word").check();
await page.waitForTimeout(300);
const caps = await phraseOutput.textContent();
check("capitalises when asked", /^[A-Z]/.test(caps ?? ""), caps ?? "");

// --- Strength checker -----------------------------------------------------
console.log("\nPassword strength checker:");
await page.goto(`${BASE}/password-strength-checker`, { waitUntil: "networkidle" });
const checker = page.locator("#check-password");

// NOTE: zxcvbn models guessing cost, so it rates "password" as "Reasonable"
// (~27 bits) rather than "Weak". Use a genuinely trivial value here.
await checker.fill("123456");
await page.waitForTimeout(400);
const weak = await page
  .getByRole("meter", { name: "Password strength" })
  .getAttribute("aria-valuetext");
check("rates a trivial password as very weak", /Very weak/.test(weak ?? ""), weak ?? "");

await checker.fill("password");
await page.waitForTimeout(400);
const weakish = await page
  .getByRole("meter", { name: "Password strength" })
  .getAttribute("aria-valuetext");
check(
  "rates a dictionary password well below a random one",
  /Very weak|Weak|Reasonable/.test(weakish ?? ""),
  weakish ?? "",
);

await checker.fill("kR7#mZ2$vQ9!xL4&pW3@nD8^yH5*jB1&");
await page.waitForTimeout(400);
const strong = await page.getByRole("meter", { name: "Password strength" }).getAttribute("aria-valuetext");
check("rates a strong password highly", /Very strong/.test(strong ?? ""), strong ?? "");

// --- Entropy calculator ---------------------------------------------------
console.log("\nEntropy calculator:");
await page.goto(`${BASE}/password-entropy-calculator`, { waitUntil: "networkidle" });
check("renders the character pool tab", await page.getByRole("tab", { name: "Character pool" }).isVisible());

// Pattern detection lives on the character tab.
await page.locator("#entropy-example").fill("Summer2024!");
await page.waitForTimeout(300);
check(
  "detects a pattern in a candidate value",
  await page.getByText("Contains a year").isVisible(),
);

await page.getByRole("tab", { name: "Word list" }).click();
await page.waitForTimeout(200);
check("switches to the word list tab", await page.getByText("Word-based entropy").isVisible());

// --- Random string --------------------------------------------------------
console.log("\nRandom string generator:");
await page.goto(`${BASE}/random-string-generator`, { waitUntil: "networkidle" });
const stringOutput = page.locator("#generated-secret");
await stringOutput.waitFor();

await page.getByRole("button", { name: "Show string" }).click();
await page.waitForTimeout(300);

const token = await stringOutput.textContent();
check("renders a random string", (token ?? "").length === 32, `got ${token?.length}`);

await page.locator("input#string-length").fill("64");
await page.waitForTimeout(300);
const longerToken = await stringOutput.textContent();
check("respects the length slider", (longerToken ?? "").length === 64);

// --- Privacy: nothing may leave the browser --------------------------------
console.log("\nPrivacy (critical):");

// Re-run every generator while recording all same-origin traffic.
// NOTE: uses "load" rather than "networkidle" — the dev/prod servers keep
// connections open, so networkidle is unreliable here.
requests = [];
for (const path of [
  "/password-generator",
  "/passphrase-generator",
  "/random-string-generator",
]) {
  await page.goto(`${BASE}${path}`, { waitUntil: "load" });
  await page.locator("#generated-secret").waitFor();
  await page.getByRole("button", { name: "Generate a new value" }).click();
  await page.waitForTimeout(600);
}

await page.goto(`${BASE}/password-strength-checker`, { waitUntil: "load" });
await page.locator("#check-password").fill("SuperSecretPassword123!");
await page.waitForTimeout(800);

check(
  "no same-origin API requests while generating",
  requests.filter((r) => r.url.includes("/api/")).length === 0,
  requests.map((r) => r.url).join(", "),
);

check(
  "no request bodies contain a secret",
  requests.every((r) => !r.body),
  requests.find((r) => r.body)?.body ?? "",
);

// Storage must remain empty.
const storage = await page.evaluate(() => ({
  local: Object.entries(localStorage).map(([k]) => k),
  session: Object.entries(sessionStorage).map(([k]) => k),
}));

check(
  "nothing written to localStorage",
  storage.local.length === 0,
  storage.local.join(", "),
);
check(
  "nothing written to sessionStorage",
  storage.session.length === 0,
  storage.session.join(", "),
);

const cookies = await context.cookies();
check(
  "no cookie holds a generated secret",
  cookies.every((c) => !c.value.includes("SuperSecretPassword123")),
  cookies.map((c) => c.name).join(", "),
);

// The secret must not appear in the served HTML.
const html = await (await fetch(`${BASE}/password-strength-checker`)).text();
check(
  "server HTML contains no user input",
  !html.includes("SuperSecretPassword123"),
);

await browser.close();

console.log(`\n${passed} passed, ${failed} failed.`);
process.exit(failed > 0 ? 1 : 0);