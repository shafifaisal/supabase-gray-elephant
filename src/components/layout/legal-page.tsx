import Link from "next/link";
import type { ReactNode } from "react";

import { sanitizeForRender } from "@/lib/content/markdown";

/**
 * Shared shell for the legal pages (privacy, terms, cookies).
 *
 * Two things are handled here so each page stays small and consistent:
 *
 *  1. A last-updated date. Honest, visible dating matters for legal text — a
 *     policy with no date is a weak signal to both readers and reviewers.
 *
 *  2. Optional CMS-editable body. When an administrator has stored HTML for the
 *     page in site_settings, that HTML is rendered — but ONLY after passing
 *     through the same allowlist sanitizer used for article content, so a
 *     stored value can never execute script. When no override exists, the page
 *     renders its own static JSX, which describes the site's actual behaviour.
 */

export interface LegalPageProps {
  title: string;
  /** ISO date string shown as "Last updated". */
  updated: string;
  /** CMS-authored HTML override, if present. Rendered sanitized. */
  cmsHtml?: string;
  /** Static default content, rendered when there is no override. */
  children: ReactNode;
}

function formatUpdated(iso: string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return iso;
  return date.toLocaleDateString("en-GB", {
    year: "numeric",
    month: "long",
    timeZone: "UTC",
  });
}

export function LegalPage({ title, updated, cmsHtml, children }: LegalPageProps) {
  return (
    <div className="container-page py-10">
      <div className="max-w-3xl">
        <header className="border-b border-border pb-6">
          <h1 className="text-3xl font-bold tracking-tight sm:text-4xl">
            {title}
          </h1>
          <p className="mt-2 text-sm text-muted-foreground">
            Last updated {formatUpdated(updated)}
          </p>
        </header>

        {cmsHtml ? (
          // Defence in depth: stored HTML is sanitized again on render, exactly
          // as article bodies are. No stored value can inject script.
          <div
            className="prose-guides mt-8 text-foreground"
            dangerouslySetInnerHTML={{ __html: sanitizeForRender(cmsHtml) }}
          />
        ) : (
          <div className="prose-guides mt-8 text-foreground">{children}</div>
        )}

        <aside className="mt-10 rounded-[var(--radius-card)] border border-border bg-secondary/40 p-5 text-sm text-muted-foreground">
          <p>
            This page is a summary written in plain language, not formal legal
            advice. If anything here is unclear,{" "}
            <Link href="/contact" className="underline underline-offset-2">
              contact us
            </Link>{" "}
            and we will explain it.
          </p>
        </aside>
      </div>
    </div>
  );
}

/** A legal-section heading with a matching anchor id for deep links. */
export function LegalSection({
  id,
  children,
}: {
  id: string;
  children: ReactNode;
}) {
  return <h2 id={id}>{children}</h2>;
}
