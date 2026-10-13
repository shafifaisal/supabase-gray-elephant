import type { User } from "@supabase/supabase-js";
import { type NextRequest, NextResponse } from "next/server";

import {
  isMaintenanceBypassed,
  maintenanceHtml,
  parseMaintenanceRows,
  wantsHtml,
  type MaintenanceState,
} from "@/lib/maintenance";
import { updateSession } from "@/lib/supabase/middleware";

/**
 * Middleware entry point.
 *
 * Responsibilities:
 *  1. Refresh the Supabase auth session so Server Components see valid cookies.
 *  2. Send unauthenticated users away from /admin before rendering.
 *  3. Serve a 503 maintenance holding page when an admin enables it.
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
    return response;
  }

  // Maintenance mode: gate public page navigations only. /admin and /login stay
  // reachable so the owner can switch it back off, and API/asset requests are
  // untouched.
  if (
    !isMaintenanceBypassed(pathname) &&
    wantsHtml(
      request.headers.get("sec-fetch-dest"),
      request.headers.get("accept"),
    )
  ) {
    const { enabled, brandName } = await getMaintenanceState();
    if (enabled) {
      return new NextResponse(maintenanceHtml(brandName), {
        status: 503,
        headers: {
          "Content-Type": "text/html; charset=utf-8",
          "Cache-Control": "no-store, max-age=0",
          "Retry-After": "300",
        },
      });
    }
  }

  return response;
}

/**
 * Reads the maintenance flag and brand name from the public settings table.
 *
 * The proxy runs on every request, so the value is memoised in the isolate for
 * a short window instead of hitting the database each time. Fails CLOSED: any
 * error, missing configuration or unparseable value leaves the site up.
 */
let maintenanceCache: { state: MaintenanceState; expires: number } | null = null;
const MAINTENANCE_TTL_MS = 15_000;

async function getMaintenanceState(): Promise<MaintenanceState> {
  const fallback: MaintenanceState = {
    enabled: false,
    brandName: process.env.NEXT_PUBLIC_SITE_NAME ?? "iPassGenerator",
  };

  const now = Date.now();
  if (maintenanceCache && maintenanceCache.expires > now) {
    return maintenanceCache.state;
  }

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey =
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ??
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;

  if (!url || !anonKey) return fallback;

  try {
    const endpoint =
      `${url}/rest/v1/site_settings` +
      "?select=key,value&key=in.(maintenance_mode,brand_name)";

    const res = await fetch(endpoint, {
      headers: { apikey: anonKey, Authorization: `Bearer ${anonKey}` },
      cache: "no-store",
    });

    if (!res.ok) return fallback;

    const rows = (await res.json()) as { key: string; value: unknown }[];
    const state = parseMaintenanceRows(rows, fallback.brandName);

    maintenanceCache = { state, expires: now + MAINTENANCE_TTL_MS };
    return state;
  } catch {
    return fallback;
  }
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