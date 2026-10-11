import "server-only";

import { createClient as createSupabaseClient } from "@supabase/supabase-js";

/**
 * Service-role Supabase client. BYPASSES Row Level Security.
 *
 * SECURITY RULES
 *  * This module must only ever be imported from trusted server-side code
 *    (Server Actions, Route Handlers) — never from a Client Component.
 *  * Every call site must first verify the caller's session and role via
 *    `requireRole` in `@/lib/auth`. Unauthorised access here would be a full
 *    database compromise, because RLS no longer applies.
 *
 * The `server-only` import makes a Client Component import a build error
 * rather than a silent, catastrophic bundle leak.
 */
export function createAdminClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRoleKey =
    process.env.SUPABASE_SERVICE_ROLE_KEY ?? process.env.SUPABASE_SECRET_KEY;

  if (!url || !serviceRoleKey) {
    throw new Error(
      "Supabase service-role credentials are not configured. " +
        "These are required only for trusted server-side operations.",
    );
  }

  return createSupabaseClient(url, serviceRoleKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  });
}