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
 * analytics must be OFF unless every precondition is satisfied, an invalid
 * configured ID never ships, and the only ID ever used is the owner's own
 * (env var or bundled default) — never a fabricated value. A regression here
 * could ship analytics without readiness — or with a malformed ID embedded in a
 * script URL.
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
    expect(isValidGaMeasurementId("G-FM1QKB6H5P")).toBe(true);
  });

  it("is case-insensitive about the letters", () => {
    expect(isValidGaMeasurementId("g-fm1qkb6h5p")).toBe(true);
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

describe("gaMeasurementId — env overrides the bundled default", () => {
  it("falls back to the owner's bundled ID when the env var is unset", () => {
    setGaEnv();
    expect(gaMeasurementId()).toBe("G-FM1QKB6H5P");
  });

  it("fails closed when the env var is present but malformed", () => {
    setGaEnv("not-a-ga-id");
    expect(gaMeasurementId()).toBeNull();
  });

  it("returns the uppercase env ID when valid (env wins)", () => {
    setGaEnv("g-abc123xyz");
    expect(gaMeasurementId()).toBe("G-ABC123XYZ");
  });
});

describe("resolveAnalyticsConfig — fail closed", () => {
  it("is disabled when the admin has not enabled analytics", () => {
    setGaEnv("G-FM1QKB6H5P");
    const config = resolveAnalyticsConfig(false);
    expect(config.enabled).toBe(false);
    expect(config.measurementId).toBeNull();
  });

  it("is disabled when the configured ID is malformed", () => {
    setGaEnv("not-a-ga-id");
    const config = resolveAnalyticsConfig(true);
    expect(config.enabled).toBe(false);
    expect(config.measurementId).toBeNull();
  });

  it("is enabled when admin-enabled even without the env var (bundled default)", () => {
    setGaEnv();
    const config = resolveAnalyticsConfig(true);
    expect(config.enabled).toBe(true);
    expect(config.measurementId).toBe("G-FM1QKB6H5P");
  });

  it("is enabled only when admin-enabled AND a valid ID is set", () => {
    setGaEnv("G-FM1QKB6H5P");
    const config = resolveAnalyticsConfig(true);
    expect(config.enabled).toBe(true);
    expect(config.measurementId).toBe("G-FM1QKB6H5P");
  });
});
