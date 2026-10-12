import type { Metadata } from "next";
import Link from "next/link";

import { AdSlot } from "@/components/ads/ad-slot";
import { ArticleCard } from "@/components/articles/article-card";
import {
  getPublicCategories,
  getPublishedArticles,
  searchPublishedArticles,
} from "@/lib/content/articles";
import { getPublicMediaMap } from "@/lib/media/urls";
import { getAdsConfig } from "@/lib/ads/server";

export const metadata: Metadata = {
  title: "Articles",
  description:
    "Practical, original articles on password strength, passphrases, password managers, multi-factor authentication and recovering compromised accounts.",
  alternates: { canonical: "/articles" },
};

export default async function ArticlesPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string }>;
}) {
  const { q } = await searchParams;
  const query = (q ?? "").trim();

  const [articles, categories, ads] = await Promise.all([
    query ? searchPublishedArticles(query) : getPublishedArticles(),
    getPublicCategories(),
    getAdsConfig(),
  ]);

  const mediaMap = await getPublicMediaMap(
    articles.map((article) => article.featured_image_id),
  );

  return (
    <div className="container-page py-10">
      <div className="max-w-3xl">
        <h1 className="text-3xl font-bold tracking-tight sm:text-4xl">Articles</h1>
        <p className="mt-3 text-lg text-muted-foreground">
          Practical writing on password security. Every article is original,
          reviewed before publication, and written to be useful rather than
          merely long.
        </p>
      </div>

      <form role="search" action="/articles" method="get" className="mt-8 flex max-w-md gap-2">
        <label htmlFor="article-search" className="sr-only">
          Search articles
        </label>
        <input
          id="article-search"
          name="q"
          type="search"
          defaultValue={query}
          placeholder="Search articles…"
          className="h-10 w-full rounded-md border border-border bg-background px-3 text-sm focus:border-primary focus:outline-none"
        />
        <button
          type="submit"
          className="h-10 rounded-md bg-primary px-4 text-sm font-semibold text-primary-foreground transition-opacity hover:opacity-90"
        >
          Search
        </button>
      </form>

      {categories.length > 0 ? (
        <nav aria-label="Article categories" className="mt-6">
          <ul className="flex flex-wrap gap-2">
            {categories.map((category) => (
              <li key={category.id}>
                <Link
                  href={`/articles/category/${category.slug}`}
                  className="inline-block rounded-full border border-border bg-background px-4 py-2 text-sm font-medium transition-colors hover:bg-secondary"
                >
                  {category.name}
                </Link>
              </li>
            ))}
          </ul>
        </nav>
      ) : null}

      {query ? (
        <p className="mt-8 text-sm text-muted-foreground" role="status">
          {articles.length === 0
            ? `No articles match “${query}”.`
            : `${articles.length} result${articles.length === 1 ? "" : "s"} for “${query}”.`}
        </p>
      ) : null}

      {articles.length === 0 ? (
        <div className="mt-10 rounded-[var(--radius-card)] border border-dashed border-border bg-secondary/40 p-10 text-center">
          <h2 className="text-lg font-semibold">
            {query ? "No matching articles" : "Articles are being written"}
          </h2>
          <p className="mx-auto mt-2 max-w-md text-sm text-muted-foreground">
            {query
              ? "Try a different search term, or browse every article below the categories."
              : "Articles appear here once an editor has reviewed and published them. In the meantime, the tools above are ready to use."}
          </p>
        </div>
      ) : (
        <ul className="mt-10 grid gap-6 sm:grid-cols-2">
          {articles.map((article) => (
            <li key={article.id}>
              <ArticleCard
                article={article}
                image={article.featured_image_id
                  ? mediaMap.get(article.featured_image_id) ?? null
                  : null}
              />
            </li>
          ))}
        </ul>
      )}

      {/*
        A single, clearly-labelled ad unit, placed AFTER the content and kept
        visually separate from the articles and from any site controls. It renders
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
