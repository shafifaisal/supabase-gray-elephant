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
import { ArticleThumbnail } from "@/components/articles/article-thumbnail";
import { JsonLd } from "@/components/seo/json-ld";
import { breadcrumbNode } from "@/lib/seo/structured-data";
import { getPublicMediaMap, type PublicMedia } from "@/lib/media/urls";
import { absoluteUrl, siteConfig } from "@/lib/site";
import { formatDate } from "@/lib/format";

/** Resolves an article's public featured image, if it has one. */
async function resolveFeaturedImage(
  article: Pick<ArticleRow, "featured_image_id">,
): Promise<PublicMedia | null> {
  if (!article.featured_image_id) return null;
  const map = await getPublicMediaMap([article.featured_image_id]);
  return map.get(article.featured_image_id) ?? null;
}

/**
 * Resolves the effective title, description and canonical URL for an article,
 * falling back to sensible values when the editor left them blank.
 */
function resolveMetadata(article: ArticleRow) {
  const seoTitle = article.seo_title || article.title;
  const description =
    article.meta_description ||
    article.excerpt ||
    `${article.title} — a practical article from ${siteConfig.name}.`;
  const url = absoluteUrl(`/articles/${article.slug}`);

  return { seoTitle, description, url };
}

/**
 * JSON-LD for an article.
 *
 * Returns the object; escaping is applied centrally by `<JsonLd>` when it is
 * serialised, so the rule lives in exactly one place.
 */
function articleStructuredData(params: {
  seoTitle: string;
  description: string;
  url: string;
  article: ArticleRow;
  image: PublicMedia | null;
}) {
  const { seoTitle, description, url, article, image } = params;

  return {
    "@context": "https://schema.org",
    "@type": "Article",
    headline: seoTitle,
    description,
    url,
    image: image ? [image.url] : undefined,
    datePublished: article.published_at ?? undefined,
    dateModified: article.updated_at,
    mainEntityOfPage: { "@type": "WebPage", "@id": url },
    publisher: {
      "@type": "Organization",
      name: siteConfig.name,
      url: siteConfig.url,
    },
  };
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
      title: "Article not found",
      robots: { index: false, follow: false },
    };
  }

  const { seoTitle, description, url } = resolveMetadata(article);
  const image = await resolveFeaturedImage(article);

  const ogImage = image
    ? [
        {
          url: image.url,
          width: image.width ?? undefined,
          height: image.height ?? undefined,
          alt: image.alt?.trim() || seoTitle,
        },
      ]
    : undefined;

  return {
    title: seoTitle,
    description,
    alternates: {
      canonical: article.canonical_url || `/articles/${article.slug}`,
    },
    openGraph: {
      type: "article",
      title: article.og_title || seoTitle,
      description: article.og_description || description,
      url,
      publishedTime: article.published_at ?? undefined,
      modifiedTime: article.updated_at,
      images: ogImage,
    },
    twitter: {
      card: "summary_large_image",
      title: article.og_title || seoTitle,
      description: article.og_description || description,
      images: image ? [image.url] : undefined,
    },
  };
}

/**
 * Article pages are server-rendered on demand with a short revalidation window.
 *
 * Correct HTTP status codes take priority over static output: the article must
 * be resolved BEFORE anything streams, otherwise `notFound()` cannot set a 404
 * and a draft URL would be served to crawlers as a successful page.
 *
 * `generateStaticParams` is deliberately absent — a CMS cannot enumerate its
 * published slugs at build time, and Next's `cacheComponents` mode requires it
 * to return at least one entry.
 *
 * Publishing calls `revalidatePath`, so a newly published article is visible
 * immediately. RLS guarantees a draft can never render, even if guessed.
 */
export default async function ArticlePage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;

  /*
   * The article lookup happens before any output, so `notFound()` can commit a
   * real 404 status. Only secondary content (related articles) streams.
   */
  const article = await getPublishedArticleBySlug(slug);

  if (!article) notFound();

  const { seoTitle, description, url } = resolveMetadata(article);
  const image = await resolveFeaturedImage(article);

  const breadcrumb = breadcrumbNode([
    { name: "Home", path: "/" },
    { name: "Articles", path: "/articles" },
    { name: article.title, path: `/articles/${article.slug}` },
  ]);

  return (
    <article className="container-page py-10">
      {/* Article structured data. Only fields we can genuinely evidence are
          included — no invented ratings, reviews or authorship claims.
          "<" is escaped so the payload cannot terminate the script element. */}
      <JsonLd
        data={articleStructuredData({ seoTitle, description, url, article, image })}
      />
      {/* Breadcrumb structured data, matching the visible breadcrumb below. */}
      <JsonLd data={breadcrumb} />

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

      <div className="max-w-3xl">
        {image ? (
          <ArticleThumbnail
            image={image}
            title={article.title}
            priority
            sizes="(min-width: 768px) 48rem, 100vw"
            className="mt-6 rounded-[var(--radius-card)] border border-border"
          />
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

async function getRelatedWithImages(article: ArticleRow) {
  const related = await getRelatedArticles(article);
  const map = await getPublicMediaMap(
    related.map((item) => item.featured_image_id),
  );
  return { related, map };
}

function RelatedArticles({ article }: { article: ArticleRow }) {
  const { related, map } = use(getRelatedWithImages(article));

  if (related.length === 0) return null;

  return (
    <section className="mt-10">
      <h2 className="text-lg font-semibold">Related reading</h2>
      <ul className="mt-4 grid gap-4 sm:grid-cols-2">
        {related.map((item) => (
          <li key={item.id}>
            <Link
              href={`/articles/${item.slug}`}
              className="group flex items-center gap-3 rounded-lg border border-border p-3 transition-colors hover:bg-secondary/60"
            >
              <ArticleThumbnail
                image={item.featured_image_id ? map.get(item.featured_image_id) ?? null : null}
                title={item.title}
                sizes="8rem"
                className="w-32 shrink-0 rounded-md border border-border"
              />
              <span className="text-sm font-medium group-hover:text-primary">
                {item.title}
              </span>
            </Link>
          </li>
        ))}
      </ul>
    </section>
  );
}