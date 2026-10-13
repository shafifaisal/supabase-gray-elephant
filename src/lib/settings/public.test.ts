import { beforeEach, describe, expect, it, vi } from "vitest";

/**
 * `server-only` throws outside a React Server Component render, so it is mocked
 * away for these pure-logic unit tests. The module under test is still a server
 * module; only the import guard is neutralised here.
 */
vi.mock("server-only", () => ({}));

const fromMock = vi.fn();

vi.mock("@/lib/supabase/build", () => ({
  createBuildClient: () => ({ from: fromMock }),
}));

import {
  SETTING_KEYS,
  asBoolean,
  getBrandName,
  getContactEmail,
  getFooterText,
  getLegalHtml,
  getPublicSettings,
  getSiteDescription,
  getSiteIdentity,
  getTagline,
  isFeatureEnabled,
} from "@/lib/settings/public";
import { siteConfig } from "@/lib/site";

/** Builds a fake query chain that resolves to `result`. */
function mockSelect(result: { data: unknown; error: unknown }) {
  const chain = {
    select: vi.fn().mockResolvedValue(result),
  };
  fromMock.mockReturnValue(chain);
}

describe("getPublicSettings", () => {
  beforeEach(() => {
    fromMock.mockReset();
  });

  it("returns stored non-secret values keyed by name", async () => {
    mockSelect({
      data: [
        { key: "brand_name", value: "CustomBrand", is_secret: false },
        { key: "analytics_enabled", value: true, is_secret: false },
      ],
      error: null,
    });

    const settings = await getPublicSettings();
    expect(settings.raw.brand_name).toBe("CustomBrand");
    expect(settings.raw.analytics_enabled).toBe(true);
  });

  it("never exposes a row flagged secret, even if the query returned it", async () => {
    // Defence in depth: RLS should already exclude these, but the code must not
    // rely on that alone.
    mockSelect({
      data: [
        { key: "supabase_service_key", value: "sk_live_xxx", is_secret: true },
        { key: "brand_name", value: "SafeBrand", is_secret: false },
      ],
      error: null,
    });

    const settings = await getPublicSettings();
    expect(settings.raw).not.toHaveProperty("supabase_service_key");
    expect(settings.raw.brand_name).toBe("SafeBrand");
  });

  it("falls back to an empty object when the query errors", async () => {
    mockSelect({ data: null, error: { message: "boom" } });
    const settings = await getPublicSettings();
    expect(settings.raw).toEqual({});
  });

  it("falls back to an empty object when the client throws", async () => {
    fromMock.mockImplementation(() => {
      throw new Error("network down");
    });
    const settings = await getPublicSettings();
    expect(settings.raw).toEqual({});
  });
});

describe("asBoolean — fails closed", () => {
  it("accepts real booleans", () => {
    expect(asBoolean(true)).toBe(true);
    expect(asBoolean(false)).toBe(false);
  });

  it("accepts the string true, case-insensitively", () => {
    expect(asBoolean("true")).toBe(true);
    expect(asBoolean("TRUE")).toBe(true);
    expect(asBoolean("  true  ")).toBe(true);
  });

  it("treats anything else as false", () => {
    expect(asBoolean("false")).toBe(false);
    expect(asBoolean("yes")).toBe(false);
    expect(asBoolean(1)).toBe(true);
    expect(asBoolean(2)).toBe(false);
    expect(asBoolean(null)).toBe(false);
    expect(asBoolean(undefined)).toBe(false);
    expect(asBoolean({})).toBe(false);
  });
});

describe("effective value helpers", () => {
  beforeEach(() => {
    fromMock.mockReset();
  });

  it("prefers the database override for brand name", async () => {
    mockSelect({
      data: [{ key: SETTING_KEYS.brandName, value: "Override", is_secret: false }],
      error: null,
    });
    expect(await getBrandName()).toBe("Override");
  });

  it("falls back to static config when the setting is unset", async () => {
    mockSelect({ data: [], error: null });
    expect(await getBrandName()).toBe(siteConfig.name);
    expect(await getTagline()).toBe(siteConfig.tagline);
    expect(await getSiteDescription()).toBe(siteConfig.description);
    expect(await getContactEmail()).toBe(siteConfig.contactEmail);
  });

  it("ignores a blank string override and uses the fallback", async () => {
    mockSelect({
      data: [{ key: SETTING_KEYS.brandName, value: "   ", is_secret: false }],
      error: null,
    });
    expect(await getBrandName()).toBe(siteConfig.name);
  });

  it("returns the documented footer default when unset", async () => {
    mockSelect({ data: [], error: null });
    expect(await getFooterText()).toBe("Generated secrets never leave your device.");
  });
});

describe("getSiteIdentity", () => {
  beforeEach(() => {
    fromMock.mockReset();
  });

  it("layers every database override over the static config", async () => {
    mockSelect({
      data: [
        { key: SETTING_KEYS.brandName, value: "Acme", is_secret: false },
        { key: SETTING_KEYS.tagline, value: "Security, simply", is_secret: false },
        { key: SETTING_KEYS.description, value: "A description", is_secret: false },
        {
          key: SETTING_KEYS.contactEmail,
          value: "hi@acme.test",
          is_secret: false,
        },
      ],
      error: null,
    });

    expect(await getSiteIdentity()).toEqual({
      name: "Acme",
      tagline: "Security, simply",
      description: "A description",
      contactEmail: "hi@acme.test",
    });
  });

  it("falls back to the static config for every field", async () => {
    mockSelect({ data: [], error: null });

    expect(await getSiteIdentity()).toEqual({
      name: siteConfig.name,
      tagline: siteConfig.tagline,
      description: siteConfig.description,
      contactEmail: siteConfig.contactEmail,
    });
  });
});

describe("feature toggles", () => {
  beforeEach(() => {
    fromMock.mockReset();
  });

  it("analytics and ads are disabled unless explicitly enabled", async () => {
    mockSelect({ data: [], error: null });
    expect(await isFeatureEnabled(SETTING_KEYS.analyticsEnabled)).toBe(false);
    expect(await isFeatureEnabled(SETTING_KEYS.adsenseEnabled)).toBe(false);
  });

  it("returns true only for an explicit enable", async () => {
    mockSelect({
      data: [{ key: SETTING_KEYS.adsenseEnabled, value: true, is_secret: false }],
      error: null,
    });
    expect(await isFeatureEnabled(SETTING_KEYS.adsenseEnabled)).toBe(true);
    expect(await isFeatureEnabled(SETTING_KEYS.analyticsEnabled)).toBe(false);
  });
});

describe("legal HTML", () => {
  beforeEach(() => {
    fromMock.mockReset();
  });

  it("returns the stored HTML when present", async () => {
    mockSelect({
      data: [
        {
          key: SETTING_KEYS.privacyPolicyHtml,
          value: "<p>Custom policy</p>",
          is_secret: false,
        },
      ],
      error: null,
    });
    expect(await getLegalHtml(SETTING_KEYS.privacyPolicyHtml)).toBe(
      "<p>Custom policy</p>",
    );
  });

  it("returns undefined when unset so the page uses static copy", async () => {
    mockSelect({ data: [], error: null });
    expect(await getLegalHtml(SETTING_KEYS.termsHtml)).toBeUndefined();
  });
});
