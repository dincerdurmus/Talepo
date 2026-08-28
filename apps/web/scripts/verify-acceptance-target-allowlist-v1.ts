/**
 * Acceptance DB target allowlist — fail-closed security verifier.
 *
 * Measures the REAL production decision (`evaluateAcceptanceDbTarget`) with
 * synthetic connection strings only. Never reads .env*, never connects to a
 * database, never prints a secret.
 *
 * Run from apps/web:
 *   npx --yes tsx scripts/verify-acceptance-target-allowlist-v1.ts
 */
import { readdirSync, readFileSync } from "node:fs";
import { createServer } from "node:net";
import { join } from "node:path";

import {
  ACCEPTANCE_PROJECT_REF,
  BLOCKED_PRIMARY_PROJECT_REFS,
  evaluateAcceptanceDbTarget,
} from "./lib/acceptance-db-target-v1";

const SCRIPTS_DIR = __dirname;
const problems: string[] = [];

function check(name: string, ok: boolean, detail: string): void {
  if (ok) {
    console.log(`  ok   ${name}`);
    return;
  }
  console.log(`  FAIL ${name} — ${detail}`);
  problems.push(name);
}

/** Strip block and line comments so source gates measure executable code, not prose. */
function stripComments(source: string): string {
  return source.replace(/\/\*[\s\S]*?\*\//g, " ").replace(/(^|[^:])\/\/[^\n]*/g, "$1 ");
}

/** Synthetic password; never a real credential. */
const PW = "synthetic-not-a-secret";
const ACCEPT = ACCEPTANCE_PROJECT_REF;
const PRIMARY = [...BLOCKED_PRIMARY_PROJECT_REFS][0]!;

function poolerUrl(ref: string, port = "6543"): string {
  return `postgresql://postgres.${ref}:${PW}@aws-0-eu-central-1.pooler.supabase.com:${port}/postgres`;
}
function directUrl(ref: string, port = "5432"): string {
  return `postgresql://postgres:${PW}@db.${ref}.supabase.co:${port}/postgres`;
}
function env(databaseUrl: string, directUrlValue: string, environment = "acceptance") {
  return {
    TALEPO_ENVIRONMENT: environment,
    DATABASE_URL: databaseUrl,
    DIRECT_URL: directUrlValue,
  };
}

function expectAccept(name: string, e: Record<string, string | undefined>): void {
  const decision = evaluateAcceptanceDbTarget(e);
  check(
    name,
    decision.ok && decision.projectRef === ACCEPT,
    decision.ok ? `accepted ref ${decision.projectRef}` : `rejected: ${decision.reason}`,
  );
}

function expectReject(name: string, e: Record<string, string | undefined>): void {
  const decision = evaluateAcceptanceDbTarget(e);
  check(name, !decision.ok, decision.ok ? `ACCEPTED (fail-open) ref=${decision.projectRef}` : "");
}

/** Occupy a port so the "already in use" branch can be measured for real. */
async function withOccupiedPort(port: number, run: () => Promise<void>): Promise<void> {
  const server = createServer();
  await new Promise<void>((resolve, reject) => {
    server.once("error", reject);
    server.listen(port, "127.0.0.1", () => resolve());
  });
  try {
    await run();
  } finally {
    await new Promise<void>((resolve) => server.close(() => resolve()));
  }
}

async function main(): Promise<void> {
  console.log("=== verify-acceptance-target-allowlist-v1 (NO DB, NO .env READ) ===\n");

  console.log("A. Allowed target");
  expectAccept("A1-pooler-plus-direct-acceptance-ref", env(poolerUrl(ACCEPT), directUrl(ACCEPT)));
  expectAccept("A2-direct-only-hosts-acceptance-ref", env(directUrl(ACCEPT), directUrl(ACCEPT)));
  expectAccept(
    "A3-uppercase-host-normalised",
    env(poolerUrl(ACCEPT), directUrl(ACCEPT).replace("db.", "DB.")),
  );

  console.log("\nB. Blocked primary project");
  expectReject("B1-primary-ref-direct", env(directUrl(PRIMARY), directUrl(PRIMARY)));
  expectReject("B2-primary-ref-pooler-user", env(poolerUrl(PRIMARY), poolerUrl(PRIMARY, "5432")));
  expectReject("B3-primary-ref-in-direct-only", env(poolerUrl(ACCEPT), directUrl(PRIMARY)));

  console.log("\nC. Foreign / unrecognised targets");
  expectReject("C1-other-supabase-ref", env(directUrl("abcdefghijklmnopqrst"), directUrl("abcdefghijklmnopqrst")));
  expectReject(
    "C2-neon-host",
    env(
      `postgresql://user:${PW}@ep-cool-shape-123456.eu-central-1.aws.neon.tech:5432/neondb`,
      `postgresql://user:${PW}@ep-cool-shape-123456.eu-central-1.aws.neon.tech:5432/neondb`,
    ),
  );
  expectReject(
    "C3-localhost",
    env(
      `postgresql://postgres:${PW}@localhost:5432/talepo`,
      `postgresql://postgres:${PW}@127.0.0.1:5432/talepo`,
    ),
  );
  expectReject(
    "C4-unknown-host-no-derivable-ref",
    env(
      `postgresql://postgres:${PW}@db.internal.example.com:5432/postgres`,
      `postgresql://postgres:${PW}@db.internal.example.com:5432/postgres`,
    ),
  );
  expectReject(
    "C5-ref-as-prefix-not-exact",
    env(directUrl(`${ACCEPT}x`), directUrl(`${ACCEPT}x`)),
  );
  expectReject(
    "C6-ref-as-suffix-not-exact",
    env(directUrl(`x${ACCEPT}`), directUrl(`x${ACCEPT}`)),
  );
  expectReject(
    "C7-acceptance-ref-only-inside-database-name",
    env(
      `postgresql://postgres:${PW}@db.internal.example.com:5432/${ACCEPT}`,
      `postgresql://postgres:${PW}@db.internal.example.com:5432/${ACCEPT}`,
    ),
  );
  expectReject("C8-mixed-urls-different-projects", env(poolerUrl(ACCEPT), directUrl("zzzzzzzzzzzzzzzzzzzz")));
  expectReject(
    "C9-acceptance-ref-in-user-but-foreign-host",
    env(
      `postgresql://postgres.${ACCEPT}:${PW}@evil.example.com:6543/postgres`,
      `postgresql://postgres.${ACCEPT}:${PW}@evil.example.com:5432/postgres`,
    ),
  );

  console.log("\nD. Missing / malformed input");
  expectReject("D1-missing-both", env("", ""));
  expectReject("D2-missing-direct", env(poolerUrl(ACCEPT), ""));
  expectReject("D3-placeholder", env("<STAGING_TRANSACTION_POOLER_URI>", "<STAGING_SESSION_POOLER_URI>"));
  expectReject("D4-not-postgres-scheme", env(`https://db.${ACCEPT}.supabase.co`, directUrl(ACCEPT)));
  expectReject(
    "D4b-unfilled-example-template",
    env(
      "postgresql://postgres.<ACCEPTANCE_PROJECT_REF>:<PASSWORD>@aws-0-<REGION>.pooler.supabase.com:6543/postgres",
      "postgresql://postgres.<ACCEPTANCE_PROJECT_REF>:<PASSWORD>@aws-0-<REGION>.pooler.supabase.com:5432/postgres",
    ),
  );
  expectReject("D5-no-scheme", env(`db.${ACCEPT}.supabase.co:5432`, directUrl(ACCEPT)));
  expectReject("D6-environment-missing", { DATABASE_URL: poolerUrl(ACCEPT), DIRECT_URL: directUrl(ACCEPT) });
  expectReject("D7-environment-production", env(poolerUrl(ACCEPT), directUrl(ACCEPT), "production"));

  console.log("\nE. Source invariants (no second authority, no env fallback)");
  const loaderSrc = stripComments(
    readFileSync(join(SCRIPTS_DIR, "lib", "load-acceptance-env.ts"), "utf8"),
  );
  const targetVerifierSrc = stripComments(
    readFileSync(join(SCRIPTS_DIR, "verify-acceptance-db-target-v1.ts"), "utf8"),
  );

  check(
    "E1-loader-has-no-dotenv-fallback",
    !/["'`]\.env["'`]|\.env\.local/.test(loaderSrc),
    "loader references .env or .env.local in executable code",
  );
  check(
    "E2-loader-clears-ambient-db-urls",
    /delete process\.env\.DATABASE_URL/.test(loaderSrc) &&
      /delete process\.env\.DIRECT_URL/.test(loaderSrc) &&
      /delete process\.env\.TALEPO_ENVIRONMENT/.test(loaderSrc),
    "loader does not clear ambient DATABASE_URL/DIRECT_URL/TALEPO_ENVIRONMENT",
  );
  check(
    "E3-loader-enforces-target-guard",
    /evaluateAcceptanceDbTarget/.test(loaderSrc),
    "loader does not enforce the canonical target guard — seed/cleanup could run against a foreign DB",
  );
  check(
    "E4-target-verifier-derives-from-canonical-module",
    /import\s*\{[^}]*evaluateAcceptanceDbTarget[^}]*\}\s*from\s*["'][^"']*acceptance-db-target-v1["']/.test(
      targetVerifierSrc,
    ),
    "verify-acceptance-db-target-v1 does not import the canonical guard decision",
  );
  check(
    "E5-no-second-copy-of-blocked-ref-list",
    !new RegExp(`["']${PRIMARY}["']`).test(targetVerifierSrc),
    "primary ref is hard-coded a second time outside the canonical module",
  );
  check(
    "E6-no-second-copy-of-acceptance-ref",
    !new RegExp(`["']${ACCEPT}["']`).test(targetVerifierSrc) &&
      !new RegExp(`["']${ACCEPT}["']`).test(loaderSrc),
    "acceptance ref is hard-coded a second time outside the canonical module",
  );

  console.log("\nF. Acceptance dev server port boundary");
  const devSrc = stripComments(readFileSync(join(SCRIPTS_DIR, "run-acceptance-dev-v1.ts"), "utf8"));
  let dev: typeof import("./run-acceptance-dev-v1") | null = null;
  try {
    // Importing must NOT load .env.acceptance, so this succeeds with no env file.
    dev = await import("./run-acceptance-dev-v1");
  } catch (error) {
    check(
      "F0-module-imports-without-env-file",
      false,
      error instanceof Error ? error.message : String(error),
    );
  }

  if (dev) {
    check("F0-module-imports-without-env-file", true, "");
    check(
      "F1-default-port-is-3187",
      dev.ACCEPTANCE_DEV_PORT === 3187,
      `port is ${dev.ACCEPTANCE_DEV_PORT}`,
    );
    check(
      "F2-nextauth-url-default-is-3187",
      dev.ACCEPTANCE_DEV_URL === "http://localhost:3187" &&
        dev.applyAcceptanceDevDefaults({}).NEXTAUTH_URL === "http://localhost:3187",
      "NEXTAUTH_URL default does not name port 3187",
    );
    const args = dev.buildNextDevArgs();
    check(
      "F3-next-receives-explicit-3187",
      args.includes("-p") && args[args.indexOf("-p") + 1] === "3187" && !args.includes("3000"),
      `args are ${args.join(" ")}`,
    );
    let refusedForeignUrl = false;
    try {
      dev.applyAcceptanceDevDefaults({ NEXTAUTH_URL: "http://localhost:3000" });
    } catch {
      refusedForeignUrl = true;
    }
    check(
      "F4-foreign-nextauth-port-refused",
      refusedForeignUrl,
      "a NEXTAUTH_URL naming another port was accepted silently",
    );

    let busyRejected = false;
    await withOccupiedPort(dev.ACCEPTANCE_DEV_PORT, async () => {
      try {
        await dev!.assertPortAvailable(dev!.ACCEPTANCE_DEV_PORT);
      } catch {
        busyRejected = true;
      }
    });
    check("F5-busy-port-fails-visibly", busyRejected, "an occupied 3187 did not fail");
    let freeAccepted = true;
    try {
      await dev.assertPortAvailable(dev.ACCEPTANCE_DEV_PORT);
    } catch {
      freeAccepted = false;
    }
    check("F6-free-port-accepted", freeAccepted, "a free 3187 was rejected");
  }

  check("F7-no-port-3000-literal", !/\b3000\b/.test(devSrc), "port 3000 still appears in the source");
  check(
    "F8-target-guard-runs-before-spawn",
    /await import\(\s*["']\.\/lib\/load-acceptance-env["']\s*\)/.test(devSrc) &&
      devSrc.indexOf("load-acceptance-env") < devSrc.indexOf("spawn("),
    "the canonical target guard does not run before the dev server is spawned",
  );

  // Ratchet: no script may name a project ref except the canonical guard module.
  const CANONICAL = "lib/acceptance-db-target-v1.ts";
  const KNOWN_REFS = [ACCEPT, PRIMARY, "cpeoiqppesacjlyrszrl"];
  const offenders: string[] = [];
  for (const file of readdirSync(SCRIPTS_DIR, { recursive: true }) as string[]) {
    const relative = file.replace(/\\/g, "/");
    if (!relative.endsWith(".ts")) continue;
    if (relative.endsWith(CANONICAL)) continue;
    if (relative.endsWith("verify-acceptance-target-allowlist-v1.ts")) continue;
    const source = readFileSync(join(SCRIPTS_DIR, file), "utf8");
    if (KNOWN_REFS.some((ref) => source.includes(ref))) offenders.push(relative);
  }
  check(
    "E7-no-project-ref-literal-outside-canonical-module",
    offenders.length === 0,
    `refs hard-coded in: ${offenders.join(", ")}`,
  );

  console.log(`\nPROBLEMS=${problems.length}`);
  if (problems.length > 0) console.log(problems.map((p) => `  - ${p}`).join("\n"));
  console.log("\n===== HUKUM =====");
  console.log(
    problems.length === 0
      ? "PASS — only the acceptance project ref is accepted; every other target fails closed"
      : "FAIL — acceptance target guard is not fail-closed",
  );
  process.exit(problems.length === 0 ? 0 : 1);
}

void main();
