import { config } from "dotenv";
import pg from "pg";

config({ path: ".env" });
config({ path: ".env.local", override: false });

const targets = [
  ["DATABASE_URL (pooler 6543)", process.env.DATABASE_URL],
  ["DIRECT_URL", process.env.DIRECT_URL],
  [
    "SESSION_POOLER (5432)",
    process.env.DATABASE_URL?.replace(":6543", ":5432").replace("?pgbouncer=true", ""),
  ],
];

function maskUrl(url) {
  if (!url) return "(missing)";
  return url.replace(/:([^:@/]+)@/, ":***@");
}

for (const [label, connectionString] of targets) {
  console.log(`\n--- ${label} ---`);
  console.log(`URL: ${maskUrl(connectionString)}`);

  if (!connectionString) {
    console.log("RESULT: missing");
    continue;
  }

  const client = new pg.Client({ connectionString, connectionTimeoutMillis: 10000 });

  try {
    await client.connect();
    const result = await client.query("SELECT current_database() AS db, current_user AS usr");
    console.log("RESULT: ok");
    console.log(`DB: ${result.rows[0].db}, user: ${result.rows[0].usr}`);

    const tables = await client.query(`
      SELECT tablename
      FROM pg_tables
      WHERE schemaname = 'public'
      ORDER BY tablename
      LIMIT 10
    `);
    console.log(`Tables (first 10): ${tables.rows.map((r) => r.tablename).join(", ") || "(none)"}`);
  } catch (error) {
    console.log("RESULT: failed");
    console.log(`Error: ${error instanceof Error ? error.message : String(error)}`);
  } finally {
    await client.end().catch(() => undefined);
  }
}
