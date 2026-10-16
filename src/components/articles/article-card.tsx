import Link from "next/link";

import { ArticleThumbnail } from "@/components/articles/article-thumbnail";
import type { ArticleRow } from "@/lib/content/articles";
import { formatDate } from "@/lib/format";
import type { PublicMedia } from "@/lib/media/urls";

/**
 * A published-article card with a 16:9 thumbnail.
 *
 * The whole card links to the article via a "stretched link" on the title
 * (the title's `after:` pseudo-element covers the card), so clicking the image
 * or the title both open the article without nesting links.
 *
 * `headingLevel` exists because the card is used in two different outlines:
 * under an `<h2>` section heading on the homepage ("Latest articles"), where a
 * hardcoded `<h2>` made six cards siblings of their own section heading, and
 * directly under an `<h1>` on /articles and the category pages, where `<h2>` is
 * correct. The default keeps those pages unchanged; the homepage passes "h3".
 */
export function ArticleCard({
  article,
  image,
  priority = false,
  headingLevel = "h2",
}: {
  article: Pick<ArticleRow, "slug" | "title" | "excerpt" | "published_at">;
  image: PublicMedia | null;
  priority?: boolean;
  headingLevel?: "h2" | "h3";
}) {
  const Heading = headingLevel;

  return (
    <article className="group relative flex h-full flex-col overflow-hidden rounded-[var(--radius-card)] border border-border bg-background transition-colors hover:border-primary/50">
      <ArticleThumbnail image={image} title={article.title} priority={priority} />
      <div className="flex flex-1 flex-col p-5">
        <Heading className="text-lg font-semibold">
          <Link
            href={`/articles/${article.slug}`}
            className="rounded hover:text-primary after:absolute after:inset-0"
          >
            {article.title}
          </Link>
        </Heading>
        {article.excerpt ? (
          <p className="mt-2 flex-1 text-sm text-muted-foreground">
            {article.excerpt}
          </p>
        ) : (
          <div className="flex-1" />
        )}
        {article.published_at ? (
          <p className="mt-3 text-xs text-muted-foreground">
            Published {formatDate(new Date(article.published_at))}
          </p>
        ) : null}
      </div>
    </article>
  );
}
