import pg from "pg";

const { Client } = pg;
const c = new Client({
  connectionString: process.env.POSTGRES_URL_NON_POOLING.replace(/sslmode=[^&]*/, "sslmode=no-verify"),
  ssl: { rejectUnauthorized: false },
});
await c.connect();

const name = process.argv[2];
if (!name) {
  console.error("Usage: reset-migration.mjs <migration-filename>");
  process.exit(1);
}

const r = await c.query("delete from public.schema_migrations where name = $1 returning name", [name]);
console.log(r.rowCount > 0 ? `Cleared applied record for ${name}` : `No record for ${name}`);
await c.end();