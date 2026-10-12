/**
 * Static site configuration.
 *
 * Brand name, URL and contact details are intentionally read from environment
 * variables so a rebrand is a configuration change, not a code change.
 * Admin-editable overrides (site_settings table) are layered on top in a later
 * phase; this file remains the fallback when the database is unavailable.
 */

function trimTrailingSlash(value: string): string {
  return value.replace(/\/+$/, "");
}

const rawSiteUrl = process.env.NEXT_PUBLIC_SITE_URL;

/**
 * Vercel sets these on the build and on the running deployment. They are NOT
 * exposed to the client bundle (only `NEXT_PUBLIC_*` is), so this evaluates to
 * false in the browser and the guard can never throw during hydration.
 */
const isVercelProduction =
  process.env.VERCEL === "1" && process.env.VERCEL_ENV === "production";

/** A canonical origin pointing at the developer's own machine. */
const isLocalOrigin = (value: string): boolean =>
  /^https?:\/\/(localhost|127\.0\.0\.1|\[::1\])(:\d+)?$/i.test(value);

/**
 * Refuse to build the production site without a real canonical origin.
 *
 * This guards against a misconfiguration that actually shipped: with
 * `NEXT_PUBLIC_SITE_URL` unset, every canonical tag, sitemap `<loc>`, robots
 * `Host`/`Sitemap` line and JSON-LD `@id` fell back to `http://localhost:3000`.
 * The site still returned 200 everywhere, so nothing looked broken — but it
 * told search engines that the authoritative copy of every page lives on an
 * origin they cannot crawl, which keeps the whole site out of the index.
 *
 * A silently wrong deployment is worse than a failed build, so production
 * stops here. Local, preview and test runs keep the localhost fallback so
 * development needs no configuration.
 */
if (isVercelProduction && (!rawSiteUrl || isLocalOrigin(rawSiteUrl))) {
  throw new Error(
    "NEXT_PUBLIC_SITE_URL is missing or points at localhost for this " +
      "production deployment. Canonical URLs, the sitemap and robots.txt " +
      "would all advertise http://localhost:3000 to search engines, keeping " +
      "the site out of search results. Set it in Vercel → Settings → " +
      "Environment Variables (Production) to the origin that actually serves " +
      "the site — no trailing slash — then redeploy. See docs/deployment.md.",
  );
}

export const siteConfig = {
  name: process.env.NEXT_PUBLIC_SITE_NAME ?? "iPassGenerator",
  /** Canonical origin, never has a trailing slash. */
  url: trimTrailingSlash(rawSiteUrl ?? "http://localhost:3000"),
  tagline: "Privacy-first password security tools",
  description:
    "Generate strong passwords, passphrases and random strings in your browser. Nothing is uploaded, stored or logged.",
  locale: "en",
  contactEmail: "hello@ipassgenerator.online",
} as const;

export type SiteConfig = typeof siteConfig;

/** Builds an absolute URL for canonical tags, sitemap entries and Open Graph. */
export function absoluteUrl(path = "/"): string {
  const normalised = path.startsWith("/") ? path : `/${path}`;
  return `${siteConfig.url}${normalised}`;
}