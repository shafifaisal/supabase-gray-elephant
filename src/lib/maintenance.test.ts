import { describe, expect, it } from "vitest";

import {
  isMaintenanceBypassed,
  maintenanceHtml,
  parseMaintenanceRows,
  wantsHtml,
} from "@/lib/maintenance";

describe("isMaintenanceBypassed", () => {
  it("always leaves the owner a way back in", () => {
    expect(isMaintenanceBypassed("/admin")).toBe(true);
    expect(isMaintenanceBypassed("/admin/settings")).toBe(true);
    expect(isMaintenanceBypassed("/login")).toBe(true);
  });

  it("leaves framework and API traffic alone", () => {
    expect(isMaintenanceBypassed("/api/analytics/config")).toBe(true);
    expect(isMaintenanceBypassed("/_next/static/chunk.js")).toBe(true);
  });

  it("leaves crawled files alone", () => {
    expect(isMaintenanceBypassed("/robots.txt")).toBe(true);
    expect(isMaintenanceBypassed("/sitemap.xml")).toBe(true);
    expect(isMaintenanceBypassed("/favicon.ico")).toBe(true);
  });

  it("gates the public pages", () => {
    expect(isMaintenanceBypassed("/")).toBe(false);
    expect(isMaintenanceBypassed("/contact")).toBe(false);
    expect(isMaintenanceBypassed("/articles/some-slug")).toBe(false);
    expect(isMaintenanceBypassed("/privacy-policy")).toBe(false);
  });
});

describe("wantsHtml", () => {
  it("uses sec-fetch-dest when present", () => {
    expect(wantsHtml("document", null)).toBe(true);
    expect(wantsHtml("empty", null)).toBe(false);
    expect(wantsHtml("image", "text/html")).toBe(false);
  });

  it("falls back to the Accept header", () => {
    expect(wantsHtml(null, "text/html,application/xhtml+xml")).toBe(true);
    expect(wantsHtml(null, "application/json")).toBe(false);
    expect(wantsHtml(null, null)).toBe(false);
  });
});

describe("parseMaintenanceRows", () => {
  const fallback = "FallbackBrand";

  it("stays up when no row is present", () => {
    expect(parseMaintenanceRows([], fallback)).toEqual({
      enabled: false,
      brandName: fallback,
    });
  });

  it("enables only for an explicit true", () => {
    expect(
      parseMaintenanceRows([{ key: "maintenance_mode", value: true }], fallback)
        .enabled,
    ).toBe(true);
    expect(
      parseMaintenanceRows(
        [{ key: "maintenance_mode", value: "true" }],
        fallback,
      ).enabled,
    ).toBe(true);
  });

  it("fails closed on a malformed value", () => {
    for (const value of [false, "false", "yes", null, 0, {}]) {
      expect(
        parseMaintenanceRows([{ key: "maintenance_mode", value }], fallback)
          .enabled,
      ).toBe(false);
    }
  });

  it("uses the brand name override when present and non-blank", () => {
    expect(
      parseMaintenanceRows(
        [
          { key: "brand_name", value: "Acme" },
          { key: "maintenance_mode", value: true },
        ],
        fallback,
      ),
    ).toEqual({ enabled: true, brandName: "Acme" });

    expect(
      parseMaintenanceRows([{ key: "brand_name", value: "   " }], fallback)
        .brandName,
    ).toBe(fallback);
  });
});

describe("maintenanceHtml", () => {
  it("escapes the brand name so the page cannot be injected into", () => {
    const html = maintenanceHtml('<script>alert("x")</script>');
    expect(html).not.toContain("<script>alert");
    expect(html).toContain("&lt;script&gt;");
  });

  it("is a complete HTML document", () => {
    expect(maintenanceHtml("Acme")).toMatch(/^<!doctype html>/i);
    expect(maintenanceHtml("Acme")).toContain("Acme is temporarily unavailable");
  });
});
