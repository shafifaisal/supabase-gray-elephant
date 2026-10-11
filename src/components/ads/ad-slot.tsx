"use client";

import { useEffect, useRef } from "react";

import { useHasOptionalConsent } from "@/lib/ads/use-consent";

/**
 * A consent-gated AdSense unit.
 *
 * PRIVACY CONTRACT (AGENTS.md §4)
 * -------------------------------
 * The AdSense script is injected ONLY when BOTH are true:
 *   1. the server passed `ready` — ads are admin-enabled, a real publisher ID is
 *      configured, and the deployment allows them (see src/lib/ads/config.ts);
 *   2. the visitor has granted optional ("accept all") consent, read from the
 *      first-party consent cookie via useHasOptionalConsent.
 *
 * If either is false, this component renders an empty, clearly-labelled slot
 * placeholder with NO script, NO network request and NO tracking. On the server
 * the consent snapshot is always "no consent", so the script tag is never part
 * of the server HTML — it is added client-side after consent.
 *
 * The publisher ID and slot come from props (resolved server-side); this file
 * never reads secrets and never touches password-generation code.
 */

declare global {
  interface Window {
    adsbygoogle?: unknown[];
  }
}

export interface AdSlotProps {
  /** Whether ads are fully configured and allowed (server-resolved). */
  ready: boolean;
  /** The real publisher ID, present only when `ready`. */
  publisherId: string | null;
  /** Ad unit slot id from the AdSense dashboard. */
  slot: string;
  /** Layout format, e.g. "auto" for responsive. */
  format?: "auto" | "rectangle" | "horizontal" | "vertical";
  /** Accessible label; ads must be distinguishable from site content. */
  label?: string;
  className?: string;
}

export function AdSlot({
  ready,
  publisherId,
  slot,
  format = "auto",
  label = "Advertisement",
  className = "",
}: AdSlotProps) {
  const hasConsent = useHasOptionalConsent();
  const pushed = useRef(false);

  // Inject the AdSense loader script once, and only after consent.
  useEffect(() => {
    if (!ready || !publisherId || !hasConsent) return;

    const scriptId = "adsbygoogle-js";
    if (!document.getElementById(scriptId)) {
      const script = document.createElement("script");
      script.id = scriptId;
      script.async = true;
      script.crossOrigin = "anonymous";
      script.src = `https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=${encodeURIComponent(
        publisherId,
      )}`;
      document.head.appendChild(script);
    }

    // Register this specific ad unit with the (now-loaded) library.
    if (!pushed.current) {
      pushed.current = true;
      (window.adsbygoogle = window.adsbygoogle || []).push({});
    }
  }, [ready, publisherId, hasConsent]);

  // Not configured: render nothing at all — no empty box, no label.
  if (!ready) return null;

  return (
    <aside
      aria-label={label}
      className={`rounded-[var(--radius-card)] border border-dashed border-border bg-secondary/30 p-3 text-center ${className}`}
    >
      <p className="mb-2 text-[0.65rem] font-semibold tracking-wide text-muted-foreground uppercase">
        {label}
      </p>
      {hasConsent ? (
        <ins
          className="adsbygoogle block"
          style={{ display: "block" }}
          data-ad-client={publisherId ?? undefined}
          data-ad-slot={slot}
          data-ad-format={format}
          data-full-width-responsive="true"
        />
      ) : (
        // Ads are configured but the visitor has not consented. Show an honest,
        // inert placeholder — no script, no request. They can enable ads via the
        // cookie banner.
        <p className="px-4 py-6 text-xs text-muted-foreground">
          Ads are hidden until you accept optional cookies. You can change this
          any time from the cookie banner.
        </p>
      )}
    </aside>
  );
}
