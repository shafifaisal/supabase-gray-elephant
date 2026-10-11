import Link from "next/link";

export default function NotFound() {
  return (
    <div className="container-page flex min-h-[60vh] flex-col items-center justify-center py-20 text-center">
      <p className="text-sm font-semibold tracking-wide text-primary uppercase">
        404
      </p>
      <h1 className="mt-3 text-4xl font-bold tracking-tight">
        We couldn&rsquo;t find that page
      </h1>
      <p className="mt-4 max-w-md text-muted-foreground">
        The page you requested doesn&rsquo;t exist, or isn&rsquo;t publicly
        available. Draft content is never shown to anonymous visitors.
      </p>
      <div className="mt-8 flex flex-col gap-3 sm:flex-row">
        <Link
          href="/"
          className="inline-flex h-11 items-center justify-center rounded-md bg-primary px-6 text-sm font-semibold text-primary-foreground transition-opacity hover:opacity-90"
        >
          Back to home
        </Link>
        <Link
          href="/tools"
          className="inline-flex h-11 items-center justify-center rounded-md border border-border px-6 text-sm font-semibold transition-colors hover:bg-secondary"
        >
          Browse tools
        </Link>
      </div>
    </div>
  );
}