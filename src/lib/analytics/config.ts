import "server-only";

/**
 * Google Analytics 4 configuration and readiness.
 *
 * PRIVACY / POLICY MODEL (see AGENTS.md §4)
 * -----------------------------------------
 *  1. Analytics is OPTIONAL and OFF by default. It only runs when an
 *     administrator has explicitly enabled it (the `analytics_enabled` site
 *     setting) AND a syntactically valid GA4 measurement ID is configured.
 *     There is deliberately no bundled or placeholder ID — the value must be
 *     supplied by the site owner in an environment variable.
 *  2. Nothing here loads a script. It only decides whether analytics is
 *     *ready*. The client loader additionally requires visitor consent before
 *     injecting gtag.js, so a script can never load before consent.
 *  3. Analytics is completely independent of the password-generation code
 *     paths. No generated password, passphrase or random string is ever sent as
 *     an analytics event — those values never leave the device.
 *
 * READINESS is the conjunction of two independent facts, both of which must be
 * true. A missing piece means analytics stays off — the safe default:
 *   - admin enabled analytics (the `analytics_enabled` site setting), AND
 *   - a syntactically valid GA4 measurement ID is configured.
 */

/**
 * A GA4 measurement ID has the form `G-` followed by uppercase letters and
 * digits (e.g. `G-F821LK82PY`). This validates the shape only. It is NOT a real
 * ID — the actual value is supplied by the site owner via
 * `NEXT_PUBLIC_GA_MEASUREMENT_ID`. The pattern exists so a malformed value
 * fails closed rather than being embedded into a script URL.
 */
const GA4_MEASUREMENT_ID_PATTERN = /^G-[A-Z0-9]{4,}$/;

/** Whether a value looks like a real GA4 measurement ID. */
export function isValidGaMeasurementId(
  value: string | undefined | null,
): boolean {
  if (!value) return false;
  return GA4_MEASUREMENT_ID_PATTERN.test(value.trim().toUpperCase());
}

/** The configured measurement ID, normalised, or null when absent/invalid. */
export function gaMeasurementId(): string | null {
  const raw = process.env.NEXT_PUBLIC_GA_MEASUREMENT_ID?.trim().toUpperCase();
  return isValidGaMeasurementId(raw) ? (raw as string) : null;
}

export interface AnalyticsConfig {
  /** True only when analytics may run: admin enabled AND a valid ID is set. */
  enabled: boolean;
  /** The measurement ID when enabled, else null. Never a fabricated value. */
  measurementId: string | null;
}

/**
 * Resolves the effective analytics configuration from env + the admin setting.
 *
 * `adminEnabled` is the `analytics_enabled` site setting, resolved by the caller
 * through the RLS-safe public settings layer. Keeping it a parameter (rather
 * than reading the DB here) keeps this module pure and trivially testable.
 */
export function resolveAnalyticsConfig(adminEnabled: boolean): AnalyticsConfig {
  const id = gaMeasurementId();
  if (!adminEnabled || !id) {
    return { enabled: false, measurementId: null };
  }
  return { enabled: true, measurementId: id };
}
