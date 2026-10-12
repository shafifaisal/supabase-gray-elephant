import { afterEach, describe, expect, it, vi } from "vitest";

/**
 * The guard in `@/lib/site` throws at module scope, so each case must
 * re-evaluate the module with a fresh environment. `vi.resetModules()` plus a
 * dynamic import gives us that.
 */
const ENV_KEYS = ["NEXT_PUBLIC_SITE_URL", "VERCEL", "VERCEL_ENV"] as const;
const saved = Object.fromEntries(ENV_KEYS.map((key) => [key, process.env[key]]));

function setEnv(values: Partial<Record<(typeof ENV_KEYS)[number], string>>) {
  for (const key of ENV_KEYS) {
    const value = values[key];
    if (value === undefined) delete process.env[key];
    else process.env[key] = value;
  }
  vi.resetModules();
}

const load = () => import("@/lib/site");

afterEach(() => {
  setEnv(saved as never);
});

describe("siteConfig production guard", () => {
  it("throws on Vercel production when NEXT_PUBLIC_SITE_URL is unset", async () => {
    setEnv({ VERCEL: "1", VERCEL_ENV: "production" });

    await expect(load()).rejects.toThrow(/NEXT_PUBLIC_SITE_URL is missing/);
  });

  it("throws on Vercel production when the origin is localhost", async () => {
    setEnv({
      VERCEL: "1",
      VERCEL_ENV: "production",
      NEXT_PUBLIC_SITE_URL: "http://localhost:3000",
    });

    await expect(load()).rejects.toThrow(/NEXT_PUBLIC_SITE_URL is missing/);
  });

  it("accepts a real origin on Vercel production and strips the trailing slash", async () => {
    setEnv({
      VERCEL: "1",
      VERCEL_ENV: "production",
      NEXT_PUBLIC_SITE_URL: "https://www.ipassgenerator.online/",
    });

    const { siteConfig } = await load();
    expect(siteConfig.url).toBe("https://www.ipassgenerator.online");
  });

  it("does not throw on a Vercel preview deployment", async () => {
    setEnv({ VERCEL: "1", VERCEL_ENV: "preview" });

    const { siteConfig } = await load();
    expect(siteConfig.url).toBe("http://localhost:3000");
  });

  it("does not throw off Vercel, so local work needs no configuration", async () => {
    setEnv({});

    const { siteConfig } = await load();
    expect(siteConfig.url).toBe("http://localhost:3000");
  });

  it("does not throw when a local development build sets a localhost origin", async () => {
    setEnv({ NEXT_PUBLIC_SITE_URL: "http://localhost:3000" });

    const { siteConfig } = await load();
    expect(siteConfig.url).toBe("http://localhost:3000");
  });
});

describe("absoluteUrl", () => {
  it("builds an absolute URL from a path", async () => {
    setEnv({ NEXT_PUBLIC_SITE_URL: "https://example.test" });

    const { absoluteUrl } = await load();
    expect(absoluteUrl("/guides")).toBe("https://example.test/guides");
  });

  it("defaults to the origin and normalises a missing leading slash", async () => {
    setEnv({ NEXT_PUBLIC_SITE_URL: "https://example.test" });

    const { absoluteUrl } = await load();
    expect(absoluteUrl()).toBe("https://example.test/");
    expect(absoluteUrl("guides")).toBe("https://example.test/guides");
  });
});
