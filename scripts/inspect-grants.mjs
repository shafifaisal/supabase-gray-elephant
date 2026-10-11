import pg from "pg";

const { Client } = pg;
const c = new Client({
  connectionString: process.env.POSTGRES_URL_NON_POOLING.replace(/sslmode=[^&]*/, "sslmode=no-verify"),
  ssl: { rejectUnauthorized: false },
});
await c.connect();

const r = await c.query(`
  select table_name, string_agg(privilege_type, ',' order by privilege_type) as privs
  from information_schema.role_table_grants
  where table_schema = 'public' and grantee = 'anon'
  group by 1 order by 1
`);
console.log("--- ANON GRANTS ---");
console.table(r.rows);

const d = await c.query(`
  select defaclrole::regrole::text as role, defaclobjtype, defaclacl::text as acl
  from pg_default_acl where defaclnamespace = 'public'::regnamespace
`);
console.log("--- DEFAULT ACLs on public schema ---");
console.table(d.rows);

await c.end();