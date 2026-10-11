import type { Metadata } from "next";
import Link from "next/link";

import { getPublishedArticles } from "@/lib/content/articles";
import { requireRole } from "@/lib/auth/session";
import { describeNotReady } from "@/lib/ads/config";
import { getAdsConfig } from "@/lib/ads/server";
import { absoluteUrl, siteConfig } from "@/lib/site";
import { tools } from "@/lib/tools";

export const metadata: Metadata = {
  title: "SEO",
  robots: { index: false, follow: false },
};

/** Rough pixel budgets used as a quick editorial check, not a hard limit. */
const LIMITS = {
  seoTitle: 60,
  metaDescription: 155,
};

export default async function SeoPage() {
  await requireRole("admin");
  const [articles, ads] = await Promise.all([
    getPublishedArticles(200),
    getAdsConfig(),
  ]);

  const issues = articles.filter((article) => {
    const titleLength = (article.seo_title || article.title).length;
    const descriptionLength = (
      article.meta_description ||
      article.excerpt ||
      ""
    ).length;

    return (
      titleLength > LIMITS.seoTitle ||
      descriptionLength === 0 ||
      descriptionLength > LIMITS.metaDescription ||
      article.is_noindex
    );
  });

  return (
    <div>
      <h1 className="text-2xl font-bold tracking-tight">SEO</h1>
      <p className="mt-1 text-sm text-muted-foreground">
        Indexing status and metadata quality across published content.
      </p>

      <section className="mt-6 rounded-[var(--radius-card)] border border-border bg-background p-5">
        <h2 className="text-sm font-semibold">Site defaults</h2>
        <dl className="mt-3 space-y-2 text-sm">
          <div className="flex justify-between gap-3">
            <dt className="text-muted-foreground">Canonical origin</dt>
            <dd className="font-mono">{siteConfig.url}</dd>
          </div>
          <div className="flex justify-between gap-3">
            <dt className="text-muted-foreground">Sitemap</dt>
            <dd>
              <Link
                href="/sitemap.xml"
                className="font-mono text-primary underline underline-offset-2"
              >
                {absoluteUrl("/sitemap.xml")}
              </Link>
            </dd>
          </div>
          <div className="flex justify-between gap-3">
            <dt className="text-muted-foreground">robots.txt</dt>
            <dd>
              <Link
                href="/robots.txt"
                className="font-mono text-primary underline underline-offset-2"
              >
                {absoluteUrl("/robots.txt")}
              </Link>
            </dd>
          </div>
          <div className="flex justify-between gap-3">
            <dt className="text-muted-foreground">Indexable tools</dt>
            <dd className="font-mono">{tools.length}</dd>
          </div>
        </dl>
      </section>

      <section className="mt-6">
        <h2 className="text-sm font-semibold">
          Articles needing attention ({issues.length})
        </h2>

        {issues.length === 0 ? (
          <p className="mt-3 rounded-md border border-success/40 bg-success/10 px-4 py-3 text-sm text-success">
            All published articles have usable titles and descriptions.
          </p>
        ) : (
          <ul className="mt-3 space-y-2">
            {issues.map((article) => {
              const descriptionLength = (
                article.meta_description ||
                article.excerpt ||
                ""
              ).length;

              return (
                <li
                  key={article.id}
                  className="rounded-md border border-border bg-background px-4 py-3"
                >
                  <Link
                    href={`/admin/articles/${article.id}/edit`}
                    className="font-medium hover:text-primary"
                  >
                    {article.title}
                  </Link>
                  <ul className="mt-1 text-xs text-muted-foreground">
                    {(article.seo_title || article.title).length >
                    LIMITS.seoTitle ? (
                      <li className="text-warning">
                        Title is {(article.seo_title || article.title).length}{" "}
                        characters; aim for {LIMITS.seoTitle} or fewer.
                      </li>
                    ) : null}
                    {descriptionLength === 0 ? (
                      <li className="text-warning">
                        No meta description or excerpt.
                      </li>
                    ) : null}
                    {descriptionLength > LIMITS.metaDescription ? (
                      <li className="text-warning">
                        Description is {descriptionLength} characters; it may be
                        truncated in results.
                      </li>
                    ) : null}
                    {article.is_noindex ? (
                      <li>Deliberately excluded from indexing.</li>
                    ) : null}
                  </ul>
                </li>
              );
            })}
          </ul>
        )}
      </section>

      <section className="mt-6 rounded-[var(--radius-card)] border border-border bg-background p-5">
        <h2 className="text-sm font-semibold">Advertising readiness</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          AdSense is optional and off by default. It runs only when configured
          here <em>and</em> a visitor consents. Approval is never guaranteed.
        </p>
        <div className="mt-3 flex items-start gap-3">
          <span
            className={`mt-0.5 inline-flex h-5 w-5 shrink-0 items-center justify-center rounded-full text-xs font-bold ${
              ads.ready
                ? "bg-success/15 text-success"
                : "bg-warning/15 text-warning"
            }`}
            aria-hidden="true"
          >
            {ads.ready ? "✓" : "!"}
          </span>
          <div className="text-sm">
            <p className={ads.ready ? "font-medium text-success" : "font-medium text-warning"}>
              {ads.ready ? "Advertising is configured" : "Advertising is not active"}
            </p>
            <p className="mt-0.5 text-muted-foreground">
              {describeNotReady(ads.reason)}
            </p>
            {ads.ready && ads.publisherId ? (
              <p className="mt-1 font-mono text-xs text-muted-foreground">
                Publisher: {ads.publisherId}
              </p>
            ) : null}
            <p className="mt-2 text-xs text-muted-foreground">
              Configure in{" "}
              <Link href="/admin/settings" className="underline underline-offset-2">
                site settings
              </Link>{" "}
              and via environment variables. See{" "}
              <Link href="/api/ads/config" className="underline underline-offset-2">
                /api/ads/config
              </Link>
              .
            </p>
          </div>
        </div>
      </section>

      <p className="mt-8 text-xs text-muted-foreground">
        Drafts, admin pages, login routes and noindex articles are excluded from
        the sitemap by design, not by omission.
      </p>
    </div>
  );
}