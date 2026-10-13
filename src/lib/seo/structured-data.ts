import { absoluteUrl, siteConfig } from "@/lib/site";

/**
 * JSON-LD structured-data builders.
 *
 * These produce schema.org objects that are serialised into a <script
 * type="application/ld+json"> tag by the pages that use them. Keeping them in
 * one module means the shape is testable and consistent, and that the escaping
 * rule (below) is applied in exactly one place.
 *
 * ESCAPING
 * --------
 * JSON is embedded into HTML. A literal `<` in a string value would let an
 * attacker close the <script> element early and inject markup. Every consumer
 * serialises with `serializeJsonLd`, which escapes `<`, `>` and `&` as their
 * unicode escapes so the tag can never be broken out of.
 */

export interface JsonLdNode {
  "@context"?: string;
  "@type": string;
  [key: string]: unknown;
}

/**
 * Serialises a JSON-LD object for safe embedding in HTML.
 *
 * `<`, `>` and `&` are escaped to `\u003c`, `\u003e` and `\u0026`. These are
 * valid inside a JSON string and render as the original characters to a JSON
 * parser, but are inert to an HTML tokeniser.
 */
export function serializeJsonLd(data: unknown): string {
  return JSON.stringify(data)
    .replace(/</g, "\\u003c")
    .replace(/>/g, "\\u003e")
    .replace(/&/g, "\\u0026");
}

/**
 * Organization node for the publisher. Shared by the site-level graph and by
 * individual articles so the publisher identity is identical everywhere.
 */
export function organizationNode(): JsonLdNode {
  return {
    "@type": "Organization",
    "@id": `${siteConfig.url}/#organization`,
    name: siteConfig.name,
    url: siteConfig.url,
    description: siteConfig.description,
    email: siteConfig.contactEmail,
    // Google recommends a logo for the Organization entity. The dimensions are
    // the real ones of the shipped asset (public/logo.png, 64x64).
    logo: {
      "@type": "ImageObject",
      url: absoluteUrl("/logo.png"),
      width: 64,
      height: 64,
    },
  };
}

/**
 * WebSite node, including the site-search action so search engines can surface
 * a sitelinks search box. The search URL points at the articles index, which is
 * the only indexable search surface.
 */
export function webSiteNode(): JsonLdNode {
  return {
    "@type": "WebSite",
    "@id": `${siteConfig.url}/#website`,
    url: siteConfig.url,
    name: siteConfig.name,
    description: siteConfig.description,
    publisher: { "@id": `${siteConfig.url}/#organization` },
    inLanguage: "en",
    potentialAction: {
      "@type": "SearchAction",
      target: {
        "@type": "EntryPoint",
        urlTemplate: `${absoluteUrl("/articles")}?q={search_term_string}`,
      },
      "query-input": "required name=search_term_string",
    },
  };
}

/**
 * The site-level graph, referenced from the root layout. Combining both nodes
 * under one @graph lets an article page extend the same publisher/website
 * entities by @id rather than repeating them.
 */
export function siteGraph(): { "@context": string; "@graph": JsonLdNode[] } {
  return {
    "@context": "https://schema.org",
    "@graph": [organizationNode(), webSiteNode()],
  };
}

/** Breadcrumb trail input. */
export interface BreadcrumbStep {
  name: string;
  /** Absolute or root-relative path. */
  path: string;
}

/**
 * BreadcrumbList node. `item` URLs are absolute; the current (last) step omits
 * `item`, which is the recommended form for the page you are already on.
 *
 * The `@context` is required: this node is serialised into its own
 * `<script type="application/ld+json">` block, separate from the site graph.
 * Without it, a JSON-LD processor resolves `BreadcrumbList`/`ListItem` against
 * the document URL instead of schema.org, producing invalid types.
 */
export function breadcrumbNode(steps: BreadcrumbStep[]): JsonLdNode {
  return {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: steps.map((step, index) => {
      const isLast = index === steps.length - 1;
      return {
        "@type": "ListItem",
        position: index + 1,
        name: step.name,
        ...(isLast ? {} : { item: absoluteUrl(step.path) }),
      };
    }),
  };
}
