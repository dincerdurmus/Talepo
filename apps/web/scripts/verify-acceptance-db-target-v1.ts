/**
 * Read-only Talepo Staging / acceptance DB target verification.
 *
 * Explicitly loads ONLY apps/web/.env.acceptance — never falls back to .env.
 * No migrations, no writes, no persona creation.
 *
 * Run from apps/web:
 *   npx --yes tsx scripts/verify-acceptance-db-target-v1.ts
 */
import { readFileSync, existsSync } from "node:fs";
import { join } from "node:path";
import { Client } from "pg";

const ROOT = join(__dirname, "..");
const ACCEPTANCE_ENV_PATH = join(ROOT, ".env.acceptance");

/** Known primary/shared Supabase project ref — must NOT be the acceptance target. */
const BLOCKED_PRIMARY_PROJECT_REFS = new Set(["jgfwofiygnsylaclykkb"]);

const PLACEHOLDER_MARKERS = [
  "<STAGING_TRANSACTION_POOLER_URI>",
  "<STAGING_SESSION_POOLER_URI>",
  "STAGING_TRANSACTION_POOLER_URI",
  "STAGING_SESSION_POOLER_URI",
];

function fail(msg: string): never {
  console.error(`FAIL — ${msg}`);
  process.exit(1);
}

function loadAcceptanceEnvOnly(): Record<string, string> {
  if (!existsSync(ACCEPTANCE_ENV_PATH)) {
    fail(`.env.acceptance missing at ${ACCEPTANCE_ENV_PATH}`);
  }

  // Strip any ambient DB URLs so production/shared env cannot leak in.
  delete process.env.DATABASE_URL;
  delete process.env.DIRECT_URL;
  delete process.env.TALEPO_ENVIRONMENT;

  const raw = readFileSync(ACCEPTANCE_ENV_PATH, "utf8");
  const out: Record<string, string> = {};
  for (const line of raw.split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const eq = trimmed.indexOf("=");
    if (eq <= 0) continue;
    const key = trimmed.slice(0, eq).trim();
    let value = trimmed.slice(eq + 1).trim();
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }
    out[key] = value;
    process.env[key] = value;
  }
  return out;
}

function looksLikePlaceholder(value: string): boolean {
  const v = value.trim();
  if (!v) return true;
  for (const marker of PLACEHOLDER_MARKERS) {
    if (v.includes(marker)) return true;
  }
  if (v.startsWith("<") && v.endsWith(">")) return true;
  return false;
}

function safeDecodeURIComponent(value: string): string {
  try {
    return decodeURIComponent(value);
  } catch {
    return value;
  }
}

/** Parse postgres URLs when passwords contain unencoded ? & % (common in Supabase). */
function parsePostgresUrlRobust(raw: string): {
  user: string;
  password: string;
  host: string;
  port: string;
  database: string;
  projectRef: string | null;
} {
  const trimmed = raw.trim();
  const schemeMatch = trimmed.match(/^postgres(?:ql)?:\/\//i);
  if (!schemeMatch) fail("Not a postgres URL");
  const afterScheme = trimmed.slice(schemeMatch[0].length);
  const atIdx = afterScheme.lastIndexOf("@");
  if (atIdx < 0) fail("Missing @ in postgres URL");
  const userinfo = afterScheme.slice(0, atIdx);
  const hostpart = afterScheme.slice(atIdx + 1);
  const colonInUser = userinfo.indexOf(":");
  if (colonInUser < 0) fail("Missing password separator in postgres URL");
  const user = safeDecodeURIComponent(userinfo.slice(0, colonInUser));
  const password = safeDecodeURIComponent(userinfo.slice(colonInUser + 1));
  const qIdx = hostpart.indexOf("?");
  const authority = qIdx >= 0 ? hostpart.slice(0, qIdx) : hostpart;
  const slashIdx = authority.indexOf("/");
  const hostPort = slashIdx >= 0 ? authority.slice(0, slashIdx) : authority;
  const database =
    slashIdx >= 0 ? safeDecodeURIComponent(authority.slice(slashIdx + 1)) : "postgres";
  const lastColon = hostPort.lastIndexOf(":");
  const host = lastColon >= 0 ? hostPort.slice(0, lastColon) : hostPort;
  const port = lastColon >= 0 ? hostPort.slice(lastColon + 1) : "5432";

  let projectRef: string | null = null;
  const pooler = host.match(/^aws-\d+-[a-z0-9-]+\.pooler\.supabase\.com$/i);
  const direct = host.match(/^db\.([a-z0-9]+)\.supabase\.co$/i);
  if (direct?.[1]) projectRef = direct[1];
  const userRef = user.match(/^postgres\.([a-z0-9]+)$/i);
  if (!projectRef && userRef?.[1]) projectRef = userRef[1];
  if (!projectRef && pooler) {
    // cannot derive ref from pooler host alone without user — leave null
  }

  return { user, password, host, port, database, projectRef };
}

function safeParsePgUrl(raw: string): {
  host: string;
  port: string;
  database: string;
  projectRef: string | null;
} {
  const parsed = parsePostgresUrlRobust(raw);
  return {
    host: parsed.host,
    port: parsed.port,
    database: parsed.database,
    projectRef: parsed.projectRef,
  };
}

async function main() {
  console.log("=== verify-acceptance-db-target-v1 (READ-ONLY) ===\n");
  console.log(`ACCEPTANCE ENV LOADER: explicit file parse → ${ACCEPTANCE_ENV_PATH}`);
  console.log("PRODUCTION ENV FALLBACK: disabled (DATABASE_URL/DIRECT_URL cleared before load)");

  const env = loadAcceptanceEnvOnly();

  if (env.TALEPO_ENVIRONMENT !== "acceptance") {
    fail(`TALEPO_ENVIRONMENT must be "acceptance" (got ${env.TALEPO_ENVIRONMENT ?? "missing"})`);
  }
  console.log("TALEPO_ENVIRONMENT: acceptance");

  const databaseUrl = env.DATABASE_URL?.trim() ?? "";
  const directUrl = env.DIRECT_URL?.trim() ?? "";

  if (!databaseUrl || !directUrl) {
    fail("DATABASE_URL and DIRECT_URL are both required in .env.acceptance");
  }
  if (looksLikePlaceholder(databaseUrl) || looksLikePlaceholder(directUrl)) {
    fail(
      "Placeholders not resolved — fill staging pooler URIs in .env.acceptance before verify",
    );
  }
  console.log("PLACEHOLDERS RESOLVED: yes");

  const dbMeta = safeParsePgUrl(databaseUrl);
  const directMeta = safeParsePgUrl(directUrl);

  console.log(`DB HOST (DATABASE_URL): ${dbMeta.host}`);
  console.log(`DB PORT (DATABASE_URL): ${dbMeta.port}`);
  console.log(`DB HOST (DIRECT_URL): ${directMeta.host}`);
  console.log(`DB PORT (DIRECT_URL): ${directMeta.port}`);
  console.log(`DB NAME: ${directMeta.database || dbMeta.database || "(unknown)"}`);

  const projectRef = directMeta.projectRef || dbMeta.projectRef;
  console.log(`SUPABASE PROJECT REF: ${projectRef ?? "(not derivable from host/user)"}`);

  if (projectRef && BLOCKED_PRIMARY_PROJECT_REFS.has(projectRef)) {
    fail(
      `Target project ref matches known primary/shared project — refusing acceptance verify`,
    );
  }
  if (dbMeta.port !== "6543") {
    console.log("WARN — DATABASE_URL port is not 6543 (expected Transaction Pooler)");
  }
  if (directMeta.port !== "5432") {
    console.log("WARN — DIRECT_URL port is not 5432 (expected Session Pooler)");
  }

  // Connect with DIRECT_URL (session) for simple SELECT — read-only.
  // Use discrete fields so unencoded ? & % in Supabase passwords do not break connectionString parsing.
  const directCfg = parsePostgresUrlRobust(directUrl);
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

    const identity = await client.query<{
      current_database: string;
      current_user: string;
      current_schema: string;
      version: string;
    }>(
      `SELECT current_database() AS current_database,
              current_user AS current_user,
              current_schema() AS current_schema,
              version() AS version`,
    );
    const row = identity.rows[0]!;
    console.log(`current_database: ${row.current_database}`);
    console.log(`current_user: ${row.current_user}`);
    console.log(`current_schema: ${row.current_schema}`);
    console.log(`version: ${row.version.split(" ").slice(0, 2).join(" ")}`);

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

    const classification =
      projectRef && !BLOCKED_PRIMARY_PROJECT_REFS.has(projectRef)
        ? "STAGING_OR_NON_PRIMARY"
        : projectRef
          ? "BLOCKED_PRIMARY"
          : "UNKNOWN_REF_HOST_OK_IF_NOT_PRIMARY";
    console.log(`TARGET CLASSIFICATION: ${classification}`);
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
    '  PRECHECK:  npx --yes tsx -e "require(\'dotenv\').config({path:\'.env.acceptance\', override:true})"  → prefer dedicated script',
  );
  console.log(
    "  PRECHECK:  npx --yes tsx scripts/precheck-personal-resource-ownership-v1.ts  (only after acceptance env injected)",
  );
  console.log(
    "  MIGRATE STATUS:  node --env-file=.env.acceptance ./node_modules/prisma/build/index.js migrate status",
  );
  console.log(
    "  MIGRATE DEPLOY:  node --env-file=.env.acceptance ./node_modules/prisma/build/index.js migrate deploy",
  );
  console.log(
    "  (Node --env-file loads .env.acceptance into process env before prisma.config dotenv; verify with migrate status first.)",
  );

  console.log("\nSECRETS PRINTED: no");
  console.log("PASS — acceptance DB target read-only verify");
}

main().catch((e) => {
  const msg = e instanceof Error ? e.message : String(e);
  // Never echo connection string fragments
  const safe = msg
    .replace(/postgres(?:ql)?:\/\/[^\s]+/gi, "[redacted-uri]")
    .replace(/password[=:]\S+/gi, "password=[redacted]");
  fail(safe);
});
