import type { MetadataRoute } from "next";

import { getPublishedSlugsLive } from "@/lib/content/articles";
import { tools } from "@/lib/tools";
import { absoluteUrl } from "@/lib/site";

/**
 * XML sitemap.
 *
 * Contains ONLY publicly indexable canonical URLs. Drafts, archived posts,
 * noindex articles, admin routes, login pages and tool-internal states are
 * excluded by design — the query filters on status, is_noindex and publication
 * date, and the RLS policy enforces the same rule.
 *
 * Slugs are read UNCACHED so a newly published article appears immediately
 * rather than waiting for a cache to expire. Search engines poll this file, so
 * correctness matters more than shaving one query.
 */

/** Static pages that are always worth indexing. */
const STATIC_PATHS: { path: string; priority: number; changeFrequency: "daily" | "weekly" | "monthly" }[] = [
  { path: "/", priority: 1.0, changeFrequency: "weekly" },
  { path: "/tools", priority: 0.9, changeFrequency: "weekly" },
  { path: "/guides", priority: 0.8, changeFrequency: "daily" },
  { path: "/about", priority: 0.5, changeFrequency: "monthly" },
  { path: "/contact", priority: 0.4, changeFrequency: "monthly" },
  { path: "/privacy-policy", priority: 0.3, changeFrequency: "monthly" },
  { path: "/terms", priority: 0.3, changeFrequency: "monthly" },
  { path: "/cookie-policy", priority: 0.3, changeFrequency: "monthly" },
];

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const slugs = await getPublishedSlugsLive().catch(() => []);

  const now = new Date();

  const staticEntries: MetadataRoute.Sitemap = STATIC_PATHS.map((entry) => ({
    url: absoluteUrl(entry.path),
    lastModified: now,
    changeFrequency: entry.changeFrequency,
    priority: entry.priority,
  }));

  const toolEntries: MetadataRoute.Sitemap = tools.map((tool) => ({
    url: absoluteUrl(`/${tool.slug}`),
    lastModified: now,
    changeFrequency: "weekly" as const,
    priority: 0.8,
  }));

  const guideEntries: MetadataRoute.Sitemap = slugs.map((slug) => ({
    url: absoluteUrl(`/guides/${slug}`),
    lastModified: now,
    changeFrequency: "monthly" as const,
    priority: 0.7,
  }));

  return [...staticEntries, ...toolEntries, ...guideEntries];
}