import { afterEach, describe, expect, it, vi } from "vitest";

// `server-only` throws outside a Server Component render; neutralise the import
// guard so this pure logic can be unit-tested. The module stays a server module.
vi.mock("server-only", () => ({}));

import {
  gaMeasurementId,
  isValidGaMeasurementId,
  resolveAnalyticsConfig,
} from "@/lib/analytics/config";

/**
 * These tests pin the fail-closed contract of the analytics configuration:
 * analytics must be OFF unless every precondition is satisfied, and no
 * measurement ID is ever fabricated. A regression here could ship analytics
 * without readiness — or with a malformed ID embedded in a script URL.
 */

const ORIGINAL_ENV = { ...process.env };

function setGaEnv(measurementId?: string) {
  delete process.env.NEXT_PUBLIC_GA_MEASUREMENT_ID;
  if (measurementId !== undefined) {
    process.env.NEXT_PUBLIC_GA_MEASUREMENT_ID = measurementId;
  }
}

afterEach(() => {
  process.env = { ...ORIGINAL_ENV };
});

describe("isValidGaMeasurementId — shape only, never a real ID", () => {
  it("accepts the G-<alphanumerics> shape", () => {
    expect(isValidGaMeasurementId("G-F821LK82PY")).toBe(true);
  });

  it("is case-insensitive about the letters", () => {
    expect(isValidGaMeasurementId("g-f821lk82py")).toBe(true);
  });

  it("rejects missing, malformed or unrelated values", () => {
    expect(isValidGaMeasurementId(undefined)).toBe(false);
    expect(isValidGaMeasurementId(null)).toBe(false);
    expect(isValidGaMeasurementId("")).toBe(false);
    expect(isValidGaMeasurementId("G-")).toBe(false);
    expect(isValidGaMeasurementId("UA-123456-1")).toBe(false);
    expect(isValidGaMeasurementId("ca-pub-1234567890123456")).toBe(false);
    expect(isValidGaMeasurementId("G-ABC DEF")).toBe(false);
  });
});

describe("gaMeasurementId — from env, normalised", () => {
  it("returns null when unset or invalid (never a placeholder)", () => {
    setGaEnv();
    expect(gaMeasurementId()).toBeNull();
    setGaEnv("not-a-ga-id");
    expect(gaMeasurementId()).toBeNull();
  });

  it("returns the uppercase ID when valid", () => {
    setGaEnv("g-f821lk82py");
    expect(gaMeasurementId()).toBe("G-F821LK82PY");
  });
});

describe("resolveAnalyticsConfig — fail closed", () => {
  it("is disabled when the admin has not enabled analytics", () => {
    setGaEnv("G-F821LK82PY");
    const config = resolveAnalyticsConfig(false);
    expect(config.enabled).toBe(false);
    expect(config.measurementId).toBeNull();
  });

  it("is disabled when no valid measurement ID is present", () => {
    setGaEnv();
    const config = resolveAnalyticsConfig(true);
    expect(config.enabled).toBe(false);
    expect(config.measurementId).toBeNull();
  });

  it("is enabled only when admin-enabled AND a valid ID is set", () => {
    setGaEnv("G-F821LK82PY");
    const config = resolveAnalyticsConfig(true);
    expect(config.enabled).toBe(true);
    expect(config.measurementId).toBe("G-F821LK82PY");
  });
});
