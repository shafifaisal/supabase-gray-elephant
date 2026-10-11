import "server-only";

import { createClient as createSupabaseClient } from "@supabase/supabase-js";

/**
 * Build-time Supabase client for `generateStaticParams` and other contexts that
 * run WITHOUT an HTTP request.
 *
 * WHY THIS EXISTS
 * ---------------
 * The request-scoped client in `server.ts` reads `cookies()`, which is
 * unavailable during a build. `generateStaticParams` therefore needs a
 * cookie-free client.
 *
 * This is safe for the only thing it is used for: reading PUBLIC content.
 * It uses the anon/publishable key, so Row Level Security still applies — the
 * database returns only rows an anonymous visitor could fetch. It is never
 * used for writes and never receives a user session, so it cannot read a
 * draft.
 */
export function createBuildClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey =
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ??
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;

  if (!url || !anonKey) {
    throw new Error(
      "Supabase public environment variables are not configured. " +
        "See .env.example and docs/setup.md.",
    );
  }

  return createSupabaseClient(url, anonKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  });
}