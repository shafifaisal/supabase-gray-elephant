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
 */
export function ArticleCard({
  article,
  image,
  priority = false,
}: {
  article: Pick<ArticleRow, "slug" | "title" | "excerpt" | "published_at">;
  image: PublicMedia | null;
  priority?: boolean;
}) {
  return (
    <article className="group relative flex h-full flex-col overflow-hidden rounded-[var(--radius-card)] border border-border bg-background transition-colors hover:border-primary/50">
      <ArticleThumbnail image={image} title={article.title} priority={priority} />
      <div className="flex flex-1 flex-col p-5">
        <h2 className="text-lg font-semibold">
          <Link
            href={`/articles/${article.slug}`}
            className="rounded hover:text-primary after:absolute after:inset-0"
          >
            {article.title}
          </Link>
        </h2>
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
