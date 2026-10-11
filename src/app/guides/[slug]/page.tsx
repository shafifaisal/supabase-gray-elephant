import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Suspense, use } from "react";

import {
  getPublishedArticleBySlug,
  getRelatedArticles,
  type ArticleRow,
} from "@/lib/content/articles";
import { sanitizeForRender } from "@/lib/content/markdown";
import { absoluteUrl, siteConfig } from "@/lib/site";
import { formatDate } from "@/lib/format";

/**
 * Resolves the effective title, description and canonical URL for an article,
 * falling back to sensible values when the editor left them blank.
 */
function resolveMetadata(article: ArticleRow) {
  const seoTitle = article.seo_title || article.title;
  const description =
    article.meta_description ||
    article.excerpt ||
    `${article.title} — a practical guide from ${siteConfig.name}.`;
  const url = absoluteUrl(`/guides/${article.slug}`);

  return { seoTitle, description, url };
}

/** JSON-LD for an article. `"<"` is escaped so it cannot break out. */
function structuredData(params: {
  seoTitle: string;
  description: string;
  url: string;
  article: ArticleRow;
}) {
  const { seoTitle, description, url, article } = params;

  return JSON.stringify({
    "@context": "https://schema.org",
    "@type": "Article",
    headline: seoTitle,
    description,
    url,
    datePublished: article.published_at ?? undefined,
    dateModified: article.updated_at,
    mainEntityOfPage: { "@type": "WebPage", "@id": url },
    publisher: {
      "@type": "Organization",
      name: siteConfig.name,
      url: siteConfig.url,
    },
  }).replace(/</g, "\\u003c");
}

/**
 * Per-article metadata.
 *
 * Exported separately from the page so crawlers receive correct titles,
 * canonicals and Open Graph tags for every article. A draft or unknown slug
 * yields no indexable metadata.
 */
export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const article = await getPublishedArticleBySlug(slug);

  if (!article) {
    return {
      title: "Guide not found",
      robots: { index: false, follow: false },
    };
  }

  const { seoTitle, description, url } = resolveMetadata(article);

  return {
    title: seoTitle,
    description,
    alternates: {
      canonical: article.canonical_url || `/guides/${article.slug}`,
    },
    openGraph: {
      type: "article",
      title: article.og_title || seoTitle,
      description: article.og_description || description,
      url,
      publishedTime: article.published_at ?? undefined,
      modifiedTime: article.updated_at,
    },
    twitter: {
      card: "summary_large_image",
      title: article.og_title || seoTitle,
      description: article.og_description || description,
    },
  };
}

/**
 * Article pages are not enumerated at build time.
 *
 * This is a CMS, so the published set changes whenever an editor publishes.
 * Next's `cacheComponents` mode requires `generateStaticParams` to return at
 * least one entry, which cannot be guaranteed on a fresh install — so the route
 * is a static shell with the article streamed through a Suspense boundary.
 *
 * Queries are wrapped in `"use cache"`, so repeats are served from cache, and
 * publishing triggers `revalidatePath`. RLS guarantees a draft can never
 * render, even if its slug is guessed.
 */
/**
 * Article pages are server-rendered on demand rather than prerendered.
 *
 * This is a deliberate trade-off. Correct HTTP status codes matter more than
 * static output here: an article page must be able to call `notFound()` BEFORE
 * streaming starts, otherwise Next has already committed a 200 and a draft URL
 * is served to crawlers as a successful page. `instant = false` is the
 * documented Next 16 option for a route that must read `params` and resolve its
 * data before rendering.
 *
 * The underlying queries are `"use cache"`d, so repeat requests are served
 * from cache rather than hitting Postgres each time, and publishing calls
 * `revalidatePath` to refresh them immediately.
 *
 * RLS guarantees a draft can never render, even if its slug is guessed.
 */
export const instant = false;

export default async function GuidePage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;

  /*
   * The article lookup happens OUTSIDE the Suspense boundary, and the query is
   * `"use cache"`d so it still prerenders statically.
   *
   * This ordering matters for correctness: `notFound()` must run before any
   * streaming has begun, otherwise Next has already committed a 200 status and
   * a draft URL would be served to crawlers as a successful page. Resolving the
   * article first guarantees a genuine 404 for both unknown and unpublished
   * slugs.
   */
  const article = await getPublishedArticleBySlug(slug);

  if (!article) notFound();

  const { seoTitle, description, url } = resolveMetadata(article);

  return (
    <article className="container-page py-10">
      {/* Article structured data. Only fields we can genuinely evidence are
          included — no invented ratings, reviews or authorship claims.
          "<" is escaped so the payload cannot terminate the script element. */}
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: structuredData({ seoTitle, description, url, article }) }}
      />

      <nav aria-label="Breadcrumb" className="mb-6">
        <ol className="flex flex-wrap items-center gap-2 text-sm text-muted-foreground">
          <li>
            <Link href="/" className="hover:text-foreground">
              Home
            </Link>
          </li>
          <li aria-hidden="true">/</li>
          <li>
            <Link href="/guides" className="hover:text-foreground">
              Guides
            </Link>
          </li>
        </ol>
      </nav>

      <div className="max-w-3xl">
        <h1 className="text-3xl font-bold tracking-tight text-balance sm:text-4xl">
          {article.title}
        </h1>

        {article.published_at ? (
          <p className="mt-3 text-sm text-muted-foreground">
            Published{" "}
            <time dateTime={article.published_at}>
              {formatDate(new Date(article.published_at))}
            </time>
            {" · "}Updated{" "}
            <time dateTime={article.updated_at}>
              {formatDate(new Date(article.updated_at))}
            </time>
          </p>
        ) : null}

        {article.excerpt ? (
          <p className="mt-4 text-lg text-muted-foreground">{article.excerpt}</p>
        ) : null}

        {/*
          The body is sanitised AGAIN here, on read.

          Content is sanitised when it is written, but a row could have been
          inserted by a migration, a seed, or an older buggy code path. The
          editor's live preview fetches `/api/preview` for sanitised output and
          writes that HTML to the database — but historic rows created before
          that endpoint existed may hold unsanitised HTML. Sanitising on render
          is defence in depth and costs nothing at these sizes.
        */}
        <div
          className="prose-guides mt-8 text-foreground"
          dangerouslySetInnerHTML={{ __html: sanitizeForRender(article.body_html) }}
        />

        <div className="mt-10 rounded-[var(--radius-card)] border border-border bg-secondary/40 p-5">
          <p className="text-sm text-muted-foreground">
            <strong className="text-foreground">
              Never type a real password into a web page.
            </strong>{" "}
            That includes this one. Our tools analyse and generate passwords
            entirely in your browser and never transmit them — see the{" "}
            <Link href="/about" className="underline underline-offset-2">
              about page
            </Link>{" "}
            for how that is implemented.
          </p>
        </div>

        {/* Related articles are secondary; stream them so the main content
            above is never blocked by them. */}
        <Suspense fallback={null}>
          <RelatedArticles article={article} />
        </Suspense>
      </div>
    </article>
  );
}

function RelatedArticles({ article }: { article: ArticleRow }) {
  const related = use(getRelatedArticles(article));

  if (related.length === 0) return null;

  return (
    <section className="mt-10">
      <h2 className="text-lg font-semibold">Related reading</h2>
      <ul className="mt-4 space-y-2">
        {related.map((item) => (
          <li key={item.id}>
            <Link
              href={`/guides/${item.slug}`}
              className="text-sm text-primary underline underline-offset-2"
            >
              {item.title}
            </Link>
          </li>
        ))}
      </ul>
    </section>
  );
}