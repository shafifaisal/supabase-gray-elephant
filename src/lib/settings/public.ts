import "server-only";

import { cache } from "react";

import { createBuildClient } from "@/lib/supabase/build";
import { siteConfig } from "@/lib/site";

import { asBoolean } from "./parse";

/**
 * Public, non-secret site settings.
 *
 * WHY A SEPARATE LAYER
 * -------------------
 * `src/lib/site.ts` holds compile-time defaults from environment variables and
 * is always available. Administrators can OVERRIDE a subset of those values at
 * runtime through the `site_settings` table (see /admin/settings). This module
 * is the single place that layers the database on top of the static config.
 *
 * SECURITY MODEL
 * --------------
 * The query runs through the cookie-free anon client, so PostgreSQL Row Level
 * Security applies. The `site_settings_public_read` policy returns ONLY rows
 * where `is_secret = false`; secret rows are filtered by the database, not by
 * this code. Even if this function is called with a session, secrets still do
 * not reach an anonymous visitor.
 *
 * FAILURE MODEL
 * -------------
 * A public page must never 500 because a cosmetic setting is missing or the
 * database is briefly unreachable. Every helper here therefore falls back to
 * the static `siteConfig` value and swallows the error. Settings affect
 * presentation, never authorization.
 */

/** The public setting keys this application understands. */
export const SETTING_KEYS = {
  brandName: "brand_name",
  tagline: "site_tagline",
  description: "site_description",
  contactEmail: "contact_email",
  footerText: "footer_text",
  analyticsEnabled: "analytics_enabled",
  adsenseEnabled: "adsense_enabled",
  maintenanceMode: "maintenance_mode",
  privacyPolicyHtml: "legal_privacy_policy_html",
  termsHtml: "legal_terms_html",
  cookiePolicyHtml: "legal_cookie_policy_html",
} as const;

export type SettingKey = (typeof SETTING_KEYS)[keyof typeof SETTING_KEYS];

export interface PublicSettings {
  /** Non-secret key/value pairs exactly as stored (JSONB values). */
  raw: Record<string, unknown>;
}

/**
 * Loads every non-secret setting as a plain object.
 *
 * Returns an empty object (never throws) when the database is unavailable, so
 * callers always fall back to static config rather than crashing a page.
 *
 * Wrapped in React's `cache` so that a single request — a layout plus its page
 * plus every metadata function — reads the table once rather than once per
 * helper. The memo is per request, so it never serves a stale value across
 * requests and is unaffected by `revalidatePath`.
 */
export const getPublicSettings = cache(
  async (): Promise<PublicSettings> => {
    try {
      const supabase = createBuildClient();

      const { data, error } = await supabase
        .from("site_settings")
        .select("key, value, is_secret");

      if (error) return { raw: {} };

      // Defence in depth: RLS already excludes secrets, but never expose a row
      // flagged secret even if a future policy change were to return one.
      const raw: Record<string, unknown> = {};
      for (const row of data ?? []) {
        if (row.is_secret) continue;
        raw[row.key] = row.value;
      }

      return { raw };
    } catch {
      return { raw: {} };
    }
  },
);

/** Reads one setting value, or `undefined` when unset/unavailable. */
function read(settings: PublicSettings, key: SettingKey): unknown {
  return settings.raw[key];
}

/** Coerces a stored JSON value to a trimmed, non-empty string, else undefined. */
function asString(value: unknown): string | undefined {
  if (typeof value !== "string") return undefined;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : undefined;
}

/**
 * Interprets a stored value as a boolean.
 *
 * Re-exported from `./parse` so the Edge proxy (maintenance mode) and this
 * module share one implementation.
 */
export { asBoolean } from "./parse";


/**
 * The effective brand name, database override first, static config as fallback.
 */
export async function getBrandName(): Promise<string> {
  const settings = await getPublicSettings();
  return asString(read(settings, SETTING_KEYS.brandName)) ?? siteConfig.name;
}

/** Effective tagline, override first. */
export async function getTagline(): Promise<string> {
  const settings = await getPublicSettings();
  return asString(read(settings, SETTING_KEYS.tagline)) ?? siteConfig.tagline;
}

/** Effective site description, override first. */
export async function getSiteDescription(): Promise<string> {
  const settings = await getPublicSettings();
  return (
    asString(read(settings, SETTING_KEYS.description)) ?? siteConfig.description
  );
}

/** Effective contact email, override first. */
export async function getContactEmail(): Promise<string> {
  const settings = await getPublicSettings();
  return (
    asString(read(settings, SETTING_KEYS.contactEmail)) ??
    siteConfig.contactEmail
  );
}

/** Effective footer small print, override first. */
export async function getFooterText(): Promise<string> {
  const settings = await getPublicSettings();
  const fallback = "Generated secrets never leave your device.";
  return asString(read(settings, SETTING_KEYS.footerText)) ?? fallback;
}

/**
 * The site's public identity in one read.
 *
 * The root layout needs the brand name (header, `<title>` template), the
 * tagline and description (metadata) and the contact email (structured data) at
 * once. Reading them through this helper keeps every surface consistent and,
 * because `getPublicSettings` is request-memised, costs one query.
 */
export interface SiteIdentity {
  name: string;
  tagline: string;
  description: string;
  contactEmail: string;
}

export async function getSiteIdentity(): Promise<SiteIdentity> {
  const settings = await getPublicSettings();
  return {
    name: asString(read(settings, SETTING_KEYS.brandName)) ?? siteConfig.name,
    tagline: asString(read(settings, SETTING_KEYS.tagline)) ?? siteConfig.tagline,
    description:
      asString(read(settings, SETTING_KEYS.description)) ?? siteConfig.description,
    contactEmail:
      asString(read(settings, SETTING_KEYS.contactEmail)) ??
      siteConfig.contactEmail,
  };
}

/**
 * Whether a feature toggle is enabled.
 *
 * Toggles fail closed: an unset or malformed value means disabled. This is the
 * only correct default for analytics and advertising, which must never run
 * without an explicit, deliberate switch-on.
 */
export async function isFeatureEnabled(
  key:
    | typeof SETTING_KEYS.analyticsEnabled
    | typeof SETTING_KEYS.adsenseEnabled,
): Promise<boolean> {
  const settings = await getPublicSettings();
  return asBoolean(read(settings, key));
}

/** Setting keys that hold CMS-authored legal HTML overrides. */
export type LegalKey =
  | typeof SETTING_KEYS.privacyPolicyHtml
  | typeof SETTING_KEYS.termsHtml
  | typeof SETTING_KEYS.cookiePolicyHtml;

/** Reads optional CMS-authored legal HTML, or undefined when not set. */
export async function getLegalHtml(
  key: LegalKey,
): Promise<string | undefined> {
  const settings = await getPublicSettings();
  return asString(read(settings, key));
}
