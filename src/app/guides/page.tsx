import type { Metadata } from "next";
import Link from "next/link";

import { AdSlot } from "@/components/ads/ad-slot";
import { getCategories, getPublishedArticles } from "@/lib/content/articles";
import { getAdsConfig } from "@/lib/ads/server";
import { formatDate } from "@/lib/format";

export const metadata: Metadata = {
  title: "Guides",
  description:
    "Practical, original guides on password strength, passphrases, password managers, multi-factor authentication and recovering compromised accounts.",
  alternates: { canonical: "/guides" },
};

export default async function GuidesPage() {
  const [articles, categories, ads] = await Promise.all([
    getPublishedArticles(),
    getCategories(),
    getAdsConfig(),
  ]);

  return (
    <div className="container-page py-10">
      <div className="max-w-3xl">
        <h1 className="text-3xl font-bold tracking-tight sm:text-4xl">Guides</h1>
        <p className="mt-3 text-lg text-muted-foreground">
          Practical writing on password security. Every article is original,
          reviewed before publication, and written to be useful rather than
          merely long.
        </p>
      </div>

      {categories.length > 0 ? (
        <nav aria-label="Guide categories" className="mt-8">
          <ul className="flex flex-wrap gap-2">
            {categories.map((category) => (
              <li key={category.id}>
                <Link
                  href={`/guides/category/${category.slug}`}
                  className="inline-block rounded-full border border-border bg-background px-4 py-2 text-sm font-medium transition-colors hover:bg-secondary"
                >
                  {category.name}
                </Link>
              </li>
            ))}
          </ul>
        </nav>
      ) : null}

      {articles.length === 0 ? (
        <div className="mt-10 rounded-[var(--radius-card)] border border-dashed border-border bg-secondary/40 p-10 text-center">
          <h2 className="text-lg font-semibold">Guides are being written</h2>
          <p className="mx-auto mt-2 max-w-md text-sm text-muted-foreground">
            Articles appear here once an editor has reviewed and published them.
            In the meantime, the tools above are ready to use.
          </p>
        </div>
      ) : (
        <ul className="mt-10 grid gap-6 sm:grid-cols-2">
          {articles.map((article) => (
            <li key={article.id}>
              <article className="h-full rounded-[var(--radius-card)] border border-border bg-background p-5">
                <h2 className="text-lg font-semibold">
                  <Link
                    href={`/guides/${article.slug}`}
                    className="rounded hover:text-primary"
                  >
                    {article.title}
                  </Link>
                </h2>
                {article.excerpt ? (
                  <p className="mt-2 text-sm text-muted-foreground">
                    {article.excerpt}
                  </p>
                ) : null}
                {article.published_at ? (
                  <p className="mt-3 text-xs text-muted-foreground">
                    Published {formatDate(new Date(article.published_at))}
                  </p>
                ) : null}
              </article>
            </li>
          ))}
        </ul>
      )}

      {/*
        A single, clearly-labelled ad unit, placed AFTER the content and kept
        visually separate from the guides and from any site controls. It renders
        nothing unless ads are configured AND the visitor has consented (see
        AdSlot). AdSense is never placed on a tool page.
      */}
      <AdSlot
        ready={ads.ready}
        publisherId={ads.publisherId}
        slot={process.env.NEXT_PUBLIC_ADSENSE_SLOT_GUIDES ?? "0000000001"}
        format="auto"
        className="mt-12"
      />
    </div>
  );
}