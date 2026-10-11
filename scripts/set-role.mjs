/**
 * Grants a user the administrator role.
 *
 * Runs with the service-role key, so it is the correct path for both the very
 * first administrator and later promotions. Client sessions must never do this.
 *
 * Usage:
 *   node --env-file=.env.local scripts/set-role.mjs <user-id> [admin|editor|author]
 *   node --env-file=.env.local scripts/set-role.mjs --email you@example.com admin
 */

import { createClient } from "@supabase/supabase-js";

const [, , target, roleArg] = process.argv;

if (!target || !["admin", "editor", "author"].includes(roleArg)) {
  console.error(
    "Usage: set-role.mjs <user-id|--email> <admin|editor|author>",
  );
  process.exit(1);
}

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceKey =
  process.env.SUPABASE_SERVICE_ROLE_KEY ?? process.env.SUPABASE_SECRET_KEY;

if (!url || !serviceKey) {
  console.error("Missing Supabase credentials.");
  process.exit(1);
}

const admin = createClient(url, serviceKey, {
  auth: { autoRefreshToken: false, persistSession: false },
});

async function resolveUserId() {
  if (target === "--email") return null; // handled below via arg order
  return target;
}

async function main() {
  let userId = target;

  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-/i.test(target)) {
    // Treat the argument as an email address.
    const email = target;
    const { data: list, error } = await admin.auth.admin.listUsers({
      page: 1,
      perPage: 200,
    });

    if (error) throw error;

    const user = list.users.find(
      (u) => u.email?.toLowerCase() === email.toLowerCase(),
    );

    if (!user) {
      console.error(`No user found with email ${email}`);
      process.exit(1);
    }

    userId = user.id;
  }

  const { data, error } = await admin.rpc("set_profile_role", {
    _user_id: userId,
    _role: roleArg,
  });

  if (error) {
    console.error("set_profile_role failed:", error.message);
    process.exit(1);
  }

  console.log(`Set ${userId} to ${roleArg}.`);
  console.log(`  role:   ${data.role}`);
  console.log(`  status: ${data.status}`);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});

void resolveUserId;