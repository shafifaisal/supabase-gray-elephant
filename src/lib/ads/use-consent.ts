"use client";

import { useSyncExternalStore } from "react";

/**
 * Client-side consent reader.
 *
 * Reads the first-party consent cookie written by <ConsentBanner>. This is the
 * single source of truth for whether optional scripts (ads, analytics) may run.
 *
 * WHY useSyncExternalStore
 * ------------------------
 * The cookie is browser-only state. Reading it during render with this hook:
 *   - returns a server snapshot of "no consent", so the server never emits an
 *     ad/analytics script and there is no hydration mismatch;
 *   - re-reads on the client and re-renders when the visitor changes their mind
 *     (the banner dispatches a `consentchange` event this subscribes to).
 *
 * It never reads or writes a generated secret — only the consent decision.
 */

export type ConsentChoice = "all" | "essential";

const CONSENT_COOKIE = "ip_consent";

function readConsent(): ConsentChoice | null {
  if (typeof document === "undefined") return null;
  const match = document.cookie
    .split("; ")
    .find((row) => row.startsWith(`${CONSENT_COOKIE}=`));
  if (!match) return null;
  const value = match.slice(CONSENT_COOKIE.length + 1);
  return value === "all" || value === "essential" ? value : null;
}

function subscribe(onChange: () => void): () => void {
  if (typeof window === "undefined") return () => {};
  window.addEventListener("consentchange", onChange);
  window.addEventListener("storage", onChange);
  return () => {
    window.removeEventListener("consentchange", onChange);
    window.removeEventListener("storage", onChange);
  };
}

/** True only when the visitor has granted "accept all" (optional) consent. */
export function useHasOptionalConsent(): boolean {
  const choice = useSyncExternalStore(
    subscribe,
    readConsent,
    () => null, // server snapshot: never consented, so never render a script
  );
  return choice === "all";
}

/** Exposed for tests and for the API route to share the cookie name. */
export { CONSENT_COOKIE, readConsent };
