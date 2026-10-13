import { NextResponse } from "next/server";

import { resolveAnalyticsConfig } from "@/lib/analytics/config";
import { isFeatureEnabled, SETTING_KEYS } from "@/lib/settings/public";

/**
 * GET /api/analytics/config
 *
 * Public, read-only view of analytics readiness. Intended for the client
 * <GoogleAnalytics> loader. It exposes ONLY non-sensitive facts:
 *   - `enabled`: whether analytics may run at all;
 *   - `measurementId`: the real GA4 ID when enabled, otherwise null.
 *
 * The measurement ID is public by nature — it appears in the page source of any
 * site using GA. It is never a secret, and a missing/invalid value is reported
 * as null rather than fabricated.
 *
 * This endpoint does not itself load any script; the client loader still
 * requires visitor consent before injecting gtag.js. It is deliberately NOT
 * fetched before consent (see the loader), so a visitor who declines triggers
 * no request here.
 *
 * Not cached: readiness must reflect the current admin setting immediately.
 */
export const dynamic = "force-dynamic";

export async function GET() {
  const adminEnabled = await isFeatureEnabled(
    SETTING_KEYS.analyticsEnabled,
  ).catch(() => false);
  const config = resolveAnalyticsConfig(adminEnabled);

  return NextResponse.json(
    {
      enabled: config.enabled,
      measurementId: config.enabled ? config.measurementId : null,
      // Reminder to any consumer: consent is still required before loading.
      consentRequired: true,
    },
    {
      headers: { "Cache-Control": "no-store" },
    },
  );
}
