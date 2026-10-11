import type { User } from "@supabase/supabase-js";
import { type NextRequest, NextResponse } from "next/server";

import { updateSession } from "@/lib/supabase/middleware";

/**
 * Middleware entry point.
 *
 * Responsibilities:
 *  1. Refresh the Supabase auth session so Server Components see valid cookies.
 *  2. Send unauthenticated users away from /admin before rendering.
 *
 * NOTE: this is a UX-level gate only. Real authorization is enforced by
 * Row Level Security and by `requireRole` in each admin page.
 */
export async function proxy(request: NextRequest) {
  const { pathname, search } = request.nextUrl;

  const response = await updateSession(request);

  if (pathname.startsWith("/admin")) {
    const supabase = await createServerClientGuard(request);
    const {
      data: { user },
    } = supabase
      ? await supabase.auth.getUser()
      : { data: { user: null as User | null } };

    if (!user) {
      const loginUrl = request.nextUrl.clone();
      loginUrl.pathname = "/login";
      loginUrl.search = `?next=${encodeURIComponent(pathname + search)}`;

      // NextResponse.redirect() builds a NEW response, so headers set on
      // `response` above are discarded. Set no-store here as well.
      const redirectResponse = NextResponse.redirect(loginUrl);
      redirectResponse.headers.set(
        "Cache-Control",
        "private, no-store, max-age=0",
      );
      return redirectResponse;
    }

    // Admin responses must never be cached publicly.
    response.headers.set("Cache-Control", "private, no-store, max-age=0");
  }

  return response;
}

/**
 * Resolves the request's authenticated user for middleware purposes.
 * Returns null when Supabase is not configured.
 */
async function createServerClientGuard(request: NextRequest) {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey =
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ??
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;

  if (!url || !anonKey) return null;

  const { createServerClient } = await import("@supabase/ssr");

  return createServerClient(url, anonKey, {
    cookies: {
      getAll() {
        return request.cookies.getAll();
      },
      setAll() {
        // Cookie writes already handled by updateSession().
      },
    },
  });
}

export const config = {
  matcher: [
    /*
     * Everything except static assets and image files.
     */
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp|avif|ico)$).*)",
  ],
};