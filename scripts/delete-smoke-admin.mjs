/**
 * Deletes the local smoke-test administrator.
 *
 * `scripts/verify-auth.mjs` requires that NO administrator exists, because the
 * first-admin bootstrap is deliberately blocked once an admin is present. This
 * clears the account created by `create-test-admin.mjs` so the RLS suite can
 * run.
 *
 * Usage: node --env-file=.env.local scripts/delete-smoke-admin.mjs
 */

import { createClient } from "@supabase/supabase-js";

const email = process.env.SMOKE_EMAIL;

if (!email) {
  console.error("Set SMOKE_EMAIL in .env.local first.");
  process.exit(1);
}

const admin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
  { auth: { autoRefreshToken: false, persistSession: false } },
);

const { data: list, error } = await admin.auth.admin.listUsers({
  page: 1,
  perPage: 1000,
});

if (error) {
  console.error(error.message);
  process.exit(1);
}

const user = list.users.find((u) => u.email?.toLowerCase() === email.toLowerCase());

if (!user) {
  console.log("No smoke-test administrator found.");
  process.exit(0);
}

const { error: deleteError } = await admin.auth.admin.deleteUser(user.id);

if (deleteError) {
  console.error(deleteError.message);
  process.exit(1);
}

console.log(`Deleted ${email}. verify-auth.mjs can now run.`);