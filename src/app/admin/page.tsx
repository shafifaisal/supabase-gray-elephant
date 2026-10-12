import type { Metadata } from "next";
import Link from "next/link";

import { signOutAction } from "@/app/login/actions";
import { roleAtLeast, requireRole } from "@/lib/auth/session";
import { ROLES } from "@/lib/auth/session";
import { formatDateTime } from "@/lib/format";

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

  const sections = [
    { href: "/admin/articles", label: "Articles", min: "author" },
    { href: "/admin/media", label: "Media", min: "author" },
    { href: "/admin/categories", label: "Categories", min: "editor" },
    { href: "/admin/tags", label: "Tags", min: "editor" },
    { href: "/admin/users", label: "Users", min: "admin" },
    { href: "/admin/settings", label: "Settings", min: "admin" },
    { href: "/admin/seo", label: "SEO", min: "admin" },
    { href: "/admin/audit-logs", label: "Audit logs", min: "admin" },
  ] as const;

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
          const allowed = roleAtLeast(user.role, section.min as never);
          const content = (
            <>
              <span className="font-semibold">{section.label}</span>
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

      <div className="mt-10 rounded-[var(--radius-card)] border border-border bg-secondary/40 p-9">
        <h2 className="text-sm font-semibold uppercase tracking-wide">
          Session details
        </h2>
        <dl className="mt-3 grid gap-2 text-sm sm:grid-cols-2">
          <dt className="text-muted-foreground">User ID</dt>
          <dd className="font-mono text-xs">{user.id}</dd>
          <dt className="text-muted-foreground">Account status</dt>
          <dd>{user.status}</dd>
          <dt className="text-muted-foreground">Available roles</dt>
          <dd>{ROLES.join(", ")}</dd>
          <dt className="text-muted-foreground">Rendered</dt>
          <dd>{formatDateTime(new Date())}</dd>
        </dl>
      </div>
    </div>
  );
}