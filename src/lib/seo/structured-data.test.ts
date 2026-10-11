import { describe, expect, it } from "vitest";

import {
  breadcrumbNode,
  organizationNode,
  serializeJsonLd,
  siteGraph,
  webSiteNode,
} from "@/lib/seo/structured-data";
import { siteConfig } from "@/lib/site";

describe("serializeJsonLd — XSS boundary", () => {
  it("escapes angle brackets so a script tag cannot break out", () => {
    const out = serializeJsonLd({ "@type": "Thing", name: "</script><script>alert(1)</script>" });
    expect(out).not.toContain("</script>");
    expect(out).not.toContain("<script");
    expect(out).toContain("\\u003c");
    expect(out).toContain("\\u003e");
  });

  it("escapes ampersands", () => {
    const out = serializeJsonLd({ name: "Tom & Jerry" });
    expect(out).toContain("\\u0026");
    expect(out).not.toMatch(/&(?!u0026)/);
  });

  it("produces valid JSON that parses back to the original value", () => {
    const data = { "@type": "Organization", name: "A & B <tag>" };
    const parsed = JSON.parse(serializeJsonLd(data));
    expect(parsed.name).toBe("A & B <tag>");
  });
});

describe("organizationNode", () => {
  it("has a stable @id, type and publisher identity", () => {
    const node = organizationNode();
    expect(node["@type"]).toBe("Organization");
    expect(node["@id"]).toBe(`${siteConfig.url}/#organization`);
    expect(node.name).toBe(siteConfig.name);
    expect(node.url).toBe(siteConfig.url);
  });
});

describe("webSiteNode", () => {
  it("references the organization by @id and declares a search action", () => {
    const node = webSiteNode();
    expect(node["@type"]).toBe("WebSite");
    expect(node.publisher).toEqual({ "@id": `${siteConfig.url}/#organization` });
    const action = node.potentialAction as { "@type": string };
    expect(action["@type"]).toBe("SearchAction");
  });
});

describe("siteGraph", () => {
  it("wraps organization and website under a single @graph", () => {
    const graph = siteGraph();
    expect(graph["@context"]).toBe("https://schema.org");
    const types = graph["@graph"].map((n) => n["@type"]);
    expect(types).toEqual(["Organization", "WebSite"]);
  });
});

describe("breadcrumbNode", () => {
  it("numbers positions and omits item on the final step", () => {
    const node = breadcrumbNode([
      { name: "Home", path: "/" },
      { name: "Guides", path: "/guides" },
      { name: "Current", path: "/guides/current" },
    ]);

    expect(node["@type"]).toBe("BreadcrumbList");
    const items = node.itemListElement as { position: number; name: string; item?: string }[];
    expect(items.map((i) => i.position)).toEqual([1, 2, 3]);
    expect(items[1].item).toContain("/guides");
    // The current page must not carry an `item` URL.
    expect(items[2].item).toBeUndefined();
  });

  it("makes non-final item URLs absolute", () => {
    const node = breadcrumbNode([
      { name: "Home", path: "/" },
      { name: "Guides", path: "/guides" },
    ]);
    const items = node.itemListElement as { item: string }[];
    expect(items[0].item.startsWith("http")).toBe(true);
  });
});
