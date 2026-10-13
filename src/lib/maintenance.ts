import { asBoolean } from "@/lib/settings/parse";

/**
 * Maintenance-mode helpers.
 *
 * Pure functions only — no database, no React, no Node APIs — so they can run
 * in the Edge proxy and be unit tested directly. The proxy owns the network
 * read and the short-lived cache; this module owns the decisions.
 */

/** Paths that must keep working while maintenance mode is on. */
const BYPASS_PREFIXES = [
  // The owner needs a way back in to switch maintenance off again.
  "/admin",
  "/login",
  // The config endpoints power client-side consent/ads/analytics checks.
  "/api",
  // Framework asset requests.
  "/_next",
  // The holding page itself.
  "/maintenance",
];

/**
 * True when a path must NOT be gated by maintenance mode.
 *
 * Also bypasses anything that looks like a static file (a dot in the last
 * segment: robots.txt, sitemap.xml, favicon.ico, …), because those are not
 * application navigations and gating them would break crawling.
 */
export function isMaintenanceBypassed(pathname: string): boolean {
  if (BYPASS_PREFIXES.some((prefix) => pathname.startsWith(prefix))) {
    return true;
  }

  const lastSegment = pathname.split("/").pop() ?? "";
  return lastSegment.includes(".");
}

/**
 * True when the request looks like a browser navigation that expects an HTML
 * page. Asset and API fetches must not be gated or they'd break in subtle ways.
 */
export function wantsHtml(
  secFetchDest: string | null,
  accept: string | null,
): boolean {
  if (secFetchDest) return secFetchDest === "document";
  return (accept ?? "").includes("text/html");
}

export interface MaintenanceState {
  /** Whether maintenance mode is switched on. Fails closed. */
  enabled: boolean;
  /** Brand name to show on the holding page. */
  brandName: string;
}

/**
 * Turns the `site_settings` rows into a maintenance decision.
 *
 * Fails closed: an absent, malformed or secret-filtered `maintenance_mode`
 * value leaves the site up.
 */
export function parseMaintenanceRows(
  rows: { key: string; value: unknown }[],
  fallbackBrandName: string,
): MaintenanceState {
  let enabled = false;
  let brandName = fallbackBrandName;

  for (const row of rows) {
    if (row.key === "maintenance_mode") {
      enabled = asBoolean(row.value);
    } else if (row.key === "brand_name") {
      if (typeof row.value === "string" && row.value.trim().length > 0) {
        brandName = row.value.trim();
      }
    }
  }

  return { enabled, brandName };
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

/**
 * The 503 holding page. A 503 plus `Retry-After` tells search engines the
 * outage is temporary, so they keep the site indexed rather than dropping it.
 */
export function maintenanceHtml(brandName: string): string {
  const safeName = escapeHtml(brandName);

  return `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <meta name="robots" content="noindex" />
    <title>${safeName} — temporarily unavailable</title>
    <style>
      :root { color-scheme: light; }
      body {
        margin: 0;
        min-height: 100vh;
        display: grid;
        place-items: center;
        padding: 2rem;
        font-family: ui-sans-serif, system-ui, -apple-system, "Segoe UI", sans-serif;
        background: #f8fafc;
        color: #0f172a;
      }
      main { max-width: 34rem; text-align: center; }
      h1 { font-size: 1.5rem; margin: 0 0 0.75rem; }
      p { margin: 0 0 0.5rem; line-height: 1.6; color: #475569; }
    </style>
  </head>
  <body>
    <main>
      <h1>${safeName} is temporarily unavailable</h1>
      <p>We are carrying out planned maintenance and will be back shortly.</p>
      <p>Please try again in a few minutes.</p>
    </main>
  </body>
</html>`;
}
