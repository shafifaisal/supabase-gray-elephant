import { describe, expect, it } from "vitest";

import { slugify, slugifyTitle } from "@/lib/format";
import { absoluteUrl, siteConfig } from "@/lib/site";

describe("slugify", () => {
  it("lowercases and hyphenates", () => {
    expect(slugify("Password Strength Guide")).toBe("password-strength-guide");
  });

  it("strips punctuation", () => {
    expect(slugify("What's New: 2026!")).toBe("whats-new-2026");
  });

  it("collapses repeated separators", () => {
    expect(slugify("a   b__c")).toBe("a-b-c");
  });

  it("trims leading and trailing hyphens", () => {
    expect(slugify("  --hello--  ")).toBe("hello");
  });

  it("handles accents", () => {
    expect(slugify("Café Déjà Vu")).toBe("cafe-deja-vu");
  });

  it("returns an empty string for symbol-only input", () => {
    expect(slugify("!!!")).toBe("");
  });
});

describe("slugifyTitle", () => {
  it("removes stop words", () => {
    expect(slugifyTitle("Choose the Best Password for You")).toBe(
      "choose-best-password",
    );
  });

  it("removes conjunctions and symbols", () => {
    expect(slugifyTitle("Passwords and Passphrases & You")).toBe(
      "passwords-passphrases",
    );
  });

  it("does not strip stop words inside longer words", () => {
    expect(slugifyTitle("Candy and Brand")).toBe("candy-brand");
  });

  it("falls back to the plain slug when every token is a stop word", () => {
    expect(slugifyTitle("The And Or")).toBe("the-and-or");
  });
});

describe("absoluteUrl", () => {
  it("prefixes the site origin", () => {
    expect(absoluteUrl("/guides")).toBe(`${siteConfig.url}/guides`);
  });

  it("normalises a missing leading slash", () => {
    expect(absoluteUrl("guides")).toBe(`${siteConfig.url}/guides`);
  });

  it("never produces a double slash", () => {
    expect(absoluteUrl("/").endsWith("/")).toBe(true);
    expect(siteConfig.url.endsWith("/")).toBe(false);
  });
});

describe("siteConfig", () => {
  it("has no trailing slash on the url", () => {
    expect(siteConfig.url).not.toMatch(/\/$/);
  });

  it("has a non-empty brand name and description", () => {
    expect(siteConfig.name.length).toBeGreaterThan(0);
    expect(siteConfig.description.length).toBeGreaterThan(20);
  });
});