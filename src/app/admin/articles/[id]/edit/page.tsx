import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";

import { ArticleEditor } from "@/components/admin/article-editor";
import { roleAtLeast, requireRole } from "@/lib/auth/session";
import { getArticleForEdit, getCategories, getRevisions } from "@/lib/content/articles";
import { formatDateTime } from "@/lib/format";

import { changeStatusAction, deleteArticleAction, updateArticleAction } from "../../actions";

export const metadata: Metadata = {
  title: "Edit article",
  robots: { index: false, follow: false },
};

export default async function EditArticlePage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ created?: string; saved?: string; error?: string }>;
}) {
  const { id } = await params;
  const { created, saved, error } = await searchParams;

  const user = await requireRole("author");
  const article = await getArticleForEdit(id);

  // 404 rather than 403: an author who cannot see a draft should not learn
  // that it exists.
  if (!article) notFound();

  const categories = await getCategories();
  const revisions = await getRevisions(id);
  const canPublish = roleAtLeast(user.role, "editor");
  const canDelete = roleAtLeast(user.role, "admin");

  return (
    <div className="space-y-6">
      {created ? (
        <p
          role="status"
          className="rounded-md border border-success/40 bg-success/10 px-4 py-3 text-sm text-success"
        >
          Draft created. An editor must review and publish it.
        </p>
      ) : null}

      {saved ? (
        <p
          role="status"
          className="rounded-md border border-success/40 bg-success/10 px-4 py-3 text-sm text-success"
        >
          Status changed to <strong>{saved.replace("_", " ")}</strong>.
        </p>
      ) : null}

      {error ? (
        <p
          role="alert"
          className="rounded-md border border-danger/40 bg-danger/10 px-4 py-3 text-sm text-danger"
        >
          {error}
        </p>
      ) : null}

      <ArticleEditor
        action={updateArticleAction}
        canPublish={canPublish}
        status={article.status}
        categories={categories.map((c) => ({ id: c.id, name: c.name }))}
        values={{
          id: article.id,
          title: article.title,
          slug: article.slug,
          excerpt: article.excerpt ?? "",
          body_md: article.body_md,
          category_id: article.category_id ?? "",
          seo_title: article.seo_title ?? "",
          meta_description: article.meta_description ?? "",
          og_title: article.og_title ?? "",
          og_description: article.og_description ?? "",
          canonical_url: article.canonical_url ?? "",
          is_noindex: article.is_noindex,
          featured_image_id: article.featured_image_id ?? "",
        }}
      />

      {canPublish ? (
        <section className="rounded-[var(--radius-card)] border border-border bg-background p-5">
          <h2 className="text-sm font-semibold">Publishing</h2>
          <p className="mt-1 text-xs text-muted-foreground">
            Publishing, scheduling and archiving are editor actions. Every change
            is recorded in the audit log.
          </p>

          <div className="mt-4 flex flex-wrap gap-2">
            {article.status !== "published" ? (
              <form action={changeStatusAction}>
                <input type="hidden" name="articleId" value={article.id} />
                <input type="hidden" name="status" value="published" />
                <button
                  type="submit"
                  className="h-10 rounded-md bg-success px-4 text-sm font-semibold text-white"
                >
                  Publish now
                </button>
              </form>
            ) : (
              <form action={changeStatusAction}>
                <input type="hidden" name="articleId" value={article.id} />
                <input type="hidden" name="status" value="draft" />
                <button
                  type="submit"
                  className="h-10 rounded-md border border-border px-4 text-sm font-semibold hover:bg-secondary"
                >
                  Unpublish
                </button>
              </form>
            )}

            {article.status === "draft" ? (
              <form action={changeStatusAction}>
                <input type="hidden" name="articleId" value={article.id} />
                <input type="hidden" name="status" value="in_review" />
                <button
                  type="submit"
                  className="h-10 rounded-md border border-border px-4 text-sm font-semibold hover:bg-secondary"
                >
                  Send for review
                </button>
              </form>
            ) : null}

            {article.status !== "archived" ? (
              <form action={changeStatusAction}>
                <input type="hidden" name="articleId" value={article.id} />
                <input type="hidden" name="status" value="archived" />
                <button
                  type="submit"
                  className="h-10 rounded-md border border-border px-4 text-sm font-semibold hover:bg-secondary"
                >
                  Archive
                </button>
              </form>
            ) : (
              <form action={changeStatusAction}>
                <input type="hidden" name="articleId" value={article.id} />
                <input type="hidden" name="status" value="draft" />
                <button
                  type="submit"
                  className="h-10 rounded-md border border-border px-4 text-sm font-semibold hover:bg-secondary"
                >
                  Restore as draft
                </button>
              </form>
            )}
          </div>

          <form action={changeStatusAction} className="mt-5 flex flex-wrap items-end gap-3">
            <input type="hidden" name="articleId" value={article.id} />
            <input type="hidden" name="status" value="scheduled" />
            <div>
              <label
                htmlFor="scheduledFor"
                className="mb-1.5 block text-sm font-medium"
              >
                Schedule publication
              </label>
              <input
                id="scheduledFor"
                name="scheduledFor"
                type="datetime-local"
                className="rounded-md border border-border bg-background px-3 py-2 text-sm"
              />
            </div>
            <button
              type="submit"
              className="h-10 rounded-md border border-border px-4 text-sm font-semibold hover:bg-secondary"
            >
              Schedule
            </button>
          </form>
        </section>
      ) : null}

      <section className="rounded-[var(--radius-card)] border border-border bg-background p-5">
        <h2 className="text-sm font-semibold">Revisions</h2>
        <p className="mt-1 text-xs text-muted-foreground">
          Every save appends an immutable snapshot. Revisions cannot be edited
          or deleted.
        </p>

        {revisions.length === 0 ? (
          <p className="mt-3 text-sm text-muted-foreground">No revisions yet.</p>
        ) : (
          <ol className="mt-3 space-y-1">
            {revisions.map((revision) => (
              <li
                key={revision.id}
                className="flex flex-wrap justify-between gap-2 border-b border-border py-2 text-sm last:border-0"
              >
                <span className="font-mono text-xs">
                  #{revision.revision_number}
                </span>
                <span className="min-w-0 flex-1 truncate">{revision.title}</span>
                <span className="text-xs text-muted-foreground">
                  {formatDateTime(new Date(revision.created_at))}
                </span>
              </li>
            ))}
          </ol>
        )}
      </section>

      <section className="rounded-[var(--radius-card)] border border-border bg-background p-5">
        <h2 className="text-sm font-semibold">Public URL</h2>
        <p className="mt-1 font-mono text-sm text-muted-foreground">
          /articles/{article.slug}
        </p>
        {article.status === "published" ? (
          <Link
            href={`/articles/${article.slug}`}
            className="mt-3 inline-block text-sm text-primary underline underline-offset-2"
          >
            View live page
          </Link>
        ) : (
          <p className="mt-3 text-xs text-muted-foreground">
            Not publicly reachable while status is &ldquo;
            {article.status.replace("_", " ")}&rdquo;.
          </p>
        )}
      </section>

      {canDelete ? (
        <section className="rounded-[var(--radius-card)] border border-danger/40 bg-danger/5 p-5">
          <h2 className="text-sm font-semibold text-danger">Delete article</h2>
          <p className="mt-1 text-xs text-muted-foreground">
            This permanently removes the article and its revisions. Archiving is
            reversible; deleting is not.
          </p>
          <form action={deleteArticleAction} className="mt-3">
            <input type="hidden" name="articleId" value={article.id} />
            <button
              type="submit"
              className="h-10 rounded-md border border-danger/50 px-4 text-sm font-semibold text-danger hover:bg-danger/10"
            >
              Delete permanently
            </button>
          </form>
        </section>
      ) : null}
    </div>
  );
}