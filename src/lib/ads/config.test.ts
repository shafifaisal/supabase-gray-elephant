import { afterEach, describe, expect, it, vi } from "vitest";

// `server-only` throws outside a Server Component render; neutralise the import
// guard so this pure logic can be unit-tested. The module stays a server module.
vi.mock("server-only", () => ({}));

import {
  describeNotReady,
  isValidPublisherId,
  resolveAdsConfig,
} from "@/lib/ads/config";

/**
 * These tests pin the fail-closed contract of the ad configuration: ads must be
 * OFF unless every precondition is satisfied, and no publisher ID is ever
 * fabricated. A regression here could ship ads without consent readiness.
 */

const ORIGINAL_ENV = { ...process.env };

function setAdsEnv(opts: {
  clientId?: string;
  enabled?: string;
}) {
  delete process.env.NEXT_PUBLIC_ADSENSE_CLIENT_ID;
  delete process.env.NEXT_PUBLIC_ADSENSE_ENABLED;
  if (opts.clientId !== undefined) {
    process.env.NEXT_PUBLIC_ADSENSE_CLIENT_ID = opts.clientId;
  }
  if (opts.enabled !== undefined) {
    process.env.NEXT_PUBLIC_ADSENSE_ENABLED = opts.enabled;
  }
}

afterEach(() => {
  process.env = { ...ORIGINAL_ENV };
});

describe("isValidPublisherId — shape only, never a real ID", () => {
  it("accepts the ca-pub-<digits> shape", () => {
    expect(isValidPublisherId("ca-pub-1234567890123456")).toBe(true);
  });

  it("rejects missing, malformed or placeholder values", () => {
    expect(isValidPublisherId(undefined)).toBe(false);
    expect(isValidPublisherId(null)).toBe(false);
    expect(isValidPublisherId("")).toBe(false);
    expect(isValidPublisherId("ca-pub-abc")).toBe(false);
    expect(isValidPublisherId("pub-1234567890123456")).toBe(false);
    expect(isValidPublisherId("ca-pub-123")).toBe(false); // too short
    expect(isValidPublisherId("ca-pub-0000000000000000 placeholder")).toBe(false);
  });
});

describe("resolveAdsConfig — fail closed", () => {
  it("is not ready when the deployment kill switch is off", () => {
    setAdsEnv({ clientId: "ca-pub-1234567890123456", enabled: "false" });
    const config = resolveAdsConfig(true);
    expect(config.ready).toBe(false);
    expect(config.reason).toBe("disabled-at-deploy");
    expect(config.publisherId).toBeNull();
  });

  it("is not ready when the admin has not enabled ads", () => {
    setAdsEnv({ clientId: "ca-pub-1234567890123456", enabled: "true" });
    const config = resolveAdsConfig(false);
    expect(config.ready).toBe(false);
    expect(config.reason).toBe("disabled-by-admin");
  });

  it("is not ready when no valid publisher ID is present (never fabricates one)", () => {
    setAdsEnv({ enabled: "true" });
    const config = resolveAdsConfig(true);
    expect(config.ready).toBe(false);
    expect(config.reason).toBe("no-publisher-id");
    expect(config.publisherId).toBeNull();
  });

  it("is ready only when all three preconditions hold", () => {
    setAdsEnv({ clientId: "ca-pub-1234567890123456", enabled: "true" });
    const config = resolveAdsConfig(true);
    expect(config.ready).toBe(true);
    expect(config.reason).toBe("ready");
    expect(config.publisherId).toBe("ca-pub-1234567890123456");
  });

  it("treats the deploy switch case-insensitively but strictly", () => {
    setAdsEnv({ clientId: "ca-pub-1234567890123456", enabled: "TRUE" });
    expect(resolveAdsConfig(true).ready).toBe(true);
    setAdsEnv({ clientId: "ca-pub-1234567890123456", enabled: "yes" });
    expect(resolveAdsConfig(true).ready).toBe(false);
  });
});

describe("describeNotReady", () => {
  it("returns a non-empty explanation for every reason", () => {
    for (const reason of [
      "ready",
      "disabled-by-admin",
      "no-publisher-id",
      "disabled-at-deploy",
    ] as const) {
      expect(describeNotReady(reason).length).toBeGreaterThan(0);
    }
  });
});
