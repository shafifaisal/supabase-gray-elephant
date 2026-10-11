/**
 * Accessibility + responsive verification against the running server.
 *
 * Uses Playwright (already a dev dependency, chromium already installed) and
 * injects axe-core (already installed) into each page — no new dependencies.
 *
 * WHAT THIS PROVES (per page)
 * ---------------------------
 *  - No WCAG 2.1 A/AA violations reported by axe-core.
 *  - Exactly one <h1>.
 *  - A <main> landmark exists.
 *  - No horizontal scroll at 360 / 768 / 1280 px widths (responsive).
 *
 * Usage:
 *   npm start
 *   node scripts/verify-a11y.mjs
 *   A11Y_BASE_URL=http://localhost:3000 node scripts/verify-a11y.mjs
 */

import { createRequire } from "node:module";
import { chromium } from "@playwright/test";

const require = createRequire(import.meta.url);
const AXE_PATH = require.resolve("axe-core");

const BASE = (process.env.A11Y_BASE_URL ?? "http://localhost:3000").replace(/\/$/, "");

const ROUTES = [
  "/",
  "/tools",
  "/password-generator",
  "/passphrase-generator",
  "/password-strength-checker",
  "/password-entropy-calculator",
  "/random-string-generator",
  "/guides",
  "/about",
  "/contact",
  "/privacy-policy",
  "/terms",
  "/cookie-policy",
];

const VIEWPORTS = [
  { width: 360, height: 800, name: "mobile" },
  { width: 768, height: 1024, name: "tablet" },
  { width: 1280, height: 800, name: "desktop" },
];

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
  for (const route of ROUTES) {
    console.log(`\n${route}`);
    const context = await browser.newContext({ viewport: { width: 1280, height: 800 } });
    const page = await context.newPage();

    const response = await page.goto(`${BASE}${route}`, { waitUntil: "networkidle" });
    check(`${route} loads (200)`, response?.status() === 200, `got ${response?.status()}`);

    // --- axe-core WCAG scan ---------------------------------------------
    await page.addScriptTag({ path: AXE_PATH });
    const axeResults = await page.evaluate(async () => {
      // `axe` is injected onto window by addScriptTag above.
      return await window.axe.run(document, {
        runOnly: {
          type: "tag",
          values: ["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"],
        },
      });
    });

    const violations = axeResults.violations ?? [];
    if (violations.length === 0) {
      check(`${route} has no axe WCAG A/AA violations`, true);
    } else {
      const summary = violations
        .map(
          (v) =>
            `${v.id} (${v.impact}) x${v.nodes.length}: ${v.nodes[0]?.target?.join(" ") ?? ""}`,
        )
        .join(" | ");
      check(`${route} has no axe WCAG A/AA violations`, false, summary);
    }

    // --- Semantic structure ---------------------------------------------
    const h1Count = await page.locator("h1").count();
    check(`${route} has exactly one <h1>`, h1Count === 1, `found ${h1Count}`);

    const mainCount = await page.locator("main").count();
    check(`${route} has a <main> landmark`, mainCount >= 1, `found ${mainCount}`);

    // --- Responsive: no horizontal scroll -------------------------------
    for (const vp of VIEWPORTS) {
      await page.setViewportSize({ width: vp.width, height: vp.height });
      // Allow layout to settle after the resize.
      await page.waitForTimeout(120);
      const overflow = await page.evaluate(
        () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
      );
      check(
        `${route} has no horizontal scroll at ${vp.width}px (${vp.name})`,
        overflow <= 1,
        `overflows by ${overflow}px`,
      );
    }

    await context.close();
  }
} finally {
  await browser.close();
}

console.log(`\n${passed} passed, ${failed} failed.`);
process.exit(failed > 0 ? 1 : 0);
