import type { Metadata } from "next";
import Link from "next/link";

import { signOutAction } from "@/app/login/actions";
import { roleAtLeast, requireRole, type Role } from "@/lib/auth/session";
import { countUnreadMessages } from "@/lib/content/contact-messages";

/**
 * `instant = false` opts this route out of static prerendering.
 *
 * Required under Next 16 `cacheComponents`, because the page reads the auth
 * session cookie via `requireRole`. The explicit `Cache-Control: private,
 * no-store` header is applied in src/proxy.ts.
 */

export const metadata: Metadata = {
  title: "Admin dashboard",
  robots: { index: false, follow: false },
};

export default async function AdminDashboardPage() {
  const user = await requireRole("author");

  // RLS on `contact_messages` only lets editors read the table, so an author
  // would be shown a count of 0 for an inbox they are not allowed to open.
  // Skip the query for them and leave the badge off entirely.
  const unreadMessages = roleAtLeast(user.role, "editor")
    ? await countUnreadMessages()
    : null;

  const sections: ReadonlyArray<{
    href: string;
    label: string;
    min: Role;
    /** Unread count shown after the label, when the viewer may read it. */
    unread?: number;
  }> = [
    { href: "/admin/articles", label: "Articles", min: "author" },
    {
      href: "/admin/messages",
      label: "Messages",
      min: "editor",
      unread: unreadMessages ?? undefined,
    },
    { href: "/admin/media", label: "Media", min: "author" },
    { href: "/admin/categories", label: "Categories", min: "editor" },
    { href: "/admin/tags", label: "Tags", min: "editor" },
    { href: "/admin/users", label: "Users", min: "admin" },
    { href: "/admin/settings", label: "Settings", min: "admin" },
    { href: "/admin/seo", label: "SEO", min: "admin" },
    { href: "/admin/audit-logs", label: "Audit logs", min: "admin" },
  ];

  return (
    <div className="container-page py-10">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Dashboard</h1>
          <p className="mt-2 text-sm text-muted-foreground">
            Signed in as{" "}
            <span className="font-medium text-foreground">{user.email}</span>{" "}
            <span className="rounded-full bg-secondary px-2 py-0.5 text-xs font-medium uppercase">
              {user.role}
            </span>
          </p>
        </div>

        <form action={signOutAction}>
          <button
            type="submit"
            className="inline-flex h-10 items-center rounded-md border border-border px-4 text-sm font-semibold transition-colors hover:bg-secondary"
          >
            Sign out
          </button>
        </form>
      </div>

      <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {sections.map((section) => {
          const allowed = roleAtLeast(user.role, section.min);
          const content = (
            <>
              <span className="font-semibold">
                {section.label}
                {section.unread !== undefined ? (
                  <span className="ml-1 font-mono text-sm font-normal text-muted-foreground">
                    ({section.unread})
                  </span>
                ) : null}
              </span>
              <span className="mt-1 block text-xs text-muted-foreground">
                {allowed ? `Requires ${section.min}` : `Requires ${section.min} — no access`}
              </span>
            </>
          );

          return allowed ? (
            <Link
              key={section.href}
              href={section.href}
              className="rounded-[var(--radius-card)] border border-border bg-background p-5 transition-colors hover:border-primary"
            >
              {content}
            </Link>
          ) : (
            <div
              key={section.href}
              aria-disabled="true"
              className="rounded-[var(--radius-card)] border border-border bg-secondary/40 p-5 opacity-60"
            >
              {content}
            </div>
          );
        })}
      </div>
    </div>
  );
}