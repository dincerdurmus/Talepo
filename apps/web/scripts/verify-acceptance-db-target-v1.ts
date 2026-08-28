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
import { Client, type ClientConfig } from "pg";

import {
  evaluateAcceptanceDbTarget,
  isRecognisedSupabaseHost,
  parseAcceptancePostgresUrl,
} from "./lib/acceptance-db-target-v1";
import { loadAcceptanceEnv } from "./lib/load-acceptance-env";
import { formatAcceptanceError, redactAcceptanceOutput } from "./lib/acceptance-redaction-v1";
import { isAcceptanceCliEntrypoint } from "./lib/acceptance-cli-entry-v1";
import {
  ACCEPTANCE_CA_FINGERPRINT_KEY,
  type CaDecision,
  loadAcceptanceCa,
} from "./lib/acceptance-ca-v1";
/**
 * Product modules are bound inside main(), AFTER the env is verified. These two
 * are leaf modules today, but the rule is structural: no CLI in this harness
 * loads product code before the target is known.
 */
let REQUEST_CATEGORIES!: typeof import("../src/lib/request-category-engine").REQUEST_CATEGORIES;
let excludeSystemCategories!: typeof import("../src/lib/request/raw-input").excludeSystemCategories;
let isSystemCategorySlug!: typeof import("../src/lib/request/raw-input").isSystemCategorySlug;

/** Bind every runtime product export. Called only after the env is verified. */
async function bindProductModules(): Promise<void> {
  ({ REQUEST_CATEGORIES } = await import("../src/lib/request-category-engine"));
  ({ excludeSystemCategories, isSystemCategorySlug } = await import("../src/lib/request/raw-input"));
}

const TRANSACTION_POOLER_PORT = "6543";
const SESSION_POOLER_PORT = "5432";

/** Safe host classification — the address itself is never printed. */
function hostType(host: string): string {
  return isRecognisedSupabaseHost(host) ? "RECOGNISED_SUPABASE" : "UNRECOGNISED";
}

/**
 * The TLS options this verifier connects with.
 *
 * There is no parameter and no environment flag. An earlier version accepted
 * ACCEPTANCE_DB_TLS_INSECURE=1 and turned `rejectUnauthorized` off — on the one
 * script whose entire purpose is proving which server answered, which is exactly
 * where an unverified connection is least acceptable. Exported so a gate can ask
 * for the options under any environment and observe that the answer never moves.
 */
export function buildAcceptanceTlsOptions(
  host: string,
  ca?: string,
): { rejectUnauthorized: true; servername: string; ca?: string } {
  // `ca` REPLACES Node's default root list rather than adding to it — which is
  // exactly what pinning wants: the only anchor is the one the operator verified
  // by fingerprint. It never relaxes anything; the chain and the hostname are
  // still checked, so this makes verification possible rather than optional.
  return ca === undefined
    ? { rejectUnauthorized: true, servername: host }
    : { rejectUnauthorized: true, servername: host, ca };
}

function fail(msg: string): never {
  console.error(`FAIL — ${redactAcceptanceOutput(msg)}`);
  process.exit(1);
}

/**
 * What a client would be built from — returned rather than built, so the
 * boundary can be DRIVEN.
 *
 * The previous gate compared the offset of "loadAcceptanceCa(" with the offset
 * of "new Client(" in this file's own source. That measured where two strings
 * sit: deleting the refusal, or dropping the CA out of the ssl options, both
 * left it green. A plan can be inspected instead of read.
 */
export type AcceptanceClientPlan =
  | { outcome: "refused"; reason: string }
  | { outcome: "connect"; config: ClientConfig };

export function planAcceptanceClient(
  meta: { user: string; password: string; host: string; port: string; database: string },
  // The CANONICAL decision type, not a local restatement of its shape. Written
  // out by hand as `{ ok: boolean; pem?: string }`, the discriminated union
  // flattens and `ok: true` no longer implies a certificate is present.
  ca: CaDecision,
): AcceptanceClientPlan {
  // No verified CA, no client. Not a weaker connection, not a retry: nothing is
  // constructed at all, so there is no object left that could be connected.
  //
  // Blank counts as absent. Node reads a falsy `ca` as "use the default trust
  // store", so an empty string would quietly restore every public root while the
  // options still read `rejectUnauthorized: true` — the pin gone, and the output
  // still saying the server is verified. A whitespace-only file is the same
  // thing with the falsiness hidden one step further away.
  if (!ca.ok || typeof ca.pem !== "string" || ca.pem.trim() === "") {
    return {
      outcome: "refused",
      reason: ca.ok ? "CA_NOT_VALID_PEM" : ca.reason,
    };
  }
  return {
    outcome: "connect",
    config: {
      user: meta.user,
      password: meta.password,
      host: meta.host,
      port: Number(meta.port),
      database: meta.database,
      connectionTimeoutMillis: 15000,
      statement_timeout: 15000,
      query_timeout: 15000,
      // Discrete fields, not a connection string: a query parameter cannot reach
      // in and replace the ssl object that was just decided.
      ssl: buildAcceptanceTlsOptions(meta.host, ca.pem),
    },
  };
}

/**
 * The whole ordered sequence — load the CA, plan, build ONE client, connect,
 * prove the session — behind a single call that can be driven.
 *
 * Extracted because the order was the part nothing measured. A client built
 * before the refusal was read would have been caught only by a type error, and
 * nothing in this repository runs tsc over `scripts/` (that gap is its own open
 * work, not something this function claims to have closed). With the client
 * factory injected, a gate can watch whether a process was ever created on a
 * path that should have refused.
 *
 * The dependencies are typed, not widened: a `Record<string, unknown>` or an
 * `any` here would hand back exactly the checking this extraction exists to make
 * observable.
 */
/**
 * The three methods this sequence uses, borrowed from `pg`'s own Client rather
 * than restated. A hand-written shape would be a second, drifting description of
 * an interface that already exists — and the real Client would stop satisfying
 * it the moment either side moved.
 */
export type AcceptanceSessionClient = Pick<Client, "connect" | "query" | "end">;

export type AcceptanceSessionEvent = "client-created" | "connect" | "identity" | "close";

export type AcceptanceSessionDeps<TClient extends AcceptanceSessionClient> = {
  loadCa: () => CaDecision;
  createClient: (config: ClientConfig) => TClient;
  onEvent?: (event: AcceptanceSessionEvent) => void;
};

export type AcceptanceSessionResult<TClient extends AcceptanceSessionClient> =
  | { outcome: "refused"; reason: string; detail: string }
  | { outcome: "open"; client: TClient; identityOk: boolean; close: () => Promise<void> };

// Generic over the client the caller builds, so production keeps the real
// `Client` (and everything downstream still type-checks against it) while a test
// can inject its own — without either side being widened to satisfy the other.
/**
 * Close and swallow. Written with try/catch rather than `.catch()` because a
 * client whose `end()` throws SYNCHRONOUSLY — or returns no promise at all —
 * would otherwise replace the failure being handled with its own.
 */
async function closeQuietly(client: AcceptanceSessionClient): Promise<void> {
  try {
    await client.end();
  } catch {
    // Deliberately dropped; the caller is already throwing something better.
  }
}

export async function openAcceptanceSession<TClient extends AcceptanceSessionClient>(
  meta: { user: string; password: string; host: string; port: string; database: string },
  deps: AcceptanceSessionDeps<TClient>,
): Promise<AcceptanceSessionResult<TClient>> {
  const ca = deps.loadCa();
  if (!ca.ok) {
    return { outcome: "refused", reason: ca.reason, detail: ca.detail };
  }
  const plan = planAcceptanceClient(meta, ca);
  if (plan.outcome === "refused") {
    // Read before anything is built: the refusal is the reason no client exists,
    // not a check applied to one that already does.
    return {
      outcome: "refused",
      reason: plan.reason,
      detail: "the acceptance CA was not verified",
    };
  }

  let identityOk = false;
  const client = deps.createClient(plan.config);
  deps.onEvent?.("client-created");
  try {
    await client.connect();
    deps.onEvent?.("connect");
    // Read-only identity round trip: it proves the session works and returns
    // nothing that names the target.
    // The answer is carried out, not discarded. Printing a fixed "ok" after a
    // query nobody looked at would be a status the run never earned.
    const identity = await client.query<{ ok: number }>("SELECT 1 AS ok");
    identityOk = identity.rows[0]?.ok === 1;
    deps.onEvent?.("identity");
  } catch (error) {
    // A client that exists holds the acceptance credential against a socket, so
    // closing it is part of the failure rather than cleanup after it. The close
    // is attempted and its own error is DROPPED: the connect or query failure is
    // what the operator needs, and a close error reported in its place would
    // describe the second symptom while hiding the first.
    await closeQuietly(client);
    deps.onEvent?.("close");
    throw error;
  }
  return {
    outcome: "open",
    client,
    identityOk,
    // Closing a session that DID work is different: there is no earlier failure
    // to protect, so a close error is the only failure there is and must be seen.
    close: async () => {
      await client.end();
      deps.onEvent?.("close");
    },
  };
}

async function main() {
  console.log("=== verify-acceptance-db-target-v1 (READ-ONLY) ===\n");
  console.log("ACCEPTANCE ENV LOADER: explicit acceptance-only parse");
  console.log("PRODUCTION ENV FALLBACK: disabled (DATABASE_URL/DIRECT_URL cleared before load)");

  // One loader for the whole harness: this verifier no longer keeps a private
  // copy that could drift from the guard every other script goes through.
  loadAcceptanceEnv();
  await bindProductModules();
  const env = process.env as Record<string, string>;

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

  // One ordered call. Everything between the CA and a working session lives in
  // openAcceptanceSession, so the order is a thing a gate can watch rather than
  // a thing a reader has to trust.
  const session = await openAcceptanceSession(directCfg, {
    loadCa: () => loadAcceptanceCa({ expectedFingerprint: process.env[ACCEPTANCE_CA_FINGERPRINT_KEY] }),
    createClient: (config) => new Client(config),
  });
  console.log("TLS VERIFICATION: enabled (not switchable)");
  if (session.outcome === "refused") {
    console.log("ACCEPTANCE CA: refused");
    fail(`${session.reason} — ${session.detail}`);
  }
  console.log("ACCEPTANCE CA: pinned and fingerprint-matched");
  const client = session.client;
  const closeSession = session.close;

  let migrationTableExists = false;
  let migrationCount: number | null = null;
  let appTablesExist = false;
  let appTableSample: string[] = [];

  try {
    console.log("DB CONNECTION: ok");
    console.log(`IDENTITY QUERY: ${session.identityOk ? "ok" : "unexpected"}`);

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

    // Global taxonomy check. The expected key set is DERIVED from the canonical
    // registry, never restated here, so a registry edit surfaces as drift
    // instead of silently disagreeing with the acceptance database.
    //
    // Skipped before the schema exists: this verifier is the FIRST step of the
    // bootstrap (target → migrate → seed), and it must still classify the
    // target on a fresh, unmigrated project instead of dying on a missing table.
    if (!migrationTableExists || !appTablesExist) {
      console.log("CATEGORY DRIFT: not measured (schema not deployed yet)");
    } else {
      await verifyCategoryRegistry(client);
    }

    console.log("TARGET CLASSIFICATION: ACCEPTANCE_ALLOWLISTED");
    console.log("PRIMARY/PRODUCTION PROJECT USED: no");
    console.log("READ-ONLY QUERIES ONLY: yes");
    console.log("DB WRITE: no");
    console.log("MIGRATION RUN: no");
    console.log("USERS CREATED: 0");
  } finally {
    // Through the session, so the close is the same one the gates observe.
    await closeSession().catch((closeError: unknown) => {
      console.error(`WARN — ${formatAcceptanceError(closeError, "close")}`);
    });
  }

  console.log("\nSAFE FUTURE COMMANDS (do not run in this phase):");
  console.log(
    "  PRECHECK:  npx --yes tsx scripts/precheck-personal-resource-ownership-v1.ts  (only after acceptance env injected)",
  );
  // Offered with its current state attached: the command exists but refuses to
  // run while the schema engine's TLS behaviour is unmeasured. Naming it without
  // that would send the operator at a door that is closed.
  console.log("  MIGRATE STATUS:  npm run acceptance:migrate-status (CLOSED — Prisma TLS verification NOT MEASURED)");
  console.log(
    "  MIGRATE DEPLOY:  npx --yes tsx scripts/run-acceptance-prisma-v1.ts deploy --apply",
  );
  console.log(
    "  (Always via the wrapper: prisma.config.ts imports dotenv/config, so a plain prisma command reads the ambient .env.)",
  );

  console.log("\nSECRETS PRINTED: no");
  console.log("PASS — acceptance DB target read-only verify");
}

/** Read-only drift check of the global taxonomy against the canonical registry. */
async function verifyCategoryRegistry(client: Client): Promise<void> {
  const expectedCategorySlugs = new Set(REQUEST_CATEGORIES.map((meta) => meta.id));
  {
    const categoryRows = await client.query<{ slug: string; isActive: boolean }>(
      `SELECT slug, "isActive" FROM "Category" ORDER BY slug`,
    );
    // `unresolved` is a legitimate system row that is deliberately absent from
    // the registry; the repository already owns that distinction, so filter
    // through it instead of teaching this verifier a second rule.
    const actualCategorySlugs = new Set(
      excludeSystemCategories(categoryRows.rows).map((row) => row.slug),
    );
    const systemCategoryCount = categoryRows.rows.filter((row) =>
      isSystemCategorySlug(row.slug),
    ).length;
    const missingCategories = [...expectedCategorySlugs].filter(
      (slug) => !actualCategorySlugs.has(slug),
    );
    const extraCategories = [...actualCategorySlugs].filter(
      (slug) => !expectedCategorySlugs.has(slug),
    );
    console.log(`CATEGORY REGISTRY KEYS: ${expectedCategorySlugs.size}`);
    console.log(`CATEGORY ROWS: ${actualCategorySlugs.size}`);
    console.log(`CATEGORY SYSTEM ROWS: ${systemCategoryCount}`);
    console.log(`CATEGORY INACTIVE ROWS: ${categoryRows.rows.filter((r) => !r.isActive).length}`);
    console.log(`CATEGORY MISSING: ${missingCategories.length ? missingCategories.join(", ") : "none"}`);
    console.log(`CATEGORY EXTRA: ${extraCategories.length ? extraCategories.join(", ") : "none"}`);
    if (missingCategories.length > 0 || extraCategories.length > 0) {
      fail("Category rows drifted from the canonical request category registry");
    }
  }
}

// Inert on import: only the started process runs. Importing this file to reach
// one exported helper must never launch the scenario it drives.
if (isAcceptanceCliEntrypoint(module)) {
  main().catch((e) => {
    // Shared formatter: class + short redacted message, never a raw error or stack.
    console.error(`FAIL — ${formatAcceptanceError(e)}`);
    process.exit(1);
  });
}
