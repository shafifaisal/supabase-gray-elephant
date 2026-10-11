import "server-only";

/**
 * AdSense configuration and readiness.
 *
 * PRIVACY / POLICY MODEL (see AGENTS.md §4 and the project brief §18)
 * ------------------------------------------------------------------
 *  1. Ads are OPTIONAL and OFF by default. They only run when an administrator
 *     has explicitly enabled them AND a real publisher ID is configured. There
 *     is deliberately no bundled or placeholder publisher ID — a fake ID is a
 *     policy violation, so the code refuses to invent one.
 *  2. Nothing here loads a script. It only decides whether ads are *ready*.
 *     The client loader additionally requires visitor consent before injecting
 *     the AdSense script, so a script can never load before consent.
 *  3. Ad configuration is completely independent of the password-generation
 *     code paths; ads are only ever placed on content pages, never on a tool.
 *
 * READINESS is the conjunction of three independent facts, all of which must be
 * true. A missing piece means ads stay off — the safe default:
 *   - admin enabled advertising (the `adsense_enabled` site setting), AND
 *   - a syntactically valid publisher ID is configured, AND
 *   - the deployment is not explicitly force-disabled via env.
 */

/**
 * A Google AdSense publisher ID has the form `ca-pub-` followed by digits.
 * This validates the shape only. It is NOT a real, approved ID — the actual
 * value must be supplied by the site owner in an environment variable. The
 * pattern exists so a malformed value fails closed rather than being embedded
 * into a script URL.
 */
const PUBLISHER_ID_PATTERN = /^ca-pub-\d{10,20}$/;

/** Whether a value looks like a real AdSense publisher ID. */
export function isValidPublisherId(value: string | undefined | null): boolean {
  if (!value) return false;
  return PUBLISHER_ID_PATTERN.test(value.trim());
}

/** The configured publisher ID, or null when absent/invalid. */
export function publisherId(): string | null {
  const raw = process.env.NEXT_PUBLIC_ADSENSE_CLIENT_ID?.trim();
  return isValidPublisherId(raw) ? (raw as string) : null;
}

/**
 * A hard deployment-level kill switch. If `NEXT_PUBLIC_ADSENSE_ENABLED` is set
 * to anything other than "true", ads are off regardless of the admin setting.
 * This lets an operator disable ads at deploy time (e.g. during review) without
 * touching the database.
 */
export function deploymentAdsAllowed(): boolean {
  return process.env.NEXT_PUBLIC_ADSENSE_ENABLED?.trim().toLowerCase() === "true";
}

export interface AdsConfig {
  /** True only when ads may be shown: admin enabled, valid ID, deploy allowed. */
  ready: boolean;
  /** The publisher ID when ready, else null. Never a fabricated value. */
  publisherId: string | null;
  /** Human-readable reason ads are not ready, for the admin screen. */
  reason: AdsNotReadyReason;
}

export type AdsNotReadyReason =
  | "ready"
  | "disabled-by-admin"
  | "no-publisher-id"
  | "disabled-at-deploy";

/**
 * Resolves the effective ad configuration from env + the admin setting.
 *
 * `adminEnabled` is the `adsense_enabled` site setting, resolved by the caller
 * through the RLS-safe public settings layer. Keeping it a parameter (rather
 * than reading the DB here) keeps this module pure and trivially testable.
 */
export function resolveAdsConfig(adminEnabled: boolean): AdsConfig {
  const id = publisherId();
  const deployAllowed = deploymentAdsAllowed();

  if (!deployAllowed) {
    return { ready: false, publisherId: null, reason: "disabled-at-deploy" };
  }
  if (!adminEnabled) {
    return { ready: false, publisherId: null, reason: "disabled-by-admin" };
  }
  if (!id) {
    return { ready: false, publisherId: null, reason: "no-publisher-id" };
  }

  return { ready: true, publisherId: id, reason: "ready" };
}

/** Short, admin-facing explanation for a not-ready state. */
export function describeNotReady(reason: AdsNotReadyReason): string {
  switch (reason) {
    case "ready":
      return "Advertising is configured and will load only after a visitor consents.";
    case "disabled-by-admin":
      return 'Advertising is disabled. Enable the "adsense_enabled" setting to turn it on.';
    case "no-publisher-id":
      return "No valid AdSense publisher ID is configured. Set NEXT_PUBLIC_ADSENSE_CLIENT_ID. A placeholder ID is never used.";
    case "disabled-at-deploy":
      return "Advertising is disabled for this deployment via NEXT_PUBLIC_ADSENSE_ENABLED.";
  }
}
