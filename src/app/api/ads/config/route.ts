import { NextResponse } from "next/server";

import { describeNotReady, resolveAdsConfig } from "@/lib/ads/config";
import { isFeatureEnabled, SETTING_KEYS } from "@/lib/settings/public";

/**
 * GET /api/ads/config
 *
 * Public, read-only view of ad readiness. Intended for the admin SEO screen and
 * for any client that needs to know whether ad slots will render. It exposes
 * ONLY non-sensitive facts:
 *   - `ready`: whether ads may run at all;
 *   - `reason`: why not, when not ready;
 *   - `publisherId`: the real ID when ready, otherwise null.
 *
 * It NEVER returns a secret, and it NEVER fabricates a publisher ID. When ads
 * are not ready, `publisherId` is null. This endpoint does not itself load any
 * script; the client AdSlot still requires visitor consent before injecting the
 * AdSense loader.
 *
 * Not cached: readiness must reflect the current admin setting immediately.
 */
export const dynamic = "force-dynamic";

export async function GET() {
  const adminEnabled = await isFeatureEnabled(SETTING_KEYS.adsenseEnabled).catch(
    () => false,
  );
  const config = resolveAdsConfig(adminEnabled);

  return NextResponse.json(
    {
      ready: config.ready,
      publisherId: config.ready ? config.publisherId : null,
      reason: config.reason,
      message: describeNotReady(config.reason),
      // Reminder to any consumer: consent is still required before loading.
      consentRequired: true,
    },
    {
      headers: { "Cache-Control": "no-store" },
    },
  );
}
