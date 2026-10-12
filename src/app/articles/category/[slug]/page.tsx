import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";

import { ArticleCard } from "@/components/articles/article-card";
import { getArticlesByCategory } from "@/lib/content/articles";
import { getPublicMediaMap } from "@/lib/media/urls";
import { siteConfig } from "@/lib/site";

/**
 * Per-category metadata. `generateMetadata` is used instead of a static
 * `metadata` export because the title and description depend on the category.
 */
export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const { category } = await getArticlesByCategory(slug);

  if (!category) {
    return { title: "Category not found", robots: { index: false, follow: false } };
  }

  return {
    title: category.name,
    description:
      category.description ||
      `All ${siteConfig.name} articles filed under ${category.name}.`,
    alternates: { canonical: `/articles/category/${category.slug}` },
  };
}

/**
 * Category pages resolve the category OUTSIDE any Suspense boundary, so
 * `notFound()` can still set a real 404 status before streaming begins.
 */
/**
 * Category pages are server-rendered on demand so that `notFound()` can set a
 * real 404 status before any streaming begins. See the note on the article
 * route for the full reasoning.
 */
export default async function CategoryPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;

  const { category, articles } = await getArticlesByCategory(slug);

  if (!category) notFound();

  const mediaMap = await getPublicMediaMap(
    articles.map((article) => article.featured_image_id),
  );

  return (
    <div className="container-page py-10">
      <nav aria-label="Breadcrumb" className="mb-6">
        <ol className="flex flex-wrap items-center gap-2 text-sm text-muted-foreground">
          <li>
            <Link href="/" className="hover:text-foreground">
              Home
            </Link>
          </li>
          <li aria-hidden="true">/</li>
          <li>
            <Link href="/articles" className="hover:text-foreground">
              Articles
            </Link>
          </li>
        </ol>
      </nav>

      <h1 className="text-3xl font-bold tracking-tight sm:text-4xl">
        {category.name}
      </h1>
      {category.description ? (
        <p className="mt-3 max-w-2xl text-lg text-muted-foreground">
          {category.description}
        </p>
      ) : null}

      {articles.length === 0 ? (
        <p className="mt-10 rounded-[var(--radius-card)] border border-dashed border-border bg-secondary/40 p-8 text-center text-sm text-muted-foreground">
          No published articles in this category yet.
        </p>
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
    </div>
  );
}