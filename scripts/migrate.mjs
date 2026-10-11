/**
 * Migration runner.
 *
 * Applies every checked-in migration in `supabase/migrations` to the database
 * in POSTGRES_URL_NON_POOLING, in filename order, tracking applied files in a
 * `public.schema_migrations` table so re-runs are idempotent.
 *
 * Usage:
 *   node --env-file=.env.local scripts/migrate.mjs
 *   node --env-file=.env.local scripts/migrate.mjs --status
 *
 * NEVER put credentials in this file or in the repository.
 */

import { readdir, readFile } from "node:fs/promises";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import pg from "pg";

const { Client } = pg;

const here = dirname(fileURLToPath(import.meta.url));
const migrationsDir = join(here, "..", "supabase", "migrations");

const connectionString =
  process.env.POSTGRES_URL_NON_POOLING ??
  process.env.POSTGRES_URL ??
  process.env.DATABASE_URL;

if (!connectionString) {
  console.error(
    "No database connection string found. Set POSTGRES_URL_NON_POOLING in .env.local",
  );
  process.exit(1);
}

async function main() {
  const statusOnly = process.argv.includes("--status");

  const client = new Client({
    // Supabase presents a self-signed certificate chain; we rely on transport
    // encryption rather than public-CA verification for the direct connection.
    // For strict verification, use the direct host and Supabase's CA bundle.
    connectionString: connectionString.replace(/sslmode=[^&]*/, "sslmode=no-verify"),
    ssl: { rejectUnauthorized: false },
  });

  await client.connect();
  console.log("Connected to database.");

  await client.query(`
    create table if not exists public.schema_migrations (
      name text primary key,
      applied_at timestamptz not null default now()
    );
  `);

  const applied = new Set(
    (await client.query("select name from public.schema_migrations")).rows.map(
      (row) => row.name,
    ),
  );

  const files = (await readdir(migrationsDir))
    .filter((file) => file.endsWith(".sql"))
    .sort();

  const pending = files.filter((file) => !applied.has(file));

  if (statusOnly) {
    console.log(`\nApplied (${applied.size}):`);
    for (const file of files.filter((f) => applied.has(f))) {
      console.log(`  ✓ ${file}`);
    }
    console.log(`\nPending (${pending.length}):`);
    for (const file of pending) {
      console.log(`  · ${file}`);
    }
    await client.end();
    return;
  }

  if (pending.length === 0) {
    console.log("No pending migrations. Database is up to date.");
    await client.end();
    return;
  }

  for (const file of pending) {
    const sql = await readFile(join(migrationsDir, file), "utf8");
    process.stdout.write(`Applying ${file} ... `);
    try {
      await client.query("begin");
      await client.query(sql);
      await client.query(
        "insert into public.schema_migrations (name) values ($1)",
        [file],
      );
      await client.query("commit");
      console.log("ok");
    } catch (error) {
      await client.query("rollback");
      console.log("FAILED");
      console.error(`\n${file} failed:\n${error.message}`);
      await client.end();
      process.exit(1);
    }
  }

  console.log(`\nApplied ${pending.length} migration(s).`);
  await client.end();
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});