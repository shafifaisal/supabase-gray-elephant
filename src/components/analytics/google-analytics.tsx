"use client";

import { useEffect, useRef } from "react";

import { useHasOptionalConsent } from "@/lib/ads/use-consent";

/**
 * Consent-gated Google Analytics 4 loader.
 *
 * PRIVACY CONTRACT (AGENTS.md §4)
 * -------------------------------
 * gtag.js is injected ONLY when BOTH are true:
 *   1. the server reports analytics is enabled — the admin `analytics_enabled`
 *      setting is on AND a valid GA4 measurement ID resolves (the owner's
 *      bundled default, or `NEXT_PUBLIC_GA_MEASUREMENT_ID` when set) — fetched
 *      from /api/analytics/config;
 *   2. the visitor has granted optional ("accept all") consent, read from the
 *      first-party consent cookie via useHasOptionalConsent.
 *
 * BEFORE CONSENT this component makes NO network request at all. It renders
 * nothing and does not even ask the server whether analytics is configured — the
 * readiness fetch happens only after consent. A visitor who declines therefore
 * causes zero analytics requests, first- or third-party.
 *
 * On the server the consent snapshot is always "no consent", so no script tag is
 * ever part of the served HTML; it is added client-side, after consent.
 *
 * This file never reads a secret and never touches password-generation code. No
 * generated value is ever passed to gtag — there is no code path that can send
 * one.
 */

declare global {
  interface Window {
    dataLayer?: unknown[];
    gtag?: (...args: unknown[]) => void;
  }
}

const CONFIG_URL = "/api/analytics/config";
const SCRIPT_ID = "ga-gtag-js";

interface AnalyticsConfigResponse {
  enabled?: boolean;
  measurementId?: string | null;
}

/**
 * Injects the gtag.js loader and runs the standard bootstrap, exactly once.
 *
 * The `dataLayer`/`gtag` pair is the official GA4 snippet, expressed without the
 * discouraged bare `arguments` object so it passes lint.
 */
function loadGtag(measurementId: string): void {
  if (!document.getElementById(SCRIPT_ID)) {
    const script = document.createElement("script");
    script.id = SCRIPT_ID;
    script.async = true;
    script.src = `https://www.googletagmanager.com/gtag/js?id=${encodeURIComponent(
      measurementId,
    )}`;
    document.head.appendChild(script);
  }

  const dataLayer = (window.dataLayer = window.dataLayer || []);
  window.gtag = (...args: unknown[]) => {
    dataLayer.push(args);
  };
  window.gtag("js", new Date());
  window.gtag("config", measurementId);
}

export function GoogleAnalytics() {
  const hasConsent = useHasOptionalConsent();
  const loaded = useRef(false);

  useEffect(() => {
    if (!hasConsent || loaded.current) return;

    let cancelled = false;
    const controller = new AbortController();

    void (async () => {
      try {
        const response = await fetch(CONFIG_URL, {
          cache: "no-store",
          signal: controller.signal,
        });
        if (!response.ok) return;
        const config = (await response.json()) as AnalyticsConfigResponse;
        if (cancelled || !config.enabled || !config.measurementId) return;
        loaded.current = true;
        loadGtag(config.measurementId);
      } catch {
        // Analytics must never break the page: fail silently. Nothing is
        // logged, so no page data is written to the console or a log sink.
      }
    })();

    return () => {
      cancelled = true;
      controller.abort();
    };
  }, [hasConsent]);

  return null;
}
