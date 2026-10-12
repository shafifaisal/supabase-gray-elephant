import { describe, expect, it } from "vitest";

import { articleImageAlt, logoAlt } from "@/lib/seo/alt-text";
import { siteConfig } from "@/lib/site";

describe("logoAlt", () => {
  it("identifies the brand and its purpose", () => {
    expect(logoAlt()).toBe(
      `${siteConfig.name} — privacy-first password security tools`,
    );
  });

  it("uses an explicit brand name when provided", () => {
    expect(logoAlt("Acme")).toBe(
      "Acme — privacy-first password security tools",
    );
  });
});

describe("articleImageAlt", () => {
  it("prefers the editor-provided description", () => {
    expect(
      articleImageAlt({ title: "How entropy works", alt: "Dice rolling" }),
    ).toBe("Dice rolling");
  });

  it("trims the editor-provided description", () => {
    expect(
      articleImageAlt({ title: "How entropy works", alt: "  Dice  " }),
    ).toBe("Dice");
  });

  it("falls back to the article title when no description is set", () => {
    expect(articleImageAlt({ title: "How entropy works" })).toBe(
      "How entropy works",
    );
  });

  it("falls back to the title when the description is blank", () => {
    expect(articleImageAlt({ title: "How entropy works", alt: "   " })).toBe(
      "How entropy works",
    );
  });
});
