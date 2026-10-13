"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Suspense, useEffect, useId, useRef, useState } from "react";

import { primaryNav, Wordmark } from "@/components/layout/nav-links";

/**
 * Responsive header. Desktop shows inline navigation; mobile uses a
 * disclosure button that manages its own expanded state and closes on
 * route change or Escape.
 *
 * `brandName` comes from the admin-editable site settings (via the root
 * layout), so a rebrand updates the wordmark without a code change.
 */
export function Header({ brandName }: { brandName?: string }) {
  return (
    <header className="sticky top-0 z-40 border-b border-border bg-background/85 backdrop-blur">
      <div className="container-page flex h-16 items-center justify-between gap-4">
        <Wordmark brandName={brandName} />

        {/*
          Both nav variants read `usePathname()` for active-link state. Under
          Next 16 cacheComponents that value is runtime-only, so it is streamed
          through a Suspense boundary rather than blocking the whole page from
          prerendering. The fallback renders the same links without the
          active state, so navigation is never missing.
        */}
        <Suspense fallback={<StaticNav />}>
          <ActiveNav />
        </Suspense>

        <Suspense fallback={<span className="h-10 w-10 md:hidden" />}>
          <MobileNav />
        </Suspense>
      </div>
    </header>
  );
}

function StaticNav() {
  return (
    <nav aria-label="Main" className="hidden md:block">
      <ul className="flex items-center gap-1">
        {primaryNav.map((item) => (
          <li key={item.href}>
            <Link
              href={item.href}
              className="inline-block rounded-md px-3 py-2 text-sm font-medium text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground"
            >
              {item.label}
            </Link>
          </li>
        ))}
      </ul>
    </nav>
  );
}

function ActiveNav() {
  const pathname = usePathname();

  return (
    <nav aria-label="Main" className="hidden md:block">
      <ul className="flex items-center gap-1">
        {primaryNav.map((item) => (
          <li key={item.href}>
            <NavLink href={item.href} pathname={pathname}>
              {item.label}
            </NavLink>
          </li>
        ))}
      </ul>
    </nav>
  );
}

function NavLink({
  href,
  pathname,
  children,
}: {
  href: string;
  pathname: string;
  children: React.ReactNode;
}) {
  const isActive = pathname === href || pathname.startsWith(`${href}/`);

  return (
    <Link
      href={href}
      aria-current={isActive ? "page" : undefined}
      className={`inline-block rounded-md px-3 py-2 text-sm font-medium transition-colors ${
        isActive
          ? "text-primary"
          : "text-muted-foreground hover:bg-secondary hover:text-foreground"
      }`}
    >
      {children}
    </Link>
  );
}

function MobileNav() {
  const [isOpen, setIsOpen] = useState(false);
  const pathname = usePathname();
  const panelId = useId();
  const containerRef = useRef<HTMLDivElement>(null);

  // Close the menu whenever navigation occurs. Adjusted during render rather
  // than in an effect to avoid a cascading re-render.
  const [lastPathname, setLastPathname] = useState(pathname);
  if (lastPathname !== pathname) {
    setLastPathname(pathname);
    setIsOpen(false);
  }

  // Close on Escape and on outside click.
  useEffect(() => {
    if (!isOpen) return;

    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") setIsOpen(false);
    }

    function onPointerDown(event: MouseEvent) {
      if (!containerRef.current?.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }

    document.addEventListener("keydown", onKeyDown);
    document.addEventListener("mousedown", onPointerDown);
    return () => {
      document.removeEventListener("keydown", onKeyDown);
      document.removeEventListener("mousedown", onPointerDown);
    };
  }, [isOpen]);

  return (
    <div className="md:hidden" ref={containerRef}>
      <button
        type="button"
        onClick={() => setIsOpen((open) => !open)}
        aria-expanded={isOpen}
        aria-controls={panelId}
        aria-label={isOpen ? "Close main menu" : "Open main menu"}
        className="inline-flex h-10 w-10 items-center justify-center rounded-md border border-border text-foreground transition-colors hover:bg-secondary"
      >
        <svg
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          className="h-5 w-5"
          aria-hidden="true"
          focusable="false"
        >
          {isOpen ? (
            <>
              <path d="M6 6l12 12" />
              <path d="M18 6L6 18" />
            </>
          ) : (
            <>
              <path d="M4 7h16" />
              <path d="M4 12h16" />
              <path d="M4 17h16" />
            </>
          )}
        </svg>
      </button>

      {isOpen ? (
        <nav
          id={panelId}
          aria-label="Mobile"
          className="absolute inset-x-0 top-16 border-b border-border bg-background shadow-sm"
        >
          <ul className="container-page flex flex-col py-2">
            {primaryNav.map((item) => (
              <li key={item.href}>
                <Link
                  href={item.href}
                  aria-current={
                    pathname === item.href ? "page" : undefined
                  }
                  className={`block rounded-md px-3 py-2 text-sm font-medium transition-colors ${
                    pathname === item.href
                      ? "text-primary"
                      : "text-muted-foreground hover:bg-secondary hover:text-foreground"
                  }`}
                >
                  {item.label}
                </Link>
              </li>
            ))}
          </ul>
        </nav>
      ) : null}
    </div>
  );
}