/**
 * Removes leftover RLS verification accounts and their data.
 *
 * Verification runs that abort early leave users behind; because they may hold
 * the administrator role, they must be cleared before a clean bootstrap test.
 *
 * Usage: node --env-file=.env.local scripts/cleanup-test-users.mjs
 */

import { createClient } from "@supabase/supabase-js";

const admin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
  { auth: { autoRefreshToken: false, persistSession: false } },
);

const PREFIX = "rls-";

const { data: list, error } = await admin.auth.admin.listUsers({
  page: 1,
  perPage: 1000,
});

if (error) {
  console.error(error.message);
  process.exit(1);
}

const victims = list.users.filter((u) => u.email?.startsWith(PREFIX));

if (victims.length === 0) {
  console.log("No leftover test users found.");
  process.exit(0);
}

const ids = victims.map((u) => u.id);

// Delete dependent rows first, then the auth users (which cascade to profiles).
await admin.from("article_revisions").delete().in("changed_by", ids);
await admin.from("articles").delete().in("author_id", ids);
await admin.from("categories").delete().in("slug", []);
await admin.from("contact_messages").delete().eq("email", "visitor@example.test");

for (const id of ids) {
  const { error: deleteError } = await admin.auth.admin.deleteUser(id);
  if (deleteError) console.error(`${id}: ${deleteError.message}`);
}

const { data: remainingAdmins } = await admin
  .from("profiles")
  .select("id, email, role")
  .eq("role", "admin");

console.log(`Deleted ${victims.length} test user(s).`);
console.log("Remaining administrators:", remainingAdmins ?? []);