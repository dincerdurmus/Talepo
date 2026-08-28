/**
 * Read-only acceptance DB target verification.
 *
 * Reads ONLY apps/web/.env.acceptance — never falls back to .env — and takes its
 * accept/reject decision from the canonical guard in
 * scripts/lib/acceptance-db-target-v1.ts. It keeps no second copy of the project
 * ref list, the URL parser or the env file parser.
 *
 * No migrations, no writes, no persona creation.
 *
 * Run from apps/web:
 *   npx --yes tsx scripts/verify-acceptance-db-target-v1.ts
 */
import { Client } from "pg";

import {
  evaluateAcceptanceDbTarget,
  isRecognisedSupabaseHost,
  parseAcceptancePostgresUrl,
} from "./lib/acceptance-db-target-v1";
import {
  ACCEPTANCE_ENV_PATH,
  acceptanceEnvFileExists,
  readAcceptanceEnvFile,
} from "./lib/acceptance-env-file-v1";
import { redactPrismaOutput } from "./run-acceptance-prisma-v1";

const TRANSACTION_POOLER_PORT = "6543";
const SESSION_POOLER_PORT = "5432";

/** Safe host classification — the address itself is never printed. */
function hostType(host: string): string {
  return isRecognisedSupabaseHost(host) ? "RECOGNISED_SUPABASE" : "UNRECOGNISED";
}

function fail(msg: string): never {
  console.error(`FAIL — ${redactPrismaOutput(msg)}`);
  process.exit(1);
}

/** Read the acceptance env file and apply it, after clearing ambient DB URLs. */
function loadAcceptanceEnvOnly(): Record<string, string> {
  if (!acceptanceEnvFileExists()) {
    fail(`.env.acceptance missing at ${ACCEPTANCE_ENV_PATH}`);
  }

  // Strip any ambient DB URLs so production/shared env cannot leak in.
  delete process.env.DATABASE_URL;
  delete process.env.DIRECT_URL;
  delete process.env.TALEPO_ENVIRONMENT;

  const out = readAcceptanceEnvFile();
  for (const [key, value] of Object.entries(out)) {
    process.env[key] = value;
  }
  return out;
}

async function main() {
  console.log("=== verify-acceptance-db-target-v1 (READ-ONLY) ===\n");
  console.log(`ACCEPTANCE ENV LOADER: explicit file parse → ${ACCEPTANCE_ENV_PATH}`);
  console.log("PRODUCTION ENV FALLBACK: disabled (DATABASE_URL/DIRECT_URL cleared before load)");

  const env = loadAcceptanceEnvOnly();

  const decision = evaluateAcceptanceDbTarget(env);
  if (!decision.ok) {
    fail(`${decision.reason} — ${decision.detail}`);
  }
  console.log("TALEPO_ENVIRONMENT: acceptance");
  console.log("PLACEHOLDERS RESOLVED: yes");

  const dbMeta = parseAcceptancePostgresUrl(env.DATABASE_URL ?? "")!;
  const directMeta = parseAcceptancePostgresUrl(env.DIRECT_URL ?? "")!;

  // Only safe classifications are printed. The host, port, database name,
  // project ref and session identity of the target are deliberately absent:
  // this output is pasted into reports, and a target's address is not a
  // classification. Whether the target is the right one is already decided by
  // the canonical guard above — printing its address adds no verification value.
  console.log(`DATABASE_URL: URL_PRESENT=yes HOST_TYPE=${hostType(dbMeta.host)}`);
  console.log(`DIRECT_URL: URL_PRESENT=yes HOST_TYPE=${hostType(directMeta.host)}`);
  console.log(`SAME_PROJECT: ${dbMeta.projectRef === directMeta.projectRef ? "yes" : "no"}`);

  if (dbMeta.port !== TRANSACTION_POOLER_PORT) {
    console.log("WARN — DATABASE_URL is not on the expected transaction pooler port");
  }
  if (directMeta.port !== SESSION_POOLER_PORT) {
    console.log("WARN — DIRECT_URL is not on the expected session pooler port");
  }

  // Connect with DIRECT_URL (session) for simple SELECT — read-only.
  // Use discrete fields so unencoded ? & % in Supabase passwords do not break connectionString parsing.
  const directCfg = directMeta;
  const client = new Client({
    user: directCfg.user,
    password: directCfg.password,
    host: directCfg.host,
    port: Number(directCfg.port),
    database: directCfg.database,
    connectionTimeoutMillis: 15000,
    statement_timeout: 15000,
    query_timeout: 15000,
    ssl: { rejectUnauthorized: false },
  });

  let migrationTableExists = false;
  let migrationCount: number | null = null;
  let appTablesExist = false;
  let appTableSample: string[] = [];

  try {
    await client.connect();
    console.log("DB CONNECTION: ok");

    // The identity round-trip proves the session works; its values name the
    // target and the login role, so only the fact that it succeeded is printed.
    const identity = await client.query<{ ok: number }>(`SELECT 1 AS ok`);
    console.log(`IDENTITY QUERY: ${identity.rows[0]?.ok === 1 ? "ok" : "unexpected"}`);

    const mig = await client.query<{ exists: boolean }>(
      `SELECT EXISTS (
         SELECT 1 FROM information_schema.tables
         WHERE table_schema = 'public' AND table_name = '_prisma_migrations'
       ) AS exists`,
    );
    migrationTableExists = Boolean(mig.rows[0]?.exists);
    console.log(`MIGRATION TABLE EXISTS: ${migrationTableExists}`);

    if (migrationTableExists) {
      const cnt = await client.query<{ c: string }>(
        `SELECT COUNT(*)::text AS c FROM "_prisma_migrations"`,
      );
      migrationCount = Number(cnt.rows[0]?.c ?? 0);
      console.log(`CURRENT MIGRATION COUNT: ${migrationCount}`);
    } else {
      console.log("CURRENT MIGRATION COUNT: n/a");
    }

    const tables = await client.query<{ table_name: string }>(
      `SELECT table_name
       FROM information_schema.tables
       WHERE table_schema = 'public'
         AND table_type = 'BASE TABLE'
         AND table_name IN ('User', 'Company', 'Request', 'Offer', 'SavedSearch', 'AlertRule')
       ORDER BY table_name`,
    );
    appTableSample = tables.rows.map((r) => r.table_name);
    appTablesExist = appTableSample.length > 0;
    console.log(
      `APPLICATION TABLES EXIST: ${appTablesExist ? `yes (${appTableSample.join(", ")})` : "no"}`,
    );

    console.log("TARGET CLASSIFICATION: ACCEPTANCE_ALLOWLISTED");
    console.log("PRIMARY/PRODUCTION PROJECT USED: no");
    console.log("READ-ONLY QUERIES ONLY: yes");
    console.log("DB WRITE: no");
    console.log("MIGRATION RUN: no");
    console.log("USERS CREATED: 0");
  } finally {
    await client.end().catch(() => undefined);
  }

  console.log("\nSAFE FUTURE COMMANDS (do not run in this phase):");
  console.log(
    "  PRECHECK:  npx --yes tsx scripts/precheck-personal-resource-ownership-v1.ts  (only after acceptance env injected)",
  );
  console.log("  MIGRATE STATUS:  npm run acceptance:migrate-status");
  console.log(
    "  MIGRATE DEPLOY:  npx --yes tsx scripts/run-acceptance-prisma-v1.ts deploy --apply",
  );
  console.log(
    "  (Always via the wrapper: prisma.config.ts imports dotenv/config, so a plain prisma command reads the ambient .env.)",
  );

  console.log("\nSECRETS PRINTED: no");
  console.log("PASS — acceptance DB target read-only verify");
}

main().catch((e) => {
  // fail() applies the shared redactor; driver errors often carry host and user.
  fail(e instanceof Error ? e.message : String(e));
});
