import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "Not authorised",
  robots: { index: false, follow: false },
};

export default function ForbiddenPage() {
  return (
    <div className="container-page flex min-h-[60vh] flex-col items-center justify-center py-20 text-center">
      <p className="text-sm font-semibold tracking-wide text-primary uppercase">
        403
      </p>
      <h1 className="mt-3 text-3xl font-bold tracking-tight">
        You don&rsquo;t have access to this area
      </h1>
      <p className="mt-4 max-w-md text-muted-foreground">
        Your account does not have the role required to view this page. If you
        believe this is a mistake, contact an administrator.
      </p>
      <Link
        href="/admin"
        className="mt-8 inline-flex h-11 items-center rounded-md border border-border px-6 text-sm font-semibold transition-colors hover:bg-secondary"
      >
        Back to dashboard
      </Link>
    </div>
  );
}