/**
 * Creates a Supabase Auth user for smoke testing and promotes it to admin.
 *
 * Uses SMOKE_EMAIL / SMOKE_PASSWORD from the environment.
 *
 * Usage: node --env-file=.env.local scripts/create-test-admin.mjs
 */

import { createClient } from "@supabase/supabase-js";

const email = process.env.SMOKE_EMAIL;
const password = process.env.SMOKE_PASSWORD;

if (!email || !password) {
  console.error("Set SMOKE_EMAIL and SMOKE_PASSWORD first.");
  process.exit(1);
}

const admin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
  { auth: { autoRefreshToken: false, persistSession: false } },
);

// Reuse the account if it already exists.
const { data: list } = await admin.auth.admin.listUsers({
  page: 1,
  perPage: 1000,
});

let userId = list.users.find((u) => u.email?.toLowerCase() === email.toLowerCase())?.id;

if (!userId) {
  const { data, error } = await admin.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
    user_metadata: { full_name: "Smoke Test Admin" },
  });

  if (error) {
    console.error(error.message);
    process.exit(1);
  }

  userId = data.user.id;
  console.log(`Created ${email}`);
} else {
  console.log(`Reusing existing ${email}`);
}

const { data: promoted, error: promoteError } = await admin.rpc("set_profile_role", {
  _user_id: userId,
  _role: "admin",
});

if (promoteError) {
  console.error("Promotion failed:", promoteError.message);
  process.exit(1);
}

console.log(`Role: ${promoted.role}`);