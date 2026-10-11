/**
 * Reports the JWT-related PostgreSQL settings visible to the current session,
 * so the privilege guard can be written against the correct GUC name.
 *
 * Usage: node --env-file=.env.local scripts/debug-jwt-context.mjs
 */

import { createClient } from "@supabase/supabase-js";

const admin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
  { auth: { autoRefreshToken: false, persistSession: false } },
);

const { data, error } = await admin.rpc("debug_jwt_context");

if (error) {
  console.error("debug_jwt_context failed:", error.message);
  console.error("Has migration supabase/migrations/debug_jwt_context.sql been applied?");
  process.exit(1);
}

console.table(data);