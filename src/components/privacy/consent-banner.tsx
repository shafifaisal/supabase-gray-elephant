"use client";

import { useCallback, useSyncExternalStore } from "react";
import Link from "next/link";

/**
 * Cookie / privacy consent banner.
 *
 * PRIVACY MODEL (see AGENTS.md §4)
 * --------------------------------
 * No analytics or advertising script is ever loaded by this component. It only
 * records the visitor's choice and stores it so it is not asked twice. The
 * actual scripts — when they exist in a later phase — must be gated on this
 * stored decision and must not load until consent is granted.
 *
 * WHY IT STILL SHOWS WHEN NOTHING IS ENABLED
 * ------------------------------------------
 * Honesty. The banner tells the visitor exactly what will and will not happen.
 * When no analytics or ads are configured, both "Accept" and "Essential only"
 * lead to the same outcome (nothing loads), and the banner says so. This avoids
 * a dark pattern where "Accept" appears to grant tracking that is not actually
 * happening, and it keeps the mechanism in place and tested for when optional
 * services are switched on.
 *
 * The decision is stored in a first-party cookie (not third-party, not sent to
 * any analytics). It is never used to hold a generated secret.
 */

const CONSENT_COOKIE = "ip_consent";
const CONSENT_VERSION = "1";

type ConsentValue = "all" | "essential";

function readConsent(): ConsentValue | null {
  if (typeof document === "undefined") return null;
  const match = document.cookie
    .split("; ")
    .find((row) => row.startsWith(`${CONSENT_COOKIE}=`));
  if (!match) return null;
  const value = match.slice(CONSENT_COOKIE.length + 1);
  if (value === "all" || value === "essential") return value;
  return null;
}

function writeConsent(value: ConsentValue): void {
  // One year, first-party, Lax so it is sent on normal navigation only.
  const maxAge = 60 * 60 * 24 * 365;
  document.cookie = `${CONSENT_COOKIE}=${value}; Path=/; Max-Age=${maxAge}; SameSite=Lax`;
  // Notify any subscriber (this hook, and future gated loaders) of the change.
  window.dispatchEvent(new Event("storage"));
}

/** Whether a decision has already been recorded. Browser-only. */
function hasDecision(): boolean {
  return readConsent() !== null;
}

function subscribe(onChange: () => void): () => void {
  window.addEventListener("storage", onChange);
  window.addEventListener("consentchange", onChange);
  return () => {
    window.removeEventListener("storage", onChange);
    window.removeEventListener("consentchange", onChange);
  };
}

export function ConsentBanner() {
  /*
   * `useSyncExternalStore` is the correct tool for reading browser-only state
   * (a cookie) that must not cause a hydration mismatch:
   *   - getServerSnapshot returns `false`, so the server emits NO banner. There
   *     is nothing to mismatch, and a crawler or no-JS visitor never sees it.
   *   - getSnapshot reads the cookie on the client, so after hydration a
   *     returning visitor who already chose stays hidden and a first-time
   *     visitor is shown the banner.
   * Reading the cookie during render (not in an effect) also avoids a
   * post-mount setState cascade.
   */
  const decided = useSyncExternalStore(
    subscribe,
    hasDecision,
    () => true, // server: treat as decided so the banner is never server-rendered
  );

  const choose = useCallback((value: ConsentValue) => {
    writeConsent(value);
    window.dispatchEvent(
      new CustomEvent("consentchange", {
        detail: { value, version: CONSENT_VERSION },
      }),
    );
  }, []);

  if (decided) return null;

  return (
    <div
      role="region"
      aria-label="Cookie consent"
      className="fixed inset-x-0 bottom-0 z-40 border-t border-border bg-background/95 backdrop-blur"
    >
      <div className="container-page flex flex-col gap-4 py-4 sm:flex-row sm:items-center sm:justify-between">
        <p className="max-w-2xl text-sm text-muted-foreground">
          We use only the cookies needed to run and secure this site. Optional
          cookies let us show advertising; we never run third-party analytics,
          and ads stay off until you accept them here. You can change this any
          time — see the{" "}
          <Link href="/cookie-policy" className="underline underline-offset-2">
            cookie policy
          </Link>
          .
        </p>
        <div className="flex shrink-0 gap-2">
          <button
            type="button"
            onClick={() => choose("essential")}
            className="inline-flex h-10 items-center rounded-md border border-border px-4 text-sm font-semibold transition-colors hover:bg-secondary"
          >
            Essential only
          </button>
          <button
            type="button"
            onClick={() => choose("all")}
            className="inline-flex h-10 items-center justify-center rounded-md bg-primary px-4 text-sm font-semibold text-primary-foreground transition-opacity hover:opacity-90"
          >
            Accept all
          </button>
        </div>
      </div>
    </div>
  );
}
