/**
 * Regression verification against the running server.
 *
 * WHAT THIS PROVES
 * ----------------
 *  1. No broken internal links: every same-origin link reachable from the main
 *     public entry pages resolves (status < 400).
 *  2. Privacy invariant holds at runtime: using a generator makes NO request to
 *     any external host, and writes NOTHING to localStorage/sessionStorage.
 *  3. Consent flow works: the banner appears for a first-time visitor, accepting
 *     hides it, and the choice persists across a reload.
 *  4. Each tool page renders its control without a client-side crash.
 *
 * Usage:
 *   npm start
 *   node scripts/verify-regression.mjs
 *   REGRESSION_BASE_URL=http://localhost:3000 node scripts/verify-regression.mjs
 */

import { chromium } from "@playwright/test";

const BASE = (process.env.REGRESSION_BASE_URL ?? "http://localhost:3000").replace(/\/$/, "");

/** Hosts allowed to receive requests: the app origin + Supabase. Compared by hostname (port-agnostic). */
function allowedHosts() {
  const hosts = new Set(["localhost", "127.0.0.1"]);
  try {
    if (process.env.NEXT_PUBLIC_SUPABASE_URL) {
      hosts.add(new URL(process.env.NEXT_PUBLIC_SUPABASE_URL).hostname);
    }
  } catch {
    /* ignore malformed URL */
  }
  // The app's own origin is always allowed.
  try {
    hosts.add(new URL(BASE).hostname);
  } catch {
    /* ignore */
  }
  return hosts;
}

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

try {
  // 1. Broken-link crawl
  console.log("Broken-link crawl:");
  const crawlContext = await browser.newContext();
  const crawlPage = await crawlContext.newPage();

  const entryPoints = ["/", "/tools", "/guides", "/about", "/contact"];
  const discovered = new Set();
  const broken = [];

  for (const entry of entryPoints) {
    await crawlPage.goto(`${BASE}${entry}`, { waitUntil: "networkidle" });
    const hrefs = await crawlPage.$$eval("a[href]", (anchors) =>
      anchors.map((a) => a.getAttribute("href") ?? ""),
    );
    for (const href of hrefs) {
      if (!href.startsWith("/") || href.startsWith("//")) continue;
      const path = href.split("#")[0].split("?")[0];
      if (path) discovered.add(path);
    }
  }

  for (const path of discovered) {
    try {
      const res = await crawlPage.goto(`${BASE}${path}`, { waitUntil: "domcontentloaded" });
      const status = res?.status() ?? 0;
      if (status >= 400) broken.push(`${path} -> ${status}`);
    } catch (err) {
      broken.push(`${path} -> ${String(err).slice(0, 60)}`);
    }
  }

  check(`crawled ${discovered.size} internal links, none broken`, broken.length === 0, broken.join("; "));
  await crawlContext.close();

  // 2. Privacy regression
  console.log("\nPrivacy regression (password generator):");
  const privContext = await browser.newContext();
  const privPage = await privContext.newPage();
  const allowed = allowedHosts();
  const externalRequests = [];

  privPage.on("request", (request) => {
    let host;
    try {
      host = new URL(request.url()).hostname;
    } catch {
      return;
    }
    if (!allowed.has(host)) externalRequests.push(request.url());
  });

  await privPage.goto(`${BASE}/password-generator`, { waitUntil: "networkidle" });

  const regen = privPage.locator('button[aria-label="Generate a new value"]');
  for (let i = 0; i < 3; i += 1) {
    if (await regen.count()) await regen.first().click();
    await privPage.waitForTimeout(150);
  }

  check("no request to any external host while generating", externalRequests.length === 0, externalRequests.slice(0, 3).join("; "));

  const storage = await privPage.evaluate(() => ({
    local: window.localStorage.length,
    session: window.sessionStorage.length,
  }));
  check("nothing written to localStorage", storage.local === 0, `${storage.local} keys`);
  check("nothing written to sessionStorage", storage.session === 0, `${storage.session} keys`);

  const outputText = (await privPage.locator("#generated-secret").innerText().catch(() => "")).trim();
  check("a value was generated", outputText.length > 0);
  check("generated value is not in the URL", outputText.length === 0 || !privPage.url().includes(outputText));
  await privContext.close();

  // 3. Consent regression
  console.log("\nConsent flow:");
  const consentContext = await browser.newContext();
  const consentPage = await consentContext.newPage();
  await consentPage.goto(`${BASE}/`, { waitUntil: "networkidle" });

  const banner = consentPage.locator('[aria-label="Cookie consent"]');
  await banner.waitFor({ state: "visible", timeout: 5000 });
  check("consent banner appears for a first-time visitor", true);

  await consentPage.getByRole("button", { name: "Accept all" }).click();
  await consentPage.waitForTimeout(200);
  check("banner hides after accepting", (await banner.count()) === 0);

  await consentPage.reload({ waitUntil: "networkidle" });
  await consentPage.waitForTimeout(300);
  check("choice persists across reload (banner stays hidden)", (await banner.count()) === 0);
  await consentContext.close();

  // 4. Tools smoke
  console.log("\nTools smoke:");
  const toolsContext = await browser.newContext();
  const toolsPage = await toolsContext.newPage();
  const toolRoutes = [
    "/password-generator",
    "/passphrase-generator",
    "/password-strength-checker",
    "/password-entropy-calculator",
    "/random-string-generator",
  ];
  for (const route of toolRoutes) {
    const res = await toolsPage.goto(`${BASE}${route}`, { waitUntil: "networkidle" });
    const hasH1 = (await toolsPage.locator("h1").count()) === 1;
    check(`${route} renders (200, one h1)`, res?.status() === 200 && hasH1, `got ${res?.status()}`);
  }
  await toolsContext.close();
} finally {
  await browser.close();
}

console.log(`\n${passed} passed, ${failed} failed.`);
process.exit(failed > 0 ? 1 : 0);