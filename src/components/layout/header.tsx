"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Suspense, useEffect, useId, useRef, useState } from "react";

import { signOutAction } from "@/app/login/actions";
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
  const authenticated = useIsAuthenticated();

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
          <ActiveNav authenticated={authenticated} />
        </Suspense>

        <Suspense fallback={<span className="h-10 w-10 md:hidden" />}>
          <MobileNav authenticated={authenticated} />
        </Suspense>
      </div>
    </header>
  );
}

/**
 * Resolves whether a staff session is active, for the conditional Logout link.
 *
 * This is a client-side probe (see /api/auth/status) rather than a server read
 * in the root layout on purpose: reading the session cookie during render would
 * opt every public page out of static caching. It starts `false`, so the
 * prerendered HTML is identical for everyone and only a signed-in admin's
 * browser adds the Logout control after hydration.
 */
function useIsAuthenticated(): boolean {
  const [authenticated, setAuthenticated] = useState(false);

  useEffect(() => {
    const controller = new AbortController();

    fetch("/api/auth/status", { cache: "no-store", signal: controller.signal })
      .then((response) => (response.ok ? response.json() : null))
      .then((data) => {
        if (data) setAuthenticated(Boolean(data.authenticated));
      })
      .catch(() => {
        // Offline or aborted — simply leave the Logout link hidden.
      });

    return () => controller.abort();
  }, []);

  return authenticated;
}

/**
 * Desktop staff menu. Hovering (or focusing) "Logout" slides a small dropdown
 * down with a Dashboard link and the actual sign-out action. CSS-only so it
 * costs no JavaScript and works for pointer and keyboard users alike.
 */
function AuthMenu() {
  return (
    <div className="group relative">
      <button
        type="button"
        aria-haspopup="true"
        className="inline-flex items-center gap-1 rounded-md px-3 py-2 text-sm font-medium text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground focus-visible:bg-secondary focus-visible:text-foreground"
      >
        Admin
        <ChevronDownIcon className="h-3.5 w-3.5 transition-transform duration-150 group-hover:rotate-180 group-focus-within:rotate-180" />
      </button>

      <div className="invisible absolute right-0 top-full z-50 -translate-y-2 pt-1 opacity-0 transition-all duration-150 group-hover:visible group-hover:translate-y-0 group-hover:opacity-100 group-focus-within:visible group-focus-within:translate-y-0 group-focus-within:opacity-100">
        <div className="w-44 rounded-md border border-border bg-background p-1 shadow-lg">
          <Link
            href="/admin"
            className="block rounded px-3 py-2 text-sm font-medium text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground"
          >
            Dashboard
          </Link>
          <form action={signOutAction}>
            <button
              type="submit"
              className="block w-full rounded px-3 py-2 text-left text-sm font-medium text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground"
            >
              Logout
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}

/** Mobile equivalent: the same two destinations, expanded inline. */
function MobileAuthItems() {
  return (
    <>
      <li>
        <Link
          href="/admin"
          className="block rounded-md px-3 py-2 text-sm font-medium text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground"
        >
          Dashboard
        </Link>
      </li>
      <li>
        <form action={signOutAction}>
          <button
            type="submit"
            className="block w-full rounded-md px-3 py-2 text-left text-sm font-medium text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground"
          >
            Logout
          </button>
        </form>
      </li>
    </>
  );
}

function ChevronDownIcon({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      aria-hidden="true"
      focusable="false"
    >
      <path d="m6 9 6 6 6-6" />
    </svg>
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

function ActiveNav({ authenticated }: { authenticated: boolean }) {
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
        {authenticated ? (
          <li>
            <AuthMenu />
          </li>
        ) : null}
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

function MobileNav({ authenticated }: { authenticated: boolean }) {
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
            {authenticated ? <MobileAuthItems /> : null}
          </ul>
        </nav>
      ) : null}
    </div>
  );
}