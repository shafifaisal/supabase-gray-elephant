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

const rawSiteUrl = process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000";

export const siteConfig = {
  name: process.env.NEXT_PUBLIC_SITE_NAME ?? "iPassGenerator",
  /** Canonical origin, never has a trailing slash. */
  url: trimTrailingSlash(rawSiteUrl),
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