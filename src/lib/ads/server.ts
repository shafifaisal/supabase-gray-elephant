import "server-only";

import { resolveAdsConfig, type AdsConfig } from "@/lib/ads/config";
import { isFeatureEnabled, SETTING_KEYS } from "@/lib/settings/public";

/**
 * Resolves the effective ad configuration for a server render, combining the
 * admin setting with the env-level publisher ID and deploy switch.
 *
 * Reads the `adsense_enabled` setting through the RLS-safe public settings
 * layer, then defers to the pure `resolveAdsConfig` for the fail-closed
 * decision. A failure to read settings is treated as "ads off".
 */
export async function getAdsConfig(): Promise<AdsConfig> {
  const adminEnabled = await isFeatureEnabled(SETTING_KEYS.adsenseEnabled).catch(
    () => false,
  );
  return resolveAdsConfig(adminEnabled);
}
