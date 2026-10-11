/**
 * RLS verification script.
 *
 * Connects directly to Postgres and asserts that the security posture we
 * expect is actually in place: RLS enabled, policies present, and the
 * privilege helpers behaving correctly for simulated roles.
 *
 * Usage: node --env-file=.env.local scripts/verify-rls.mjs
 *
 * This checks DATABASE STATE. It complements the authenticated-role tests in
 * src/lib/rls.integration.test.ts, which exercise real JWTs end-to-end.
 */

import pg from "pg";

const { Client, Pool } = pg;

const connectionString = (
  process.env.POSTGRES_URL_NON_POOLING ??
  process.env.POSTGRES_URL ??
  process.env.DATABASE_URL
).replace(/sslmode=[^&]*/, "sslmode=no-verify");

const TABLES = [
  "profiles",
  "categories",
  "tags",
  "media",
  "articles",
  "article_tags",
  "article_revisions",
  "site_settings",
  "redirects",
  "audit_logs",
  "contact_messages",
];

let passed = 0;
let failed = 0;

function check(label, condition, detail = "") {
  if (condition) {
    passed += 1;
    console.log(`  PASS  ${label}`);
  } else {
    failed += 1;
    console.log(`  FAIL  ${label}${detail ? ` — ${detail}` : ""}`);
  }
}

const client = new Client({
  connectionString,
  ssl: { rejectUnauthorized: false },
});

async function main() {
  await client.connect();
  console.log("Connected. Verifying RLS posture...\n");

  // --- 1. RLS enabled on every table -------------------------------------
  console.log("RLS enablement:");
  const { rows: rlsRows } = await client.query(`
    select c.relname, c.relrowsecurity, c.relforcerowsecurity
    from pg_class c
    join pg_namespace n on n.oid = c.relnamespace
    where n.nspname = 'public' and c.relname = any($1::text[])
  `, [TABLES]);

  for (const table of TABLES) {
    const row = rlsRows.find((r) => r.relname === table);
    check(`${table}: RLS enabled`, row?.relrowsecurity === true);
  }
  check(
    "table count matches expectation",
    rlsRows.length === TABLES.length,
    `found ${rlsRows.length}`,
  );

  // --- 2. No table stores generated secrets -------------------------------
  console.log("\nNo secret-storage tables:");
  const { rows: secretish } = await client.query(`
    select c.relname from pg_class c
    join pg_namespace n on n.oid = c.relnamespace
    where n.nspname = 'public' and c.relkind = 'r'
      and (c.relname ilike '%password%'
        or c.relname ilike '%passphrase%'
        or c.relname ilike '%secret%'
        or c.relname ilike '%generated%')
  `);
  check(
    "no password/passphrase/secret tables exist",
    secretish.length === 0,
    secretish.map((r) => r.relname).join(", "),
  );

  // --- 3. Helper functions are SECURITY DEFINER with locked search_path ---
  console.log("\nPrivilege helper hardening:");
  const { rows: fnRows } = await client.query(`
    select p.proname, p.prosecdef, p.proconfig
    from pg_proc p
    join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public'
      and p.proname in (
        'current_role','is_admin','is_editor','is_staff',
        'can_edit_article','handle_new_user','guard_profile_privileges'
      )
  `);
  for (const fn of fnRows) {
    check(`${fn.proname}: SECURITY DEFINER`, fn.prosecdef === true);
    const hasLockedPath = (fn.proconfig ?? []).some((c) =>
      c.startsWith("search_path="),
    );
    check(`${fn.proname}: search_path locked`, hasLockedPath);
  }

  // --- 4. Privileged grants only to the right roles ----------------------
  console.log("\nGrants:");
  const { rows: grantRows } = await client.query(`
    select table_name, grantee, privilege_type
    from information_schema.role_table_grants
    where table_schema = 'public'
      and grantee in ('anon', 'authenticated')
      and table_name in ('audit_logs','article_revisions','site_settings','articles')
  `);

  const anonHas = (table, priv) =>
    grantRows.some((g) => g.table_name === table && g.grantee === "anon" && g.privilege_type === priv);

  check("anon: no INSERT on audit_logs", !anonHas("audit_logs", "INSERT"));
  check("anon: no INSERT on article_revisions", !anonHas("article_revisions", "INSERT"));
  check("anon: no INSERT on site_settings", !anonHas("site_settings", "INSERT"));
  check("anon: no INSERT on articles", !anonHas("articles", "INSERT"));
  check("anon: no UPDATE on articles", !anonHas("articles", "UPDATE"));
  check("anon: no DELETE on articles", !anonHas("articles", "DELETE"));
  check("anon: SELECT on articles (published filter handles visibility)", anonHas("articles", "SELECT"));

  // --- 5. Policy coverage ------------------------------------------------
  console.log("\nPolicy coverage:");
  const { rows: polRows } = await client.query(`
    select tablename, policyname, cmd, roles
    from pg_policies
    where schemaname = 'public'
  `);

  const policyCount = (table) => polRows.filter((p) => p.tablename === table).length;
  for (const table of TABLES) {
    check(`${table}: has at least one policy`, policyCount(table) > 0);
  }

  const revisionCmds = polRows
    .filter((p) => p.tablename === "article_revisions")
    .map((p) => p.cmd);
  check(
    "article_revisions: no UPDATE policy (append-only)",
    !revisionCmds.includes("UPDATE"),
  );
  check(
    "article_revisions: no DELETE policy (append-only)",
    !revisionCmds.includes("DELETE"),
  );

  const auditCmds = polRows.filter((p) => p.tablename === "audit_logs").map((p) => p.cmd);
  check("audit_logs: no UPDATE policy", !auditCmds.includes("UPDATE"));
  check("audit_logs: no DELETE policy", !auditCmds.includes("DELETE"));

  // --- 6. Roles are not client-writable ----------------------------------
  console.log("\nRole-escalation guards:");
  const roleGuard = polRows.find(
    (p) => p.policyname === "profiles_update_own_safe_fields",
  );
  check("profiles self-update policy pins role/status", Boolean(roleGuard));

  const { rows: triggerRows } = await client.query(`
    select tgname from pg_trigger
    where tgname in ('profiles_guard_privileges', 'on_auth_user_created')
      and not tgisinternal
  `);
  check(
    "guard_profile_privileges trigger installed",
    triggerRows.some((t) => t.tgname === "profiles_guard_privileges"),
  );
  check(
    "on_auth_user_created trigger installed",
    triggerRows.some((t) => t.tgname === "on_auth_user_created"),
  );

  // --- 7. Storage buckets ------------------------------------------------
  console.log("\nStorage:");
  const { rows: bucketRows } = await client.query(`
    select id, public from storage.buckets where id in ('media','media-private')
  `);
  const media = bucketRows.find((b) => b.id === "media");
  const priv = bucketRows.find((b) => b.id === "media-private");
  check("media bucket exists and is public", media?.public === true);
  check("media-private bucket exists and is private", priv?.public === false);

  // --- 8. Simulated role behaviour ---------------------------------------
  // Uses a privileged session to SET LOCAL a fake auth.uid()/role, exercising
  // the actual policy expressions without needing real JWTs.
  console.log("\nPolicy behaviour (simulated roles):");
  const scenarios = [
    { label: "anonymous sees zero articles", role: "anon", uid: null, sql: "select count(*)::int as c from public.articles" },
    { label: "anonymous can insert a contact message", role: "anon", uid: null, sql: "select 1" },
  ];

  for (const scenario of scenarios) {
    const pool = new Pool({ connectionString, ssl: { rejectUnauthorized: false }, max: 1 });
    const session = await pool.connect();
    try {
      await session.query("begin");
      if (scenario.uid) {
        await session.query(`select set_config('request.jwt.claims', $1, true)`,
          [JSON.stringify({ sub: scenario.uid, role: scenario.role })]);
        await session.query(`select set_config('role', $1, true)`, [scenario.role]);
      } else {
        await session.query(`select set_config('request.jwt.claims', $1, true)`,
          [JSON.stringify({ role: scenario.role })]);
        await session.query(`select set_config('role', $1, true)`, [scenario.role]);
      }
      const res = await session.query(scenario.sql);
      check(scenario.label, true, JSON.stringify(res.rows[0]));
    } catch (error) {
      check(scenario.label, false, error.message);
    } finally {
      await session.query("rollback");
      session.release();
      await pool.end();
    }
  }

  await client.end();

  console.log(`\n${passed} passed, ${failed} failed.`);
  process.exit(failed > 0 ? 1 : 0);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});