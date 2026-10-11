import type { Metadata } from "next";
import Link from "next/link";

import { getAdminArticles } from "@/lib/content/articles";
import { roleAtLeast, requireRole } from "@/lib/auth/session";
import { formatDateTime } from "@/lib/format";
import { getTool } from "@/lib/tools";
import { toolPath } from "@/lib/tools";

export const metadata: Metadata = {
  title: "Articles",
  robots: { index: false, follow: false },
};

const STATUS_STYLES: Record<string, string> = {
  draft: "bg-secondary text-secondary-foreground",
  in_review: "bg-warning/15 text-warning",
  scheduled: "bg-primary/10 text-primary",
  published: "bg-success/15 text-success",
  archived: "bg-muted text-muted-foreground",
};

export default async function AdminArticlesPage({
  searchParams,
}: {
  searchParams: Promise<{ deleted?: string; error?: string }>;
}) {
  const user = await requireRole("author");
  const { deleted, error } = await searchParams;

  const articles = await getAdminArticles();
  const canEdit = roleAtLeast(user.role, "author");

  return (
    <div>
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Articles</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            {articles.length} article{articles.length === 1 ? "" : "s"}
          </p>
        </div>

        {canEdit ? (
          <Link
            href="/admin/articles/new"
            className="inline-flex h-10 items-center rounded-md bg-primary px-4 text-sm font-semibold text-primary-foreground transition-opacity hover:opacity-90"
          >
            New article
          </Link>
        ) : null}
      </div>

      {deleted ? (
        <p
          role="status"
          className="mt-4 rounded-md border border-success/40 bg-success/10 px-4 py-3 text-sm text-success"
        >
          Article deleted.
        </p>
      ) : null}

      {error ? (
        <p
          role="alert"
          className="mt-4 rounded-md border border-danger/40 bg-danger/10 px-4 py-3 text-sm text-danger"
        >
          {error}
        </p>
      ) : null}

      {articles.length === 0 ? (
        <div className="mt-8 rounded-[var(--radius-card)] border border-dashed border-border bg-background p-10 text-center">
          <h2 className="text-lg font-semibold">No articles yet</h2>
          <p className="mt-2 text-sm text-muted-foreground">
            Create your first guide, or start from an idea in the editorial plan.
          </p>
          {canEdit ? (
            <Link
              href="/admin/articles/new"
              className="mt-5 inline-flex h-10 items-center rounded-md bg-primary px-4 text-sm font-semibold text-primary-foreground"
            >
              Create an article
            </Link>
          ) : null}
        </div>
      ) : (
        <ul className="mt-6 space-y-2">
          {articles.map((article) => (
            <li
              key={article.id}
              className="rounded-[var(--radius-card)] border border-border bg-background p-4"
            >
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="min-w-0">
                  <h2 className="font-semibold">
                    <Link
                      href={`/admin/articles/${article.id}/edit`}
                      className="rounded hover:text-primary"
                    >
                      {article.title}
                    </Link>
                  </h2>
                  <p className="mt-1 font-mono text-xs text-muted-foreground">
                    /guides/{article.slug}
                  </p>
                  <p className="mt-1 text-xs text-muted-foreground">
                    Updated {formatDateTime(new Date(article.updated_at))}
                    {article.author?.email
                      ? ` · ${article.author.email}`
                      : ""}
                  </p>
                </div>

                <div className="flex shrink-0 items-center gap-2">
                  <span
                    className={`rounded-full px-2.5 py-1 text-xs font-semibold ${
                      STATUS_STYLES[article.status] ?? ""
                    }`}
                  >
                    {article.status.replace("_", " ")}
                  </span>
                </div>
              </div>
            </li>
          ))}
        </ul>
      )}

      <section className="mt-10 rounded-[var(--radius-card)] border border-border bg-background p-5">
        <h2 className="text-sm font-semibold">Editorial plan</h2>
        <p className="mt-1 text-xs text-muted-foreground">
          Guides must be original, reviewed and accurate. Nothing publishes
          automatically.
        </p>
        <ul className="mt-3 grid gap-2 sm:grid-cols-2">
          {[
            "Strong password practices",
            "Password length and randomness",
            "Passphrases",
            "Password managers",
            "Password reuse",
            "Multifactor authentication",
            "Entropy and its limitations",
            "Responding to a compromised account",
          ].map((topic) => (
            <li
              key={topic}
              className="rounded-md border border-border px-3 py-2 text-sm text-muted-foreground"
            >
              {topic}
            </li>
          ))}
        </ul>
        <p className="mt-3 text-xs text-muted-foreground">
          Live tools:{" "}
          {getTool("password-generator")?.name} ·{" "}
          {toolPath("password-generator")}
        </p>
      </section>
    </div>
  );
}