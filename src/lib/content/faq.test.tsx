import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import { faqItems } from "@/lib/content/faq";
import { toolPath, tools } from "@/lib/tools";

/**
 * Content contract for the homepage FAQ (AGENTS.md §6, and the brief's
 * acceptance criteria 2 and 9):
 *   - 18 questions, each with a unique, DOM-safe id and a non-empty answer;
 *   - every answer renders without throwing;
 *   - every internal link points at a route that actually exists, with
 *     meaningful anchor text — no invented destinations, no "#" placeholders.
 */

/** Routes that exist in this app, used to detect dead internal links. */
const KNOWN_ROUTES: ReadonlySet<string> = new Set([
  "/",
  "/about",
  "/articles",
  "/contact",
  "/cookie-policy",
  "/privacy-policy",
  "/terms",
  "/tools",
  ...tools.map((tool) => toolPath(tool.slug)),
]);

const HREF_PATTERN = /href="([^"]+)"/g;

describe("faq content", () => {
  it("contains 18 questions", () => {
    expect(faqItems).toHaveLength(18);
  });

  it("gives every item a unique, DOM-safe id and a non-empty question", () => {
    const ids = faqItems.map((item) => item.id);

    expect(new Set(ids).size).toBe(ids.length);
    for (const item of faqItems) {
      expect(item.id).toMatch(/^[a-z0-9]+(-[a-z0-9]+)*$/);
      expect(item.question.trim().length).toBeGreaterThan(0);
    }
  });

  it("renders every answer to HTML without throwing", () => {
    for (const item of faqItems) {
      const html = renderToStaticMarkup(<>{item.answer}</>);
      expect(html.length).toBeGreaterThan(0);
      expect(html.replace(/<[^>]*>/g, "").trim().length).toBeGreaterThan(40);
    }
  });

  it("links only to routes that exist, with meaningful anchor text", () => {
    for (const item of faqItems) {
      const html = renderToStaticMarkup(<>{item.answer}</>);
      const hrefs = [...html.matchAll(HREF_PATTERN)].map((match) => match[1]);

      for (const href of hrefs) {
        expect(href.startsWith("/")).toBe(true);
        expect(KNOWN_ROUTES.has(href)).toBe(true);
        expect(href).not.toBe("#");
      }
    }
  });
});