import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import type { ReactNode } from "react";

import { MessageInbox } from "@/components/admin/message-inbox";
import { requireRole, roleAtLeast } from "@/lib/auth/session";
import { getContactMessages } from "@/lib/content/contact-messages";

export const metadata: Metadata = {
  title: "Messages",
  robots: { index: false, follow: false },
};

export default async function MessagesPage({
  searchParams,
}: {
  searchParams: Promise<{ page?: string; updated?: string; error?: string }>;
}) {
  const user = await requireRole("editor");
  const { page: pageParam, error } = await searchParams;

  const requested = Number.parseInt(pageParam ?? "1", 10);
  const inbox = await getContactMessages(Number.isFinite(requested) ? requested : 1);

  // Deleting the last item on the final page can leave `page` beyond the end;
  // send the editor to the new last page instead of an empty inbox.
  if (inbox.page > inbox.totalPages) {
    redirect(`/admin/messages?page=${inbox.totalPages}`);
  }

  const unread = inbox.messages.filter(
    (message) => message.status === "new",
  ).length;
  const canManage = roleAtLeast(user.role, "admin");
  const errorMessage =
    error === "delete"
      ? "The message could not be deleted. Please try again."
      : error
        ? "The message could not be updated. Please try again."
        : null;

  return (
    <div>
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Messages</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Incoming messages from the public contact form. Click a message to
            read it in full.{unread > 0 ? ` ${unread} unread on this page.` : ""}
          </p>
        </div>
        <a
          href="/admin/messages/export"
          download
          className="inline-flex h-9 shrink-0 items-center rounded-md border border-border bg-background px-4 text-sm font-semibold transition-colors hover:bg-secondary"
        >
          Export to Excel
        </a>
      </div>

      {errorMessage ? (
        <p
          role="alert"
          className="mt-4 rounded-md border border-danger/40 bg-danger/10 px-4 py-3 text-sm text-danger"
        >
          {errorMessage}
        </p>
      ) : null}

      <MessageInbox
        messages={inbox.messages}
        canManage={canManage}
        page={inbox.page}
      />

      <Pagination page={inbox.page} totalPages={inbox.totalPages} />
    </div>
  );
}

/**
 * Numbered pagination. Small sets show every page; larger sets collapse to a
 * window around the current page with first/last anchors.
 */
function Pagination({
  page,
  totalPages,
}: {
  page: number;
  totalPages: number;
}) {
  if (totalPages <= 1) return null;

  const base =
    "inline-flex h-9 min-w-9 items-center justify-center rounded-md border px-3 text-sm font-semibold transition-colors";

  return (
    <nav
      aria-label="Pagination"
      className="mt-6 flex flex-wrap items-center gap-1.5"
    >
      <PageLink
        href={`/admin/messages?page=${page - 1}`}
        disabled={page <= 1}
        className={base}
      >
        Prev
      </PageLink>

      {pageItems(page, totalPages).map((item, index) =>
        item === "…" ? (
          <span
            key={`gap-${index}`}
            className="px-1 text-sm text-muted-foreground"
            aria-hidden="true"
          >
            …
          </span>
        ) : (
          <Link
            key={item}
            href={`/admin/messages?page=${item}`}
            aria-current={item === page ? "page" : undefined}
            className={`${base} ${
              item === page
                ? "border-primary bg-primary text-primary-foreground"
                : "border-border hover:bg-secondary"
            }`}
          >
            {item}
          </Link>
        ),
      )}

      <PageLink
        href={`/admin/messages?page=${page + 1}`}
        disabled={page >= totalPages}
        className={base}
      >
        Next
      </PageLink>
    </nav>
  );
}

function PageLink({
  href,
  disabled,
  className,
  children,
}: {
  href: string;
  disabled: boolean;
  className: string;
  children: ReactNode;
}) {
  if (disabled) {
    return (
      <span
        aria-disabled="true"
        className={`${className} pointer-events-none border-border opacity-50`}
      >
        {children}
      </span>
    );
  }

  return (
    <Link href={href} className={`${className} border-border hover:bg-secondary`}>
      {children}
    </Link>
  );
}

/** Page numbers to render, with `…` gaps for long ranges. */
function pageItems(current: number, total: number): (number | "…")[] {
  if (total <= 7) {
    return Array.from({ length: total }, (_, index) => index + 1);
  }

  const items: (number | "…")[] = [1];
  const start = Math.max(2, current - 1);
  const end = Math.min(total - 1, current + 1);

  if (start > 2) items.push("…");
  for (let p = start; p <= end; p += 1) items.push(p);
  if (end < total - 1) items.push("…");
  items.push(total);

  return items;
}
