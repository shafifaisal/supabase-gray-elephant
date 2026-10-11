# AdSense Readiness Report

**Status: NOT READY TO SERVE ADS — and intentionally so.**

As of this document, advertising is **disabled and fail-closed**. There is no
approved AdSense account, no real publisher ID is configured, and no ad has ever
been served. **Approval is not guaranteed and is not claimed.** This report
records exactly what is built, what remains, and the policy gates that must
clear before any ad is shown.

## 1. Current state (verified, not assumed)

`GET /api/ads/config` on a default deployment returns:

```json
{
  "ready": false,
  "publisherId": null,
  "reason": "disabled-at-deploy",
  "message": "Advertising is disabled for this deployment via NEXT_PUBLIC_ADSENSE_ENABLED.",
  "consentRequired": true
}
```

- The served HTML of `/guides` contains **no** AdSense script and **no** `<ins>`
  unit while ads are off (proven by `verify-content.mjs` and `verify-regression.mjs`).
- No publisher ID is ever fabricated; when not ready the resolved ID is `null`.
- These facts are enforced by tests, so a regression that ships ads without
  consent or configuration fails the gate.

## 2. What is implemented

- **Administrator-controlled enable/disable** via the `adsense_enabled` site
  setting, plus a deployment-level kill switch (`NEXT_PUBLIC_ADSENSE_ENABLED`).
- **Fail-closed readiness** (`src/lib/ads/config.ts`): ads run only when the
  admin setting is on **and** a syntactically valid publisher ID is present
  **and** the deployment switch is exactly `true`.
- **Consent gate** (`src/components/ads/ad-slot.tsx`): the AdSense loader script
  is injected **only after** the visitor grants optional (“accept all”) consent,
  read from a first-party cookie. It is never in server HTML.
- **Non-intrusive, clearly-labelled placement**: one responsive unit on `/guides`
  only, after content and visually separated. Ads are never placed on a tool
  page, and ad config is independent of password generation.
- **Honest legal copy**: the privacy and cookie policies describe AdSense
  accurately (runs only when enabled + consented; Google is a separate
  controller; no analytics at all).
- **Admin visibility**: `/admin/seo` shows the exact readiness reason.

## 3. What remains before ads can run

1. **A real, approved AdSense account and publisher ID** (`ca-pub-…`). Without
   it, `ready` stays `false`. Never use a placeholder ID.
2. **Domain approved by AdSense.** Submit the live domain for review; approval
   is Google’s decision and is **not guaranteed**. Do not represent it as such.
3. **A Google-certified CMP + IAB TCF for EEA/UK/CH.** For personalised ads in
   those regions, a certified Consent Management Platform following the current
   IAB Transparency & Consent Framework is required, and the requirements change
   over time — re-verify before enabling. The current first-party consent is
   adequate for the “ads off / non-personalised” posture but is **not** a
   certified CMP. Set `NEXT_PUBLIC_CMP_ID` when one is chosen.
4. **Content sufficiency.** AdSense expects enough original, useful content.
   Ensure a healthy set of published guides exists before enabling ads.
5. **`ads.txt`.** Once you have a publisher ID, add `/public/ads.txt` with your
   line (`google.com, pub-XXXXXXXXXXXXXXXX, DIRECT, f08c47fec0942fa0`). This is a
   common approval blocker and is deliberately not fabricated here.
6. **Policy review.** Re-read the current AdSense programme policies and
   eligibility requirements before submitting. No incentivised clicks, no
   misleading labels, no ads on unsuitable content.

## 4. Enabling ads (operator runbook)

Only after items 1–6 above:

```bash
# Vercel → Production env
NEXT_PUBLIC_ADSENSE_CLIENT_ID=ca-pub-XXXXXXXXXXXXXXXX
NEXT_PUBLIC_ADSENSE_ENABLED=true
NEXT_PUBLIC_ADSENSE_SLOT_GUIDES=<slot id from the AdSense dashboard>
```

Then, in the admin panel, set **`adsense_enabled` = true**. Redeploy. Confirm
`/api/ads/config` reports `ready: true` and that the loader appears on `/guides`
only after a visitor consents. To disable instantly, flip the deploy switch back
to `false` — no code change or redeploy of content required.

## 5. Compliance notes

- No ad or analytics script loads before consent (AGENTS.md §4).
- The consent banner states plainly that ads are off until accepted.
- This report makes **no claim** that Google has approved, or will approve, the
  site.
