import Link from "next/link";
import type { ReactNode } from "react";

export function Card({
  children,
  className = "",
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <div
      className={`relative rounded-[var(--radius-card)] border border-border bg-background p-6 shadow-sm ${className}`}
    >
      {children}
    </div>
  );
}

export function SectionHeading({
  title,
  description,
  as: Tag = "h2",
}: {
  title: string;
  description?: string;
  as?: "h1" | "h2" | "h3";
}) {
  return (
    <div className="max-w-2xl">
      <Tag className="text-2xl font-bold tracking-tight sm:text-3xl">
        {title}
      </Tag>
      {description ? (
        <p className="mt-3 text-base text-muted-foreground">{description}</p>
      ) : null}
    </div>
  );
}

export function PrivacyNotice({ children }: { children?: ReactNode }) {
  return (
    <div
      role="note"
      className="flex items-start gap-3 rounded-lg border border-border bg-secondary/60 px-4 py-3 text-sm text-muted-foreground"
    >
      <svg
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
        className="mt-0.5 h-4 w-4 shrink-0 text-primary"
        aria-hidden="true"
        focusable="false"
      >
        <rect x="3" y="11" width="18" height="10" rx="2" />
        <path d="M7 11V7a5 5 0 0 1 10 0v4" />
      </svg>
      <p>
        {children ?? (
          <>
            This tool runs entirely in your browser. Nothing you type or generate
            is uploaded, stored or logged.
          </>
        )}
      </p>
    </div>
  );
}

export function Prose({ children }: { children: ReactNode }) {
  return <div className="prose-guides text-foreground">{children}</div>;
}

export function BackLink({ href, children }: { href: string; children: ReactNode }) {
  return (
    <Link
      href={href}
      className="inline-flex items-center gap-1.5 rounded text-sm font-medium text-muted-foreground transition-colors hover:text-foreground"
    >
      <span aria-hidden="true">&larr;</span>
      {children}
    </Link>
  );
}