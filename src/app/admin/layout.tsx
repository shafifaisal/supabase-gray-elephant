import type { Metadata } from "next";
import Link from "next/link";

import { roleAtLeast, requireRole } from "@/lib/auth/session";

export const metadata: Metadata = {
  title: { default: "Admin", template: "%s | Admin" },
  robots: { index: false, follow: false },
};

/**
 * Every admin route reads the session cookie, so none can be prerendered.
 * See Next 16 `cacheComponents`.
 */
export const instant = false;

const NAV = [
  { href: "/admin", label: "Dashboard", min: "author" },
  { href: "/admin/articles", label: "Articles", min: "author" },
  { href: "/admin/media", label: "Media", min: "author" },
  { href: "/admin/categories", label: "Categories", min: "editor" },
  { href: "/admin/seo", label: "SEO", min: "admin" },
  { href: "/admin/users", label: "Users", min: "admin" },
  { href: "/admin/settings", label: "Settings", min: "admin" },
  { href: "/admin/audit-logs", label: "Audit logs", min: "admin" },
] as const;

export default async function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const user = await requireRole("author");

  return (
    <div className="min-h-full bg-secondary/25">
      <div className="container-page py-8">
        <div className="flex flex-col gap-6 lg:flex-row">
          <aside className="lg:w-60 lg:shrink-0">
            <div className="mb-4 hidden lg:block">
              <p className="text-xs font-semibold tracking-wide text-muted-foreground uppercase">
                Signed in
              </p>
              <p className="mt-1 truncate text-sm font-medium">{user.email}</p>
              <span className="mt-1 inline-block rounded-full bg-primary/10 px-2 py-0.5 text-xs font-semibold text-primary uppercase">
                {user.role}
              </span>
            </div>

            <nav aria-label="Admin sections">
              <ul className="flex flex-wrap gap-1 lg:flex-col">
                {NAV.map((item) => {
                  const allowed = roleAtLeast(user.role, item.min);
                  const className = `block rounded-md px-3 py-2 text-sm font-medium transition-colors ${
                    allowed
                      ? "text-foreground hover:bg-background"
                      : "pointer-events-none text-muted-foreground/50"
                  }`;

                  return (
                    <li key={item.href}>
                      {allowed ? (
                        <Link href={item.href} className={className}>
                          {item.label}
                        </Link>
                      ) : (
                        <span
                          className={className}
                          aria-disabled="true"
                          title={`Requires ${item.min} role`}
                        >
                          {item.label}
                        </span>
                      )}
                    </li>
                  );
                })}
              </ul>
            </nav>

            <div className="mt-6 hidden lg:block">
              <Link
                href="/"
                className="text-sm text-muted-foreground hover:text-foreground"
              >
                ← Back to site
              </Link>
            </div>
          </aside>

          <div className="min-w-0 flex-1">{children}</div>
        </div>
      </div>
    </div>
  );
}