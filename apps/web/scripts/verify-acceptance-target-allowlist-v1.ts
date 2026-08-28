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
import { existsSync, readdirSync, readFileSync } from "node:fs";
import { createServer } from "node:net";
import { dirname, join } from "node:path";

import {
  ACCEPTANCE_PROJECT_REF,
  BLOCKED_PRIMARY_PROJECT_REFS,
  evaluateAcceptanceDbTarget,
  parseAcceptancePostgresUrl,
  type TargetRejectReason,
} from "./lib/acceptance-db-target-v1";
import { isAcceptanceCliEntrypoint } from "./lib/acceptance-cli-entry-v1";
import { formatAcceptanceError } from "./lib/acceptance-redaction-v1";
import {
  PRISMA_TLS_UNAVAILABLE_REASON,
  prismaTlsStatus,
} from "./lib/acceptance-prisma-tls-v1";
import {
  encodePasswordForUri,
  parsePostgresUrlRobust,
  rebuildPostgresUrl,
} from "./normalize-acceptance-db-urls-v1";

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

/**
 * Every channel that reaches stdout/stderr, not just console.log/error: a
 * console.warn or a process.stdout.write publishes the same bytes.
 */
const printCalls = (): RegExp =>
  /(?:console\.(?:log|error|warn|info|debug)|process\.std(?:out|err)\.write)\(([\s\S]{0,300}?)\)\s*(?:;|$)/gm;

/** Strip block and line comments so source gates measure executable code, not prose. */
function stripComments(source: string): string {
  return source.replace(/\/\*[\s\S]*?\*\//g, " ").replace(/(^|[^:])\/\/[^\n]*/g, "$1 ");
}

/** Synthetic password; never a real credential. */
const PW = "synthetic-not-a-secret";
const ACCEPT = ACCEPTANCE_PROJECT_REF;
const PRIMARY = [...BLOCKED_PRIMARY_PROJECT_REFS][0]!;

function poolerUrl(ref: string, port = "6543"): string {
  return `postgresql://postgres.${ref}:${PW}@aws-0-eu-central-1.pooler.supabase.com:${port}/postgres?sslmode=verify-full`;
}
function directUrl(ref: string, port = "5432"): string {
  return `postgresql://postgres:${PW}@db.${ref}.supabase.co:${port}/postgres?sslmode=verify-full`;
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

function expectReject(
  name: string,
  e: Record<string, string | undefined>,
  expectedReason?: TargetRejectReason,
): void {
  const decision = evaluateAcceptanceDbTarget(e);
  // The reason is checked when the gate's NAME claims one. Without it a row can
  // stay green because some earlier rule fired, leaving the rule it is named
  // after unmeasured — a rejection for the wrong cause proves nothing.
  const rejectedForTheRightReason =
    !decision.ok && (expectedReason === undefined || decision.reason === expectedReason);
  check(
    name,
    rejectedForTheRightReason,
    decision.ok
      ? "ACCEPTED (fail-open)"
      : `rejected for ${decision.reason}, expected ${expectedReason}`,
  );
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
    // The guard is now an explicit call inside main(), not a module side effect.
    /\bloadAcceptanceEnv\(\)/.test(devSrc) &&
      devSrc.indexOf("loadAcceptanceEnv()") < devSrc.indexOf("spawn("),
    "the canonical target guard does not run before the dev server is spawned",
  );

  console.log("\nG. Prisma CLI wrapper boundary");
  const prismaWrapperPath = join(SCRIPTS_DIR, "run-acceptance-prisma-v1.ts");
  let prismaWrapper: typeof import("./run-acceptance-prisma-v1") | null = null;
  try {
    prismaWrapper = await import("./run-acceptance-prisma-v1");
    check("G0-wrapper-imports-without-env-file", true, "");
  } catch (error) {
    check(
      "G0-wrapper-imports-without-env-file",
      false,
      error instanceof Error ? error.message : String(error),
    );
  }

  if (prismaWrapper) {
    const w = prismaWrapper;
    const parsed = (argv: string[]): { ok: boolean; action?: string; apply?: boolean } => {
      try {
        return { ok: true, ...w.parseAcceptancePrismaAction(argv) };
      } catch {
        return { ok: false };
      }
    };

    const status = parsed(["status"]);
    check("G1-status-allowed", status.ok && status.action === "status", "status was refused");
    check("G2-deploy-without-apply-refused", !parsed(["deploy"]).ok, "deploy ran without --apply");
    const deployApply = parsed(["deploy", "--apply"]);
    check(
      "G3-deploy-with-apply-allowed",
      deployApply.ok && deployApply.action === "deploy" && deployApply.apply === true,
      "deploy --apply was refused",
    );
    const forbidden = [
      ["dev"],
      ["reset"],
      ["resolve", "--applied", "x"],
      ["db", "push"],
      ["db", "pull"],
      ["generate"],
      [],
      ["status", "--force"],
    ];
    const accepted = forbidden.filter((argv) => parsed(argv).ok).map((argv) => argv.join(" "));
    check(
      "G4-destructive-and-unknown-actions-fail-closed",
      accepted.length === 0,
      `accepted: ${accepted.join(" | ")}`,
    );

    const childEnv = w.buildAcceptancePrismaEnv(
      {
        PATH: "/usr/bin",
        DATABASE_URL: "postgresql://ambient:leak@db.jgfwofiygnsylaclykkb.supabase.co:5432/postgres",
        DIRECT_URL: "postgresql://ambient:leak@db.jgfwofiygnsylaclykkb.supabase.co:5432/postgres",
        NEXTAUTH_SECRET: "ambient-secret",
      },
      { DATABASE_URL: poolerUrl(ACCEPT), DIRECT_URL: directUrl(ACCEPT) },
    );
    check(
      "G5-child-env-carries-only-verified-urls",
      childEnv.DATABASE_URL === poolerUrl(ACCEPT) &&
        childEnv.DIRECT_URL === directUrl(ACCEPT) &&
        childEnv.TALEPO_ENVIRONMENT === "acceptance",
      "ambient DATABASE_URL/DIRECT_URL leaked into the Prisma child process",
    );
    check(
      "G6-child-env-pins-dotenv-to-acceptance-file",
      typeof childEnv.DOTENV_CONFIG_PATH === "string" &&
        childEnv.DOTENV_CONFIG_PATH.endsWith(".env.acceptance"),
      "prisma.config.ts imports dotenv/config; without this pin it can read the ambient .env",
    );
    check(
      "G7-child-env-drops-unrelated-secrets",
      childEnv.NEXTAUTH_SECRET === undefined,
      "unrelated secrets were forwarded to the Prisma child process",
    );

    const dirty = [
      `Datasource "db": PostgreSQL database "postgres", schema "public" at "aws-0-eu-central-1.pooler.supabase.com:5432"`,
      `postgresql://postgres.${ACCEPT}:hunter2@aws-0-eu-central-1.pooler.supabase.com:6543/postgres?pgbouncer=true`,
      `password=hunter2`,
    ].join("\n");
    const clean = w.redactPrismaOutput(dirty);
    check(
      "G8-output-redacts-url-host-user-password",
      !/hunter2/.test(clean) &&
        !/supabase\.(com|co)/.test(clean) &&
        !/postgresql:\/\//.test(clean) &&
        !new RegExp(ACCEPT).test(clean),
      "the wrapper leaked a URL, host, user or password",
    );
  }

  const prismaWrapperSrc = existsSync(prismaWrapperPath)
    ? stripComments(readFileSync(prismaWrapperPath, "utf8"))
    : "";
  // Order, observed. This used to compare the index of "loadAcceptanceEnv()"
  // with the index of "spawn(" in the source text, which says where two strings
  // sit and not which call happens first. The decision is driven instead, with
  // both steps recording themselves as they run.
  const orderSeen: string[] = [];
  let orderDriveFailed = "";
  try {
    (
      (await import("./run-acceptance-prisma-v1")) as unknown as {
        executeAcceptancePrisma: (argv: string[], deps: Record<string, unknown>) => unknown;
      }
    ).executeAcceptancePrisma(["status"], {
      loadEnv: () => orderSeen.push("guard"),
      tlsStatus: () => ({ verificationProven: true, detail: "synthetic" }),
      readEnv: () => ({
        DATABASE_URL: `${poolerUrl(ACCEPT)}`,
        DIRECT_URL: `${directUrl(ACCEPT)}`,
      }),
      spawn: () => {
        orderSeen.push("spawn");
        return {};
      },
    });
  } catch (orderError) {
    orderDriveFailed = formatAcceptanceError(orderError);
  }
  check(
    "G9-guard-runs-before-prisma-spawn",
    orderDriveFailed === "" && orderSeen.join(">") === "guard>spawn",
    orderDriveFailed === ""
      ? `observed order: ${orderSeen.join(">") || "(nothing ran)"}`
      : `driving the order threw: ${orderDriveFailed}`,
  );
  check(
    "G10-schema-and-migrations-bound-to-repo-files",
    existsSync(join(SCRIPTS_DIR, "..", "prisma", "schema.prisma")) &&
      existsSync(join(SCRIPTS_DIR, "..", "prisma", "migrations")) &&
      /prisma\.config\.ts/.test(prismaWrapperSrc),
    "the wrapper does not bind to the repository's schema/migrations authority",
  );

  console.log("\nH. Acceptance CLI output redaction (every entry point)");
  // Printed expressions the target verifier must never emit: they carry target
  // infrastructure (host, port, database name, ref) or session identity.
  const FORBIDDEN_VALUES = [
    "host",
    "port",
    "database",
    "projectRef",
    "ACCEPTANCE_PROJECT_REF",
    "current_user",
    "current_database",
    "password",
    "safePreview",
    "DATABASE_URL",
    "DIRECT_URL",
    "NEXTAUTH_SECRET",
  ];
  /** Literal connection material must not be baked into printed text either. */
  const FORBIDDEN_LITERALS = /\.supabase\.(?:com|co)|postgres(?:ql)?:\/\//;
  /** Only this classifier may consume a forbidden value and print its verdict. */
  const APPROVED_CLASSIFIER = /^hostType\(([\s\S]*)\)$/;

  /**
   * Collect the value each console.log/error interpolation would print. A bare
   * member path (`${meta.host}`) prints the value itself; `${hostType(meta.host)}`
   * prints a classification and is allowed. Wrapping in any other call is NOT a
   * way out — the wrapper is unwrapped before the path is judged.
   */
  const leakedValues = (source: string): string[] => {
    const found = new Set<string>();
    for (const call of source.matchAll(printCalls())) {
      const argText = call[1]!;
      // Both forms print a value: `${x.host}` inside a template, and a bare
      // `x.host` passed as a further console.log argument.
      const slots = [
        ...[...argText.matchAll(/\$\{([^}]*)\}/g)].map((m) => m[1]!),
        // Every argument counts, including the FIRST: `console.log(meta.host)`
        // carries no template and no comma and used to slip through entirely.
        ...argText.split(","),
      ].map((slot) => ({ 1: slot }) as unknown as RegExpMatchArray);
      for (const slot of slots) {
        let expression = slot[1]!.trim();
        const classified = APPROVED_CLASSIFIER.exec(expression);
        if (classified) continue;
        // Unwrap any other single call so String(meta.host) is still caught.
        const wrapped = /^[A-Za-z_$][\w$]*\(([^()]*)\)$/.exec(expression);
        if (wrapped) expression = wrapped[1]!.trim();
        if (!/^[A-Za-z_$][\w$]*(?:\.[\w$]+)*$/.test(expression)) continue;
        const last = expression.split(".").pop()!;
        if (FORBIDDEN_VALUES.includes(last)) found.add(last);
      }
    }
    return [...found];
  };

  /** Literal connection material inside a printed template. */
  const leakedLiterals = (source: string): boolean => {
    for (const call of source.matchAll(printCalls())) {
      if (FORBIDDEN_LITERALS.test(call[1]!)) return true;
    }
    return false;
  };

  /**
   * The ref may be imported and compared, but the moment it is stored in a
   * variable or an object field it can reach a generic dump such as
   * `for (const [k, v] of Object.entries(report)) console.log(...)` — which is
   * exactly how it kept leaking after the explicit print was removed.
   */
  const capturesRefIntoData = (source: string): boolean =>
    // A leading [^=!<>] keeps comparisons (`!==`, `===`) out of the match: those
    // read the constant, they do not carry it anywhere.
    /(?:^|[^=!<>])(?::|=)\s*ACCEPTANCE_PROJECT_REF\s*[,;)\n]/m.test(source);

  // Every acceptance CLI entry point, not just the target verifier: the seed
  // and the env diagnostic were printing the project ref and env values while
  // the gate only watched one file.
  // Recursive: scripts/lib holds the guard and the ref owner, and they print too.
  const cliEntries = (readdirSync(SCRIPTS_DIR, { recursive: true }) as string[])
    .map((name) => name.replace(/\\/g, "/"))
    .filter((name) => name.endsWith(".ts") && name.includes("acceptance"))
    .sort();
  const offendingCli: string[] = [];
  for (const entry of cliEntries) {
    if (entry.endsWith("verify-acceptance-target-allowlist-v1.ts")) continue;
    const source = stripComments(readFileSync(join(SCRIPTS_DIR, entry), "utf8"));
    const values = leakedValues(source);
    if (values.length > 0) offendingCli.push(`${entry}(${values.join("/")})`);
    else if (leakedLiterals(source)) offendingCli.push(`${entry}(literal)`);
    else if (!entry.startsWith("lib/") && capturesRefIntoData(source)) {
      offendingCli.push(`${entry}(ref-captured-into-data)`);
    }
  }
  check(
    "H1-acceptance-cli-prints-no-target-identity",
    offendingCli.length === 0,
    `still printed by: ${offendingCli.join(", ")}`,
  );
  // Named entry points, not a floor: renaming a script must not quietly drop it
  // out of the scanned surface.
  const REQUIRED_CLI_ENTRIES = [
    "acceptance-core-commerce-v1.ts",
    "cleanup-acceptance-v1.ts",
    "diagnose-acceptance-env-v1.ts",
    "normalize-acceptance-db-urls-v1.ts",
    "run-acceptance-dev-v1.ts",
    "run-acceptance-prisma-v1.ts",
    "seed-acceptance-fixtures-v1.ts",
    "seed-acceptance-personas-v1.ts",
    "verify-acceptance-cleanup-safety-v1.ts",
    "verify-acceptance-db-target-v1.ts",
    "verify-acceptance-personas-v1.ts",
    "lib/load-acceptance-env.ts",
    "lib/acceptance-db-target-v1.ts",
  ];
  const unscanned = REQUIRED_CLI_ENTRIES.filter((name) => !cliEntries.includes(name));
  check(
    "H1b-every-known-entry-point-is-scanned",
    unscanned.length === 0,
    `not in the scanned surface: ${unscanned.join(", ")}`,
  );

  const SAFE_LABELS = ["URL_PRESENT", "HOST_TYPE", "SAME_PROJECT", "TARGET CLASSIFICATION"];
  const missingLabels = SAFE_LABELS.filter((label) => !targetVerifierSrc.includes(label));
  check(
    "H2-target-verifier-emits-safe-classification-only",
    missingLabels.length === 0,
    `missing safe labels: ${missingLabels.join(", ")}`,
  );

  check(
    "H3-error-path-uses-shared-redactor",
    /redactAcceptanceOutput|formatAcceptanceError/.test(targetVerifierSrc) &&
      !/replace\(\/postgres/.test(targetVerifierSrc),
    "the error path keeps its own partial redactor instead of the shared one",
  );

  // Positive control: prove the leak detector fires on a sample that really leaks.
  // One leaking print per forbidden value, in both the template and the
  // comma-argument form, so the control covers every rule the gate enforces.
  // Three shapes per rule: template interpolation, trailing comma argument and
  // a single bare argument — the last one was a live blind spot.
  const leakSample = FORBIDDEN_VALUES.map((value, index) =>
    index % 3 === 0
      ? `console.log(\`leak: \${meta.${value}}\`);`
      : index % 3 === 1
        ? `console.error("leak:", meta.${value});`
        : `console.warn(meta.${value});`,
  ).join("\n");
  const caught = leakedValues(leakSample);
  const missed = FORBIDDEN_VALUES.filter((value) => !caught.includes(value));
  check(
    "H4-detector-positive-control",
    missed.length === 0 && caught.length >= 6,
    `detector missed: ${missed.join(", ")}`,
  );
  check(
    "H6-ref-capture-detector-positive-control",
    capturesRefIntoData("const report = {\n  stagingProject: ACCEPTANCE_PROJECT_REF,\n};") &&
      capturesRefIntoData("const ref = ACCEPTANCE_PROJECT_REF;") &&
      !capturesRefIntoData("if (parsed.projectRef !== ACCEPTANCE_PROJECT_REF) fail();"),
    "the ref-capture detector cannot separate storing the ref from comparing against it",
  );
  check(
    "H7-print-channels-cover-warn-and-stdout",
    leakedValues("console.warn(`h: ${meta.host}`);").includes("host") &&
      leakedValues("process.stdout.write(`h: ${meta.host}`);").includes("host"),
    "console.warn / process.stdout.write are not part of the scanned print surface",
  );
  check(
    "H5-literal-detector-positive-control",
    leakedLiterals(
      'console.log(`target is db.abcdefghijklmnopqrst.supabase.co with pw hunter2`);',
    ) &&
      leakedLiterals(
        'console.error(`postgresql://postgres:hunter2@aws-0-eu-central-1.pooler.supabase.com:6543/postgres`);',
      ) &&
      !leakedLiterals('console.log("TARGET_CLASSIFICATION=ACCEPTANCE_ALLOWLISTED");'),
    "the literal detector does not separate a leaking print from a safe classification",
  );

  console.log("\nI. Error-path redaction (synthetic error matrix)");
  let redaction: typeof import("./lib/acceptance-redaction-v1") | null = null;
  try {
    redaction = await import("./lib/acceptance-redaction-v1");
    check("I0-redaction-authority-exists", true, "");
  } catch (error) {
    check(
      "I0-redaction-authority-exists",
      false,
      error instanceof Error ? error.message : String(error),
    );
  }

  if (redaction) {
    const r = redaction;
    const SECRET_PW = "hunter2";
    // Every shape a real failure actually reaches stderr in.
    const LEAK_CASES: Array<[string, string]> = [
      [
        "I1-schemeless-prisma-host",
        `Can't reach database server at \`db.${ACCEPT}.supabase.co\`:\`5432\``,
      ],
      [
        "I2-pooler-host-with-port",
        "getaddrinfo ENOTFOUND aws-0-eu-central-1.pooler.supabase.com:6543",
      ],
      ["I3-postgres-scheme", `postgres://postgres:${SECRET_PW}@db.${ACCEPT}.supabase.co:5432/postgres`],
      [
        "I4-postgresql-scheme-with-query",
        `postgresql://postgres.${ACCEPT}:${SECRET_PW}@aws-0-eu-central-1.pooler.supabase.com:6543/postgres?pgbouncer=true`,
      ],
      ["I5-bare-acceptance-ref", `project ${ACCEPT} refused the connection`],
      ["I6-bare-primary-ref", `project ${PRIMARY} refused the connection`],
      ["I7-password-assignment", `password=${SECRET_PW} rejected`],
    ];
    for (const [name, dirty] of LEAK_CASES) {
      const clean = r.redactAcceptanceOutput(dirty);
      const leaked =
        new RegExp(ACCEPT).test(clean) ||
        new RegExp(PRIMARY).test(clean) ||
        /supabase\.(?:com|co)/.test(clean) ||
        /postgres(?:ql)?:\/\//.test(clean) ||
        clean.includes(SECRET_PW);
      check(name, !leaked, `redacted output still leaks: ${clean.slice(0, 60)}`);
    }

    // Error objects: message, stack and cause all reach stderr via console.error(e).
    const nested = new Error(`inner at db.${ACCEPT}.supabase.co:5432`);
    const outer = new Error(`outer ${PRIMARY} failed`, { cause: nested });
    const formatted = r.formatAcceptanceError(outer);
    check(
      "I8-error-message-cause-and-stack-are-redacted",
      !new RegExp(ACCEPT).test(formatted) &&
        !new RegExp(PRIMARY).test(formatted) &&
        !/supabase\.(?:com|co)/.test(formatted) &&
        !/\bat\s+\S+:\d+:\d+/.test(formatted),
      `formatted error still carries identity or a stack frame: ${formatted.slice(0, 80)}`,
    );
    check(
      "I9-error-class-and-step-survive",
      formatted.includes("Error") && formatted.length > 0 && formatted.length <= 400,
      `formatted error is not a short, classified line: ${formatted.slice(0, 80)}`,
    );
    check(
      "I10-non-error-values-are-handled",
      !new RegExp(ACCEPT).test(r.formatAcceptanceError(`plain ${ACCEPT} string`)),
      "a thrown non-Error value is printed unredacted",
    );

    // Positive control: the detector must actually go red on a real leak.
    // The empirical holes an independent review found; each must stay closed.
    const HOLE_CASES: Array<[string, string, RegExp]> = [
      ["I18-password-aliases", "pwd=hunter2 and passwd: hunter2", /hunter2/],
      [
        "I19-json-credentials",
        `{"user":"postgres.${ACCEPT}","password":"hunter2"}`,
        /hunter2/,
      ],
      ["I20-uppercase-ref", `project ${ACCEPT.toUpperCase()} refused`, new RegExp(ACCEPT, "i")],
      [
        "I21-database-role",
        "the provided database credentials for `talepo_svc` are not valid",
        /talepo_svc/,
      ],
      ["I22-ipv4-address", "connect ECONNREFUSED 52.29.169.11:5432", /52\.29\.169\.11/],
      ["I23-ipv6-address", "connect ETIMEDOUT 2600:1f16:1cd0:3319::2", /2600:1f16/],
      [
        "I24-absolute-path",
        "ENOENT C:\\Users\\someone\\Documents\\Talepo\\apps\\web\\.env.acceptance",
        /Users\\someone/,
      ],
      // Shapes a second independent review proved were still leaking.
      ["I27-pg-env-colon", "PGPASSWORD: hunter2", /hunter2/],
      ["I28-prefixed-password-key", "SUPABASE_DB_PASSWORD=hunter2", /hunter2/],
      ["I29-single-quoted-json", "{'password':'hunter2'}", /hunter2/],
      ["I30-pg-json", '{"PGPASSWORD":"hunter2","PGUSER":"talepo_svc"}', /hunter2/],
      [
        "I31-posix-path-in-quotes",
        "Cannot find module '/home/dincer/talepo/apps/web/.env.acceptance'",
        /home\/dincer/,
      ],
      [
        "I32-role-quoted",
        'FATAL: password authentication failed for user "talepo_svc"',
        /talepo_svc/,
      ],
      ["I33-role-does-not-exist", 'FATAL: role "talepo_svc" does not exist', /talepo_svc/],
      ["I34-ipv6-bracketed", "connect ECONNREFUSED [::1]:5432", /\[::1\]/],
      ["I35-ipv6-compressed", "connect ECONNREFUSED ::1", /ECONNREFUSED ::1/],
      [
        "I36-uri-does-not-eat-the-line",
        '{"url":"postgres://u:p@h/db","persona":"PRO_A"}',
        /^(?!.*PRO_A)/s,
      ],
      // Third review round: quoted credential values are the normal .env shape.
      ["I44-quoted-password-assignment", 'password="hunter2"', /hunter2/],
      ["I45-quoted-pg-password", "PGPASSWORD='hunter2'", /hunter2/],
      ["I46-prefixed-quoted-password", 'SUPABASE_DB_PASSWORD="hunter2"', /hunter2/],
      ["I47-object-literal-password", '{ password: "hunter2" }', /hunter2/],
      ["I48-ipv4-mapped-ipv6", "connect ECONNREFUSED ::ffff:52.29.169.11", /52\.29\.169\.11/],
      ["I49-eai-again-address", "getaddrinfo EAI_AGAIN 52.29.169.11", /52\.29\.169\.11/],
      ["I50-unc-host-without-share", "ENOENT \\\\BUILDBOX01", /BUILDBOX01/],
      [
        "I51-usr-path",
        "Cannot find module /usr/local/lib/node_modules/x/index.js",
        /usr\/local/,
      ],
      ["I52-libpq-user", "conninfo user=talepo_svc dbname=postgres", /talepo_svc/],
      ["I53-bare-role", "role talepo_svc does not exist", /talepo_svc/],
      // Fourth review round.
      ["I58-unterminated-quoted-password", 'PGPASSWORD="hunter2', /hunter2/],
      ["I59-unterminated-single-quote", "PGPASSWORD='hunter2", /hunter2/],
      ["I60-unterminated-user", 'user="talepo_svc', /talepo_svc/],
      [
        "I61-libpq-quoted-server",
        'connection to server at "10.1.2.3", port 5432 failed: Connection refused',
        /10\.1\.2\.3/,
      ],
      // Secrets whose key is not password-ish still reach a log.
      ["I72-nextauth-secret", "NEXTAUTH_SECRET=super-secret-value", /super-secret-value/],
      [
        "I73-service-role-key",
        "SUPABASE_SERVICE_ROLE_KEY=eyJhbGciOiJIUzI1NiJ9.abc",
        /eyJhbGciOiJIUzI1NiJ9/,
      ],
      ["I74-bearer-token", "Authorization: Bearer eyJabc.def.ghi", /eyJabc\.def\.ghi/],
      ["I75-pguser-conninfo", "conninfo pguser=talepo_svc pgdatabase=talepo", /talepo_svc/],
    ];
    for (const [name, dirty, leakPattern] of HOLE_CASES) {
      const clean = r.redactAcceptanceOutput(dirty);
      check(name, !leakPattern.test(clean), `still leaks: ${clean.slice(0, 70)}`);
    }
    // Stream: the real Prisma P1001 block, fed at the chunk sizes an
    // independent review used to reassemble the host on the terminal. A single
    // 45/45 split never exercised the release path at all.
    const streamText =
      "Prisma schema loaded from prisma/schema.prisma\n" +
      `Datasource "db": PostgreSQL database "postgres", schema "public" at "db.${ACCEPT}.supabase.co:5432"\n` +
      "\n" +
      `Error: P1001: Can't reach database server at \`db.${ACCEPT}.supabase.co\`:\`5432\`\n`;
    const streamLeaks: string[] = [];
    for (const size of [1, 4, 7, 8, 32, 64, 4096]) {
      const stream = r.createStreamRedactor();
      let out = "";
      for (let i = 0; i < streamText.length; i += size) {
        out += stream.push(streamText.slice(i, i + size));
      }
      out += stream.flush();
      const leaks =
        new RegExp(ACCEPT.slice(0, 8), "i").test(out) || /supabase\.(?:com|co)/i.test(out);
      const lossless = out.replace(/\[redacted-[a-z]+\]/g, "").length > 0;
      if (leaks || !lossless) streamLeaks.push(`${size}B`);
    }
    check(
      "I25-split-chunks-carry-no-fragment",
      streamLeaks.length === 0,
      `chunk sizes that leak or lose output: ${streamLeaks.join(", ")}`,
    );
    // Control: the same text redacted per-chunk (the old behaviour) MUST leak,
    // otherwise the case above proves nothing.
    let naive = "";
    for (let i = 0; i < streamText.length; i += 7) {
      naive += r.redactAcceptanceOutput(streamText.slice(i, i + 7));
    }
    // The >64KB overflow path used to slice BEFORE redacting, cutting a host in
    // half at the carry boundary.
    const overflowStream = r.createStreamRedactor();
    const longLine =
      "x".repeat(65_526) + "y".repeat(251) + `db.${ACCEPT}.supabase.co` + "z".repeat(250);
    const overflowOut = overflowStream.push(longLine) + overflowStream.flush();
    check(
      "I57-overflow-carry-does-not-split-a-token",
      !/supabase\.(?:com|co)/i.test(overflowOut) && !new RegExp(ACCEPT, "i").test(overflowOut),
      `overflow path leaked: ${overflowOut.slice(65_700, 65_800)}`,
    );

    // A quoted value must never eat the lines that follow it: redaction is
    // per-line, so an unbalanced quote cannot swallow the migration log.
    const multiline =
      'PGPASSWORD="\nprisma:info Applying migration 20260101_add_offer\nprisma:info Applying migration 20260102_add_message\n';
    const multilineOut = r.redactAcceptanceOutput(multiline);
    check(
      "I67-quoted-value-does-not-swallow-following-lines",
      multilineOut.includes("20260101_add_offer") && multilineOut.includes("20260102_add_message"),
      `output lines were swallowed: ${multilineOut.slice(0, 90)}`,
    );
    // Redaction must stay affordable: an earlier version needed ~16 s for one
    // 64 KB line because two rules restarted a scan at every index.
    // The line MUST contain a credential keyword: without one every guarded
    // rule is skipped and the gate would time the cheap pre-checks instead of
    // the rule it exists to bound.
    const bigLine = `${"a".repeat(64 * 1024)} password=x`;
    const startedAt = process.hrtime.bigint();
    const bigOut = r.redactAcceptanceOutput(bigLine);
    const elapsedMs = Number(process.hrtime.bigint() - startedAt) / 1_000_000;
    check(
      "I68-large-line-redaction-is-affordable",
      elapsedMs < 1000 && bigOut.includes("[redacted]"),
      `64 KB line took ${Math.round(elapsedMs)} ms (redacted: ${bigOut.includes("[redacted]")})`,
    );

    check(
      "I25b-per-chunk-control-does-leak",
      new RegExp(ACCEPT.slice(0, 8), "i").test(naive),
      "the per-chunk control does not leak, so I25 cannot prove buffering works",
    );
    // A hostile error object must not make the quiet handler loud.
    const hostile = Object.create(Error.prototype) as Error;
    Object.defineProperty(hostile, "message", {
      get() {
        throw new Error(`getter blew up at db.${ACCEPT}.supabase.co`);
      },
    });
    let hostileFormatted = "";
    let hostileThrew = false;
    try {
      hostileFormatted = r.formatAcceptanceError(hostile);
    } catch {
      hostileThrew = true;
    }
    check(
      "I26-broken-error-object-does-not-crash-the-handler",
      !hostileThrew && !new RegExp(ACCEPT, "i").test(hostileFormatted),
      hostileThrew ? "formatAcceptanceError threw" : `leaked: ${hostileFormatted.slice(0, 70)}`,
    );

    // Over-redaction is a defect too: a harness whose failures ARE route and
    // counter failures must still be debuggable after redaction.
    const KEEP_CASES: Array<[string, string, RegExp]> = [
      ["I37-http-route-survives", "GET /api/requests/abc123/publish -> 500", /\/api\/requests/],
      ["I38-counters-survive", "pass: 12, fail: 3, skipped: 0", /pass: 12, fail: 3/],
      ["I39-role-word-survives", "role: PRO expected, got SEEKER", /PRO expected, got SEEKER/],
      ["I40-version-survives", "prisma engine 5.22.0.1 mismatch", /5\.22\.0\.1/],
      ["I41-duration-survives", "took 00:01:23 to finish", /00:01:23/],
      // A drive-letter rule that also matched `p:/` erased every URL in the output.
      [
        "I54-http-url-survives",
        "GET http://localhost:3187/api/requests/abc -> 500",
        /http:\/\/localhost:3187/,
      ],
      ["I55-https-url-survives", "fetch failed for https://example.com/a", /https:\/\/example\.com/],
      ["I56-env-like-filename-survives", "myapp.environment.json missing", /myapp\.environment\.json/],
      ["I62-version-after-at-survives", "prisma at 5.22.0.1 crashed", /5\.22\.0\.1/],
      ["I63-elapsed-after-at-survives", "run failed at 00:01:23 elapsed", /00:01:23/],
      ["I64-process-env-survives", "prisma reads process.env.DATABASE_URL", /process\.env\.DATABASE_URL/],
      [
        "I65-app-route-survives",
        "GET https://staging.example.com/app/requests/42 -> 500",
        /\/app\/requests\/42/,
      ],
      ["I66-data-route-survives", "POST /data/import failed with 422", /\/data\/import/],
      // The persona contract under test must survive: `role` is Talepo
      // vocabulary here, and the key name says which field was reported.
      [
        "I69-persona-role-value-survives",
        '{"persona":"PRO_A","role":"PRO","user":"buyer-1"}',
        /"role":"PRO"/,
      ],
      ["I70-credential-key-name-survives", 'PGPASSWORD="hunter2"', /PGPASSWORD/],
      ["I71-uri-does-not-eat-closing-paren", "(see postgres://u:p@h/db) and then keepme", /keepme/],
    ];
    for (const [name, input, keepPattern] of KEEP_CASES) {
      const clean = r.redactAcceptanceOutput(input);
      check(name, keepPattern.test(clean), `diagnostic destroyed: ${clean.slice(0, 70)}`);
    }
    // AggregateError is where Node hides connection failures.
    const aggregate = new AggregateError(
      [new Error(`connect ECONNREFUSED db.${ACCEPT}.supabase.co`)],
      "All connection attempts failed",
    );
    const aggregateOut = r.formatAcceptanceError(aggregate);
    check(
      "I42-aggregate-error-inner-is-walked-and-redacted",
      aggregateOut.includes("including") && !new RegExp(ACCEPT, "i").test(aggregateOut),
      `aggregate handling wrong: ${aggregateOut.slice(0, 90)}`,
    );
    check(
      "I43-nullish-error-still-classified",
      r.formatAcceptanceError(undefined).includes("Error") &&
        r.formatAcceptanceError(null).includes("Error"),
      "a nullish rejection prints an empty FAIL line",
    );

    check(
      "I11-detector-positive-control",
      new RegExp(ACCEPT).test(`Can't reach db.${ACCEPT}.supabase.co`) &&
        !new RegExp(ACCEPT).test(r.redactAcceptanceOutput(`Can't reach db.${ACCEPT}.supabase.co`)),
      "the leak assertion cannot distinguish a leaking string from a redacted one",
    );
  }

  // Every CLI error path must route through the single authority.
  const partialRedactors: string[] = [];
  const rawErrorPrints: string[] = [];
  // The authority itself is where the regexes are SUPPOSED to live.
  // Two files may legitimately carry a connection-string regex, for two
  // different jobs: one REDACTS output, one PARSES a URL to decide the target.
  // Neither may be duplicated; nothing else may hold such a regex at all.
  const REDACTION_AUTHORITY = "lib/acceptance-redaction-v1.ts";
  const URL_PARSING_AUTHORITY = "lib/acceptance-db-target-v1.ts";
  /**
   * Any print whose argument is an error-ish value. Reuses printCalls(), so
   * console.warn, console.log and process.stderr.write are covered, and it does
   * not care what the variable is named or whether `.stack` is appended.
   */
  /** Identifiers that hold a thrown value, as WHOLE words only. */
  const ERROR_IDENTIFIER = /\b(?:e|err|error|caught|reason|ex)\d*\b/;
  /** Calls that are allowed to consume an error and produce safe text. */
  const SANCTIONED_SINK = /\b(?:formatAcceptanceError|redactAcceptanceOutput|redactPrismaOutput)\s*\([^()]*\)/g;
  const rawErrorPrint = (source: string): boolean => {
    // Variables derived from an error without a sanctioned wrapper carry the
    // same payload, so `const message = error instanceof Error ? ... ` makes
    // `message` error-tainted for the rest of the file.
    const tainted = new Set<string>();
    for (const assignment of source.matchAll(
      /(?:const|let|var)\s+([A-Za-z_$][\w$]*)\s*=\s*([^;\n]*)/g,
    )) {
      const value = assignment[2]!.replace(SANCTIONED_SINK, " ");
      if (ERROR_IDENTIFIER.test(value)) tainted.add(assignment[1]!);
    }
    const taintedPattern =
      tainted.size > 0 ? new RegExp(`\\b(?:${[...tainted].join("|")})\\b`) : null;

    /**
     * `decision.reason` is the guard's own closed union, deliberately safe to
     * print. Nothing else named `.reason` is: a `Promise.allSettled` entry's
     * `.reason` IS the raw thrown value, host and all. So this is a whitelist of
     * variables provably assigned from a decision producer, never a judgement
     * about the base's NAME — a name-based rule would wave `r.reason` through.
     */
    const decisionVars = new Set<string>();
    for (const assignment of source.matchAll(
      /(?:const|let|var)\s+([A-Za-z_$][\w$]*)\s*=\s*(?:await\s+)?(?:evaluate[A-Za-z]*|loadAcceptanceEnv|executeAcceptancePrisma)\s*\(/g,
    )) {
      decisionVars.add(assignment[1]!);
    }
    const decisionField =
      decisionVars.size > 0
        ? new RegExp(`\\b(?:${[...decisionVars].join("|")})\\.(?:reason|detail)\\b`, "g")
        : null;
    const dropSafeDecisionFields = (text: string): string =>
      decisionField ? text.replace(decisionField, " ") : text;

    for (const call of source.matchAll(printCalls())) {
      // Strip the sanctioned wrappers first; whatever error value still reaches
      // the print unwrapped is a leak, in any spelling: `error`, `${e}`,
      // `error.message`, `err.stack`, `String(e)`, `(error as Error).message`.
      const remaining = dropSafeDecisionFields(call[1]!.replace(SANCTIONED_SINK, " "));
      if (ERROR_IDENTIFIER.test(remaining)) return true;
      if (taintedPattern?.test(remaining)) return true;
    }
    return false;
  };
  /** Any locally written connection-string or host redactor, however it is spelled. */
  const localRedactor = (source: string): boolean =>
    /\/postgres(?:ql)?:\\?\/\\?\//.test(source) ||
    /\/[^/\n]*supabase\\?\.[^/\n]*\//.test(source) ||
    /new RegExp\(\s*(?:String\.raw)?\s*["'`][^"'`]*(?:postgres|supabase)/i.test(source) ||
    /\.includes\(\s*["'`][^"'`]*supabase/i.test(source);

  for (const entry of cliEntries.concat("precheck-personal-resource-ownership-v1.ts")) {
    if (entry.endsWith("verify-acceptance-target-allowlist-v1.ts")) continue;
    if (entry === REDACTION_AUTHORITY || entry === URL_PARSING_AUTHORITY) continue;
    const path = join(SCRIPTS_DIR, entry);
    if (!existsSync(path)) continue;
    const source = stripComments(readFileSync(path, "utf8"));
    if (localRedactor(source)) partialRedactors.push(entry);
    if (rawErrorPrint(source)) rawErrorPrints.push(entry);
  }
  check(
    "I12-no-second-partial-redactor",
    partialRedactors.length === 0,
    `local URI-only regex still in: ${partialRedactors.join(", ")}`,
  );
  // The narrowing above must not have blunted the detector: an error's own
  // fields stay leaks, only a clean decision object's contract fields are safe.
  const DECISION_ASSIGNMENT = "const decision = evaluateAcceptanceDbTarget(env);\n";
  check(
    "I13b-decision-fields-narrowing-still-catches-errors",
    rawErrorPrint('console.error(`${error.reason}`);') &&
      rawErrorPrint('console.error(`${error.message}`);') &&
      // A settled promise's `.reason` is the thrown value itself. A name-based
      // narrowing would have dropped these three; the whitelist must not.
      rawErrorPrint(DECISION_ASSIGNMENT + 'console.error(`${r.reason}`);') &&
      rawErrorPrint(DECISION_ASSIGNMENT + 'console.error(`${outcome.reason}`);') &&
      // `.detail` is only ever reached through an error-named base — `x.detail`
      // on an unknown base was never caught and still is not, so the whitelist
      // is asserted where it actually applies rather than where it looks tidy.
      rawErrorPrint(DECISION_ASSIGNMENT + 'console.error(`${error.detail}`);') &&
      !rawErrorPrint(DECISION_ASSIGNMENT + 'console.error(`${decision.detail}`);') &&
      !rawErrorPrint(DECISION_ASSIGNMENT + 'console.error(`${decision.reason}`);') &&
      // Without the assignment there is no whitelist entry, so nothing is dropped.
      rawErrorPrint('console.error(`${decision.reason}`);'),
    "the .reason/.detail narrowing hides a real error payload, or still flags the guard's own enum",
  );
  check(
    "I13-no-raw-error-object-printed",
    rawErrorPrints.length === 0,
    `raw Error printed by: ${rawErrorPrints.join(", ")}`,
  );
  // Mutation controls: each detector must go RED on a deliberately reintroduced
  // leak. A gate that is only ever green on today's code proves nothing.
  const MUTATIONS: Array<[string, string]> = [
    ["two-arg-error", 'console.error("FAIL", error);'],
    ["console-log-error", "console.log(error);"],
    ["stack-print", "console.error(err.stack);"],
    ["stderr-write", "process.stderr.write(String(err));"],
    ["renamed-variable", "console.error(caught);"],
    ["json-stringify", "console.error(JSON.stringify(e));"],
    // Shapes an independent review reintroduced past the first detector.
    ["message-only", "console.error(error.message);"],
    ["template-message", "console.error(`FAIL — ${error.message}`);"],
    ["template-error", "console.error(`FAIL — ${e}`);"],
    ["to-string", "console.error(error.toString());"],
    ["string-of-message", "console.error(String(e.message));"],
    ["inspect", "console.error(inspect(error));"],
    ["cast", "console.error((error as Error).message);"],
    ["non-null-assertion", "console.error(err!);"],
    ["no-semicolon", "console.error(error)"],
    [
      "hoisted-message",
      "const message = error instanceof Error ? error.message : String(error);\nconsole.error(`FAIL — ${message}`);",
    ],
  ];
  const missedMutations = MUTATIONS.filter(([, sample]) => !rawErrorPrint(sample)).map(
    ([name]) => name,
  );
  check(
    "I15-raw-error-detector-mutation-control",
    missedMutations.length === 0,
    `detector stays green on: ${missedMutations.join(", ")}`,
  );
  const REDACTOR_MUTATIONS: Array<[string, string]> = [
    ["uri-regex", 'text.replace(/postgres:\\/\\/\\S+/g, "");'],
    ["host-regex", 'text.replace(/supabase\\.co/g, "");'],
    ["named-const-regex", 'const RE = /postgresql:\\/\\/\\S+/; text.replace(RE, "");'],
    // String-built regexes carry no literal, so the first detector missed them.
    ["string-built-regex", 'text.replace(new RegExp("postgres(ql)?://\\\\S+", "gi"), "");'],
    ["string-raw-regex", "const p = new RegExp(String.raw`postgres://\\S+`);"],
    ["includes-guard", 'if (text.includes("supabase.co")) text = "[host]";'],
  ];
  const missedRedactors = REDACTOR_MUTATIONS.filter(([, sample]) => !localRedactor(sample)).map(
    ([name]) => name,
  );
  check(
    "I16-local-redactor-detector-mutation-control",
    missedRedactors.length === 0,
    `detector stays green on: ${missedRedactors.join(", ")}`,
  );
  check(
    "I17-detectors-do-not-fire-on-clean-code",
    !rawErrorPrint('console.error(`FAIL — ${formatAcceptanceError(error)}`);') &&
      !localRedactor('console.error(`FAIL — ${formatAcceptanceError(error)}`);'),
    "the detectors flag the sanctioned call shape as a violation",
  );

  // The exemption above must stay a single named file, not a growing allowlist.
  // This verifier is excluded everywhere else too: it must name the patterns it
  // hunts for, and its mutation samples are deliberately leaky by construction.
  const regexOwners = cliEntries
    .filter((entry) => !entry.endsWith("verify-acceptance-target-allowlist-v1.ts"))
    .filter((entry) => localRedactor(stripComments(readFileSync(join(SCRIPTS_DIR, entry), "utf8"))));
  check(
    "I14-connection-regex-owners-are-the-two-named-authorities",
    regexOwners.length === 2 &&
      regexOwners.includes(REDACTION_AUTHORITY) &&
      regexOwners.includes(URL_PARSING_AUTHORITY),
    `owners are: ${regexOwners.join(", ")}`,
  );

  console.log("\nJ. Import order and error boundary (CODE-VERIFIED)");
  // Every CLI that talks to the database must obey ONE order:
  // loadAcceptanceEnv() -> product modules -> business logic. A static product
  // import defeats it, because the module graph loads before main() runs.
  const DB_CLI_ENTRIES = [
    "acceptance-core-commerce-v1.ts",
    "cleanup-acceptance-v1.ts",
    "precheck-personal-resource-ownership-v1.ts",
    "seed-acceptance-fixtures-v1.ts",
    "seed-acceptance-personas-v1.ts",
    "verify-acceptance-db-target-v1.ts",
    "verify-acceptance-personas-v1.ts",
  ];
  // Covers the named form, the bare side-effect form and require(), at any depth
  // of `../` — each of them loads the module graph before main() runs.
  const staticProductImport =
    /^\s*(?:import\s+(?!type\b)[^;]*?from\s+|import\s+|(?:const|let|var)\s+[^;=]*=\s*require\()["'](?:(?:\.\.\/)+src\/|@\/)[^"']*["']/m;
  const orderOffenders: string[] = [];
  const bindingOffenders: string[] = [];
  const boundaryOffenders: string[] = [];
  for (const entry of DB_CLI_ENTRIES) {
    const source = stripComments(readFileSync(join(SCRIPTS_DIR, entry), "utf8"));
    if (staticProductImport.test(source)) orderOffenders.push(`${entry}(static-import)`);
    const envAt = source.indexOf("loadAcceptanceEnv()");
    const bindAt = Math.max(
      source.indexOf("await bindProductModules()"),
      source.indexOf('await import("../src/lib/prisma")'),
      source.indexOf('await import("@/lib/prisma")'),
    );
    if (envAt < 0 || bindAt < 0 || envAt > bindAt) orderOffenders.push(`${entry}(order)`);
    // Every `let X!: typeof import(...)` declaration must actually be assigned.
    const declared = [...source.matchAll(/let\s+([A-Za-z_$][\w$]*)!:\s*typeof import\(/g)].map(
      (m) => m[1]!,
    );
    // The assignment may live in bindProductModules() or directly in main().
    const unbound = declared.filter(
      (name) => !new RegExp(`\\{[^}]*\\b${name}\\b[^}]*\\}\\s*=\\s*await import\\(`).test(source),
    );
    if (unbound.length > 0) bindingOffenders.push(`${entry}(${unbound.join("/")})`);
    // The boundary must exist AND route through the shared formatter — a bare
    // try/catch anywhere in the file used to satisfy this.
    if (!/(?:\.catch\(|catch\s*\([^)]*\)\s*\{)[\s\S]{0,400}?formatAcceptanceError\(/.test(source)) {
      boundaryOffenders.push(entry);
    }
    // Only the TOP-LEVEL handler matters here: inside main(), bindings are
    // already in place. The top-level catch can run before binding, so a
    // deferred constructor must be guarded there or the handler itself throws.
    const topLevelHandler = source.slice(source.lastIndexOf("main()"));
    for (const use of topLevelHandler.matchAll(/instanceof\s+([A-Z][\w$]*)/g)) {
      const name = use[1]!;
      if (!new RegExp(`let\\s+${name}!:\\s*typeof import\\(`).test(source)) continue;
      if (!new RegExp(`${name}\\s*&&[\\s\\S]{0,40}instanceof\\s+${name}`).test(topLevelHandler)) {
        boundaryOffenders.push(`${entry}(unguarded ${name})`);
      }
    }
  }
  check(
    "J1-no-static-product-import-and-env-runs-first",
    orderOffenders.length === 0,
    `order broken in: ${orderOffenders.join(", ")}`,
  );
  check(
    "J2-every-declared-binding-is-assigned",
    bindingOffenders.length === 0,
    `declared but never bound: ${bindingOffenders.join(", ")}`,
  );
  check(
    "J3-every-db-cli-has-an-error-boundary",
    boundaryOffenders.length === 0,
    `no catch boundary in: ${boundaryOffenders.join(", ")}`,
  );
  // Constructors used with instanceof must be bound, or a failure is misclassified.
  const coreSrc = stripComments(
    readFileSync(join(SCRIPTS_DIR, "acceptance-core-commerce-v1.ts"), "utf8"),
  );
  const instanceofNames = [...coreSrc.matchAll(/instanceof\s+([A-Z][\w$]*)/g)].map((m) => m[1]!);
  const projectConstructors = instanceofNames.filter((name) => /Error$/.test(name) && name !== "Error");
  const unboundConstructors = projectConstructors.filter(
    (name) => !new RegExp(`let\\s+${name}!:\\s*typeof import\\(`).test(coreSrc),
  );
  check(
    "J4-instanceof-constructors-are-bound",
    projectConstructors.length > 0 && unboundConstructors.length === 0,
    projectConstructors.length === 0
      ? "no instanceof constructor found to check"
      : `unbound: ${unboundConstructors.join(", ")}`,
  );
  // Positive control: the order detector must fire on a script that gets it wrong.
  check(
    "J5-order-detector-mutation-control",
    staticProductImport.test('import { prisma } from "../src/lib/prisma";') &&
      staticProductImport.test('import { x } from "@/lib/discovery";') &&
      staticProductImport.test('import "@/lib/prisma";') &&
      staticProductImport.test('const { prisma } = require("../src/lib/prisma");') &&
      staticProductImport.test('import { p } from "../../src/lib/prisma";') &&
      !staticProductImport.test('import type { T } from "@/lib/membership/types";') &&
      !staticProductImport.test('import { loadAcceptanceEnv } from "./lib/load-acceptance-env";'),
    "the static-import detector cannot separate a runtime import from a type import",
  );
  check(
    "J6-loader-does-nothing-at-import-time",
    (() => {
      const loaderSrc = stripComments(
        readFileSync(join(SCRIPTS_DIR, "lib", "load-acceptance-env.ts"), "utf8"),
      );
      // A module-scope statement is UNINDENTED. Slicing at the first exported
      // function hid exactly the regression this gate exists for: a call
      // appended at the end of the file was invisible.
      const topLevelCall = /^[A-Za-z_$][\w$.]*\s*\(/m;
      const isTopLevelCall = loaderSrc
        .split(/\r?\n/)
        .some((line) => topLevelCall.test(line) && !/^(?:export|import|const|let|type)\b/.test(line));
      return (
        !isTopLevelCall && !/process\.exit/.test(loaderSrc) && !/console\./.test(loaderSrc)
      );
    })(),
    "the loader still loads, exits or prints at module scope",
  );

  // A refused env must surface as one classified, redacted line — no path, no
  // host, no ref, no stack — because that is the failure operators see most.
  const envModule = await import("./lib/load-acceptance-env");
  const refused = new envModule.AcceptanceEnvError(
    "PROJECT_REF_NOT_ALLOWED",
    `db.${ACCEPT}.supabase.co rejected for C:\\Users\\someone\\apps\\web\\.env.acceptance`,
  );
  const refusedLine = redaction ? redaction.formatAcceptanceError(refused, "load env") : "";
  check(
    "J7-refused-env-is-one-redacted-line",
    refusedLine.includes("AcceptanceEnvError") &&
      !new RegExp(ACCEPT, "i").test(refusedLine) &&
      !/supabase\.(?:com|co)/i.test(refusedLine) &&
      !/Users\\someone/.test(refusedLine) &&
      !refusedLine.includes("\n"),
    `refused-env line is not safe: ${refusedLine.slice(0, 90)}`,
  );

  console.log("\nK. Target authority agrees with the driver, and CLIs are inert on import");
  // The guard decides which database may be touched; the pg driver decides which
  // database is ACTUALLY reached. If the two read the same URL differently, the
  // guard's verdict is worthless — it can say ACCEPTANCE while the driver ships
  // the acceptance password somewhere else.
  const pgcs = (await import("pg-connection-string")) as unknown as {
    parse(s: string): { host?: string | null; port?: string | null; user?: string; database?: string | null };
    default?: { parse(s: string): { host?: string | null; user?: string } };
  };
  const driverParse = pgcs.parse ?? pgcs.default?.parse;
  const HISTORICAL = "cpeoiqppesacjlyrszrl";

  const DIVERGENCE_CASES: Array<[string, string]> = [
    [
      "K1-at-in-query-fakes-a-safe-host",
      `postgresql://postgres.${ACCEPT}:pw@evil.attacker.example:5432/postgres?options=@aws-0-eu-central-1.pooler.supabase.com`,
    ],
    [
      "K2-at-in-query-hides-the-primary-host",
      `postgresql://postgres.${ACCEPT}:pw@db.${PRIMARY}.supabase.co:5432/postgres?opt=@aws-0-eu-central-1.pooler.supabase.com`,
    ],
    [
      "K3-primary-ref-in-username",
      `postgresql://postgres.${PRIMARY}:pw@db.${ACCEPT}.supabase.co:5432/postgres`,
    ],
    [
      "K4-historical-ref-in-raw-string",
      `postgresql://postgres.${ACCEPT}:pw@db.${ACCEPT}.supabase.co:5432/postgres?app=${HISTORICAL}`,
    ],
    [
      "K5-at-in-path",
      `postgresql://postgres.${ACCEPT}:pw@evil.attacker.example:5432/postgres@aws-0-eu-central-1.pooler.supabase.com`,
    ],
  ];
  for (const [name, url] of DIVERGENCE_CASES) {
    expectReject(name, env(url, url));
  }
  expectReject(
    "K6-two-urls-different-database",
    env(
      `postgresql://postgres.${ACCEPT}:pw@aws-0-eu-central-1.pooler.supabase.com:6543/postgres`,
      `postgresql://postgres.${ACCEPT}:pw@aws-0-eu-central-1.pooler.supabase.com:5432/other_db`,
    ),
  );

  // The guard must read the URL through the SAME parser the driver uses.
  if (driverParse) {
    const divergences: string[] = [];
    for (const [name, url] of [...DIVERGENCE_CASES, ["K7-accepted-url", poolerUrl(ACCEPT)] as const]) {
      const guardParsed = parseAcceptancePostgresUrl(url);
      const driverParsed = driverParse(url);
      if (guardParsed && guardParsed.host !== (driverParsed.host ?? "")) {
        divergences.push(`${name}`);
      }
    }
    check(
      "K7-guard-host-equals-driver-host",
      divergences.length === 0,
      `guard and pg disagree on: ${divergences.join(", ")}`,
    );
  } else {
    check("K7-guard-host-equals-driver-host", false, "pg-connection-string parse not resolvable");
  }
  // Positive control: the OLD lastIndexOf("@") rule must be visibly wrong.
  const naiveHost = (raw: string): string => {
    const after = raw.replace(/^postgres(?:ql)?:\/\//i, "");
    const at = after.lastIndexOf("@");
    const hostPort = after.slice(at + 1).split(/[/?]/)[0]!;
    return hostPort.split(":")[0]!;
  };
  check(
    "K8-divergence-control-old-rule-was-wrong",
    driverParse
      ? naiveHost(DIVERGENCE_CASES[0]![1]) !== (driverParse(DIVERGENCE_CASES[0]![1]).host ?? "")
      : false,
    "the control cannot show the old parser diverging, so K7 proves nothing",
  );

  // Every acceptance CLI must be inert when imported: no env read, no Prisma,
  // no spawn, no exit, no DB call. A verifier that imports one of them must not
  // start it — that is how a "no DB" verifier began running the full E2E.
  const CLI_ENTRIES = (readdirSync(SCRIPTS_DIR) as string[])
    .filter((n) => n.endsWith(".ts"))
    .filter((n) => n.includes("acceptance") || n.startsWith("precheck-personal-resource"))
    .sort();
  // One predicate, used on the real files AND on the synthetic controls below,
  // so a detector that stopped detecting cannot pass by finding nothing.
  //
  // It asks about POSITION, not about presence: everything the guard runs sits
  // indented inside `if (isAcceptanceCliEntrypoint(module)) {`, so any starting
  // call still written at column zero is outside the guard by construction.
  // Checking only that the file MENTIONS the guard would pass a file whose
  // `main()` had been moved back out of the block — the exact edit the gate
  // exists to catch. `require.main === module` is not accepted as a guard: it is
  // the pattern this slice replaced, so allowing it would mark an unconverted
  // file as closed.
  const COLUMN_ZERO_RUN = [
    /^(?:void\s+|await\s+)?(?:main|run|start|execute)\s*\(\)/m,
    /^\(async\s*\(\s*\)\s*=>/m,
    /^try\s*\{\s*$[\s\S]{0,160}?^\s{0,4}(?:await\s+)?main\(\);/m,
  ];
  const runsOnImport = (source: string): boolean =>
    COLUMN_ZERO_RUN.some((pattern) => pattern.test(source));
  const unguarded: string[] = [];
  const bareEntry: string[] = [];
  for (const entry of CLI_ENTRIES) {
    const source = stripComments(readFileSync(join(SCRIPTS_DIR, entry), "utf8"));
    if (runsOnImport(source)) unguarded.push(entry);
    if (/^\s*void\s+main\(\);/m.test(source)) bareEntry.push(entry);
  }
  check(
    "K9-every-cli-entrypoint-is-guarded",
    unguarded.length === 0,
    `runs on import: ${unguarded.join(", ")}`,
  );
  check(
    "K10-no-bare-void-main",
    bareEntry.length === 0,
    `no catch boundary in: ${bareEntry.join(", ")}`,
  );
  check(
    "K11-cli-inventory-is-complete",
    CLI_ENTRIES.length >= 13,
    `only ${CLI_ENTRIES.length} CLI entries inventoried`,
  );

  // normalize writes to .env.acceptance; it must go through the canonical guard.
  const normalizeSrc = stripComments(
    readFileSync(join(SCRIPTS_DIR, "normalize-acceptance-db-urls-v1.ts"), "utf8"),
  );
  check(
    "K12-normalize-runs-the-canonical-guard",
    /evaluateAcceptanceDbTarget|loadAcceptanceEnv/.test(normalizeSrc),
    "normalize prints ACCEPTANCE_ALLOWLISTED without ever asking the canonical guard",
  );
  // "Not silent" is two conditions: verification is not hard-disabled, and any
  // opt-out announces itself. A renamed bypass that still says nothing is worse
  // than the literal one, because it reads as if the target had been proven.
  const targetSrc = stripComments(
    readFileSync(join(SCRIPTS_DIR, "verify-acceptance-db-target-v1.ts"), "utf8"),
  );
  check(
    "K13-no-silent-tls-bypass",
    !/rejectUnauthorized:\s*false/.test(targetSrc) && /TLS VERIFICATION:/.test(targetSrc),
    "certificate verification is disabled, or a bypass would not announce itself",
  );
  const pkg = readFileSync(join(SCRIPTS_DIR, "..", "package.json"), "utf8");
  check(
    "K14-guarded-migrate-paths-exist",
    /"acceptance:migrate-deploy"/.test(pkg) && /"acceptance:migrate-status"/.test(pkg),
    "there is no guarded npm entry for the acceptance migrate paths",
  );
  check(
    "K15-acceptance-scripts-never-call-raw-prisma",
    !/"acceptance:[a-z-]+":\s*"[^"]*(?<!tsx )prisma /.test(pkg),
    "an acceptance npm script reaches the raw prisma CLI",
  );
  // The URL authority is imported directly, so the package must be declared
  // directly — reaching it through `pg`'s hoisted tree made the guard's meaning
  // depend on another package's dependency graph. Pinned exactly, because a
  // range would let the parser's semantics move under the guard.
  // Parsed, not grepped: the gate says "declared exact DEPENDENCY", and a match
  // anywhere in the file would also be satisfied by devDependencies or overrides.
  let declaredParserSpec: unknown = null;
  try {
    declaredParserSpec = (JSON.parse(pkg) as { dependencies?: Record<string, string> })
      .dependencies?.["pg-connection-string"];
  } catch {
    // A package.json that does not parse fails the gate below rather than throwing.
  }
  check(
    "K15b-url-parser-is-a-declared-exact-dependency",
    declaredParserSpec === "2.14.0",
    "pg-connection-string is not declared in dependencies as an exact version",
  );

  // Positive controls. Each new gate above passes by finding nothing, so each
  // needs a synthetic defect its own detector must still catch.
  check(
    "K16-entry-guard-control-detects-an-unguarded-file",
    runsOnImport("main().catch(() => process.exit(1));\n") &&
      runsOnImport("void main();\n") &&
      runsOnImport("await main();\n") &&
      runsOnImport("(async () => {\n  await main();\n})();\n") &&
      // The one that a presence-only check would miss: guard imported and even
      // written, but the call moved back out of the block.
      runsOnImport(
        "if (isAcceptanceCliEntrypoint(module)) {\n  setup();\n}\nmain().catch(() => {});\n",
      ) &&
      !runsOnImport("if (isAcceptanceCliEntrypoint(module)) {\n  main().catch(() => {});\n}\n"),
    "the entrypoint detector no longer separates a guarded file from an unguarded one",
  );
  check(
    "K16b-no-cli-still-uses-the-replaced-require-main-guard",
    CLI_ENTRIES.every(
      (entry) =>
        !/require\.main === module/.test(
          stripComments(readFileSync(join(SCRIPTS_DIR, entry), "utf8")),
        ),
    ),
    "an acceptance CLI still gates itself on require.main instead of the canonical helper",
  );
  check(
    "K17-normalize-guard-control-detects-an-unasked-guard",
    !/evaluateAcceptanceDbTarget|loadAcceptanceEnv/.test(
      'console.log("TARGET_CLASSIFICATION=ACCEPTANCE_ALLOWLISTED");',
    ),
    "the normalize detector would accept a file that never asks the canonical guard",
  );
  // The authority must own every field the connection is actually steered by.
  // `pg-connection-string` copies query parameters OVER the authority, so a URL
  // can name a safe host and still connect elsewhere; and the Prisma CLI, which
  // this slice just gave a guarded `deploy` path, parses connection strings on
  // its own and does not agree about `?host=`.
  const pooler = "aws-0-eu-central-1.pooler.supabase.com";
  const steered = (query: string): string =>
    `postgresql://postgres.${ACCEPT}:pw@evil.attacker.example:5432/postgres?${query}`;
  const good = (port: string): string =>
    `postgresql://postgres.${ACCEPT}:pw@${pooler}:${port}/postgres?sslmode=verify-full`;
  expectReject("K19-query-host-override", env(steered(`host=${pooler}`), steered(`host=${pooler}`)));
  expectReject("K20-query-port-override", env(`${good("6543")}&port=5432`, good("5432")));
  expectReject(
    "K21-query-reads-a-file-from-disk",
    env(`${good("6543")}&sslrootcert=/etc/passwd`, good("5432")),
  );
  expectReject(
    "K22-tls-disabled-in-url",
    env(`postgresql://postgres.${ACCEPT}:pw@${pooler}:6543/postgres?sslmode=disable`, good("5432")),
  );
  expectReject("K23-no-database-named", env(good("6543"), `postgresql://postgres.${ACCEPT}:pw@${pooler}:5432`));
  // Two independent reviews found the same shape of hole in the first version of
  // this policy: the guard normalised query keys more generously than the driver,
  // so a key the driver never saw still counted as proof of TLS. Each escape gets
  // its own row, because they fail through different mechanisms.
  expectReject(
    "K28-fragment-hides-the-query-from-the-driver",
    env(`${good("6543")}#?sslmode=verify-full`, good("5432")),
  );
  expectReject(
    "K29-uppercase-sslmode-is-not-proof-of-tls",
    env(`postgresql://postgres.${ACCEPT}:pw@${pooler}:6543/postgres?SSLMODE=REQUIRE`, good("5432")),
  );
  expectReject(
    "K30-connection-string-parameter-replaces-the-target",
    env(`${good("6543")}&connectionString=postgres%3A%2F%2Fu%3Ap%40evil.example.com%2Fx`, good("5432")),
  );
  expectReject(
    "K31-libpq-compat-turns-require-into-unverified",
    env(`${good("6543")}&uselibpqcompat=true`, good("5432")),
  );
  expectReject(
    "K32-unknown-query-key-is-refused-by-default",
    env(`${good("6543")}&replication=database`, good("5432")),
  );
  // The TLS contract is "the server is verified", not "TLS is on". Every mode
  // below encrypts something; none of them proves who answered, and libpq and
  // pg-connection-string do not even agree on which of them check a certificate.
  // Each spelling gets its own row so a future relaxation cannot pass quietly.
  const bareTarget = `postgresql://postgres.${ACCEPT}:pw@${pooler}:6543/postgres`;
  for (const mode of ["require", "verify-ca", "prefer", "allow", "disable", "no-verify"]) {
    expectReject(
      `K33-sslmode-${mode}-does-not-verify-the-server`,
      env(`${bareTarget}?sslmode=${mode}`, good("5432")),
      "URL_TLS_DOWNGRADED",
    );
  }
  check(
    "K34-verify-full-is-accepted",
    evaluateAcceptanceDbTarget(env(`${bareTarget}?sslmode=verify-full`, good("5432"))).ok,
    "the one accepted TLS mode is refused, so K33 only proves everything fails",
  );
  // A repeated key is a string the two consumers read differently: pg keeps the
  // last value, libpq the first. Both orders are refused, so neither reading wins.
  expectReject(
    "K35-duplicate-sslmode-downgrade-last",
    env(`${bareTarget}?sslmode=verify-full&sslmode=disable`, good("5432")),
    "URL_QUERY_KEY_REPEATED",
  );
  expectReject(
    "K35b-duplicate-sslmode-downgrade-first",
    env(`${bareTarget}?sslmode=disable&sslmode=verify-full`, good("5432")),
    "URL_QUERY_KEY_REPEATED",
  );
  expectReject(
    "K35c-duplicate-sslmode-even-when-identical",
    env(`${bareTarget}?sslmode=verify-full&sslmode=verify-full`, good("5432")),
    "URL_QUERY_KEY_REPEATED",
  );
  // Order must not decide the verdict. If it did, the guard's answer would depend
  // on how the operator happened to type the line rather than on what it means.
  const verdictFor = (query: string): boolean =>
    evaluateAcceptanceDbTarget(env(`${bareTarget}?${query}`, good("5432"))).ok;
  const SAME_QUERY_REORDERED = [
    "sslmode=verify-full&pgbouncer=true&connection_limit=1",
    "connection_limit=1&sslmode=verify-full&pgbouncer=true",
    "pgbouncer=true&connection_limit=1&sslmode=verify-full",
  ];
  const orderings = SAME_QUERY_REORDERED.map(verdictFor);
  check(
    "K36-query-key-order-does-not-change-the-verdict",
    orderings.every((accepted) => accepted) ,
    `the same query in a different order gives different verdicts: ${orderings.join(",")}`,
  );
  // Control: the comparison must be able to see disagreement. A query that
  // differs only in a value the guard rejects has to split the verdicts.
  const dissenting = [verdictFor(SAME_QUERY_REORDERED[0]!), verdictFor("sslmode=require&pgbouncer=true")];
  check(
    "K36b-order-control-can-still-see-a-disagreement",
    dissenting[0] !== dissenting[1],
    "the order comparison reports agreement even when two queries genuinely differ",
  );

  // What the driver actually builds from an accepted URL. The guard may not
  // merely believe TLS was requested: the config `pg` derives has to carry a
  // certificate check. `undefined` is the worst case, not a neutral one — it
  // means the driver would open the connection with no TLS configuration at all.
  const sslConfigOf = (url: string): unknown =>
    driverParse ? (driverParse(url) as { ssl?: unknown }).ssl : "unmeasured";
  const verifiesCertificate = (ssl: unknown): boolean => {
    if (ssl === "unmeasured" || ssl === undefined || ssl === false || ssl === "false") return false;
    if (typeof ssl === "object" && ssl !== null) {
      return (ssl as { rejectUnauthorized?: unknown }).rejectUnauthorized !== false;
    }
    return true;
  };
  const acceptedUrl = `${bareTarget}?sslmode=verify-full`;
  check(
    "K37-driver-config-does-not-disable-certificate-verification",
    evaluateAcceptanceDbTarget(env(acceptedUrl, good("5432"))).ok &&
      verifiesCertificate(sslConfigOf(acceptedUrl)),
    "the accepted URL produces a driver config with no TLS, or with certificate checking off",
  );
  check(
    "K37b-driver-config-control-rejects-the-weak-shapes",
    !verifiesCertificate(undefined) &&
      !verifiesCertificate(false) &&
      !verifiesCertificate({ rejectUnauthorized: false }) &&
      !verifiesCertificate("unmeasured") &&
      verifiesCertificate({}),
    "the certificate-config predicate would call an unencrypted or unverified config safe",
  );

  // Named for what it measures. The wrapper's own contract — that it derives the
  // child's URL from the canonical guard rather than from ambient env — is G9's
  // job; what is measured here is that the URL such a path may carry is the
  // verified one. The Prisma CLI's own reading of that URL is NOT measured here.
  check(
    "K38-guard-refuses-weaker-modes-on-the-migrate-url",
    evaluateAcceptanceDbTarget(env(acceptedUrl, good("5432"))).ok &&
      !evaluateAcceptanceDbTarget(env(`${bareTarget}?sslmode=require`, good("5432"))).ok &&
      !evaluateAcceptanceDbTarget(env(bareTarget, good("5432"))).ok,
    "the URL the guarded migrate path may carry is not restricted to the verified mode",
  );

  expectReject(
    "K40-padded-url-is-refused",
    env(` ${bareTarget}?sslmode=verify-full `, good("5432")),
    "URL_HAS_SURROUNDING_WHITESPACE",
  );

  // The migrate path. What the schema engine does with the canonical sslmode is
  // NOT MEASURED here — establishing it needs a handshake — so these rows measure
  // the refusal instead, and the refusal's completeness. None of them claims the
  // path is verified; a status may never outrun its measurement.
  const migrateTls = prismaTlsStatus();
  const acceptanceSources = (readdirSync(SCRIPTS_DIR, { recursive: true }) as string[])
    .map((name) => name.split(String.fromCharCode(92)).join("/"))
    .filter((name) => name.endsWith(".ts"))
    .filter((name) => name.includes("acceptance") || name.startsWith("precheck-personal-resource"))
    .filter((name) => !name.endsWith("verify-acceptance-target-allowlist-v1.ts"));
  const downgradeSpellings =
    new RegExp("sslmode=(?:require|prefer|allow|disable|no-verify)|sslaccept|rejectUnauthorized:\\s*false|accept_invalid_certs");
  const downgraders = acceptanceSources.filter((name) =>
    downgradeSpellings.test(stripComments(readFileSync(join(SCRIPTS_DIR, name), "utf8"))),
  );
  check(
    "K41-no-acceptance-script-spells-a-weaker-tls-mode",
    downgraders.length === 0,
    `a weaker TLS spelling lives in: ${downgraders.join(", ")}`,
  );
  check(
    "K41b-downgrade-detector-still-detects",
    downgradeSpellings.test("const u = base + '?sslmode=require';") &&
      downgradeSpellings.test("ssl: { rejectUnauthorized: false }") &&
      downgradeSpellings.test("sslaccept=strict") &&
      !downgradeSpellings.test("const u = base + '?sslmode=verify-full';"),
    "the downgrade detector no longer separates a weaker spelling from the canonical one",
  );
  // BEHAVIOUR, not text. The previous version of this gate searched the wrapper
  // source for a name and compared its index with the index of "spawn(" — and
  // the name's first occurrence was its own import line, so a refusal moved
  // BELOW the spawn would still have passed. What matters is not where a string
  // appears but whether a process is started, so the decision is driven here
  // with a spawn that fails the gate if it is ever called.
  const wrapper = (await import("./run-acceptance-prisma-v1")) as Record<string, unknown>;
  const runMigrate = wrapper.executeAcceptancePrisma as
    | ((
        argv: string[],
        deps: {
          loadEnv: () => void;
          tlsStatus: () => { verificationProven: boolean; detail: string };
          readEnv: () => { DATABASE_URL: string; DIRECT_URL: string };
          spawn: (...args: unknown[]) => unknown;
        },
      ) => { outcome: string; reason?: string })
    | undefined;
  const driveMigrate = (
    argv: string[],
    tlsStatus: () => { verificationProven: boolean; detail: string },
  ): { outcome: string; reason?: string; spawned: boolean } => {
    let spawned = false;
    const result = runMigrate!(argv, {
      loadEnv: () => {},
      tlsStatus,
      readEnv: () => ({
        DATABASE_URL: `${bareTarget}?sslmode=verify-full`,
        DIRECT_URL: good("5432"),
      }),
      spawn: () => {
        spawned = true;
        // A spawn on a closed path must make the gate red, not merely be noticed.
        throw new Error("spawn reached on a closed migrate path");
      },
    });
    return { ...result, spawned };
  };
  const closedStatus = () => ({ verificationProven: false, detail: "closed for this measurement" });
  let migrateDrive: Array<{ argv: string; outcome: string; reason?: string; spawned: boolean }> = [];
  let migrateDriveError = "";
  try {
    migrateDrive = [["status"], ["deploy", "--apply"]].map((argv) => ({
      argv: argv.join(" "),
      ...driveMigrate(argv, closedStatus),
    }));
  } catch (driveError) {
    migrateDriveError = formatAcceptanceError(driveError);
  }
  check(
    "K42-migrate-refuses-before-any-process-is-started",
    typeof runMigrate === "function" &&
      migrateDriveError === "" &&
      migrateDrive.length === 2 &&
      migrateDrive.every(
        (run) =>
          run.spawned === false &&
          run.outcome === "refused" &&
          run.reason === PRISMA_TLS_UNAVAILABLE_REASON,
      ),
    typeof runMigrate !== "function"
      ? "the wrapper exposes no drivable execution decision, so the boundary cannot be measured"
      : migrateDriveError !== ""
        ? `driving the migrate decision threw: ${migrateDriveError}`
        : `runs: ${migrateDrive.map((r) => `${r.argv}->${r.outcome}/spawned=${r.spawned}`).join(", ")}`,
  );
  // Mutation control: if verification WERE proven, the same code path must reach
  // the spawn. The observation is the spawn's own flag, not "something threw" —
  // an implementation that failed earlier for an unrelated reason would satisfy
  // a bare catch and leave K42 unproven.
  let provenReachedSpawn = false;
  try {
    runMigrate!(["status"], {
      loadEnv: () => {},
      tlsStatus: () => ({ verificationProven: true, detail: "synthetic" }),
      readEnv: () => ({
        DATABASE_URL: `${bareTarget}?sslmode=verify-full`,
        DIRECT_URL: good("5432"),
      }),
      spawn: () => {
        provenReachedSpawn = true;
        return {};
      },
    });
  } catch {
    // A throw before the spawn leaves the flag false, which is the failure.
  }
  check(
    "K42b-refusal-control-the-path-does-reach-spawn-when-proven",
    typeof runMigrate === "function" && provenReachedSpawn,
    "the migrate path never spawns even when verification is proven, so K42 proves nothing",
  );
  // K42 measures ORDER with an injected status; this measures TODAY'S state of
  // the production function. Different axes: without this row, a
  // prismaTlsStatus() that started returning true would open the migrate path
  // with the whole battery still green.
  // The seam must refuse a foreign target on its own, even when the injected
  // loader waves it through — otherwise the boundary is the caller's honesty.
  let foreignSpawned = false;
  let foreignOutcome = "";
  try {
    const foreign = runMigrate!(["status"], {
      loadEnv: () => {},
      tlsStatus: () => ({ verificationProven: true, detail: "synthetic" }),
      readEnv: () => ({
        DATABASE_URL: `postgresql://postgres.${PRIMARY}:pw@${pooler}:6543/postgres?sslmode=verify-full`,
        DIRECT_URL: good("5432"),
      }),
      spawn: () => {
        foreignSpawned = true;
        return {};
      },
    });
    foreignOutcome = foreign.outcome;
  } catch {
    foreignOutcome = "threw";
  }
  check(
    "K42c-seam-refuses-a-foreign-target-on-its-own",
    foreignSpawned === false && foreignOutcome === "refused",
    `a caller that stubs the loader reached: ${foreignOutcome}, spawned=${foreignSpawned}`,
  );
  check(
    "K43-production-migrate-status-is-unconditionally-closed",
    prismaTlsStatus().verificationProven === false,
    "the production TLS status claims a verified connection that no handshake measured",
  );

  // The refusal is a state the report must carry, not a detail buried in a log:
  // an operator reading only the verdict must learn the path is closed.
  console.log(`  MIGRATE PATH: CLOSED — ${migrateTls.detail}`);

  // The one remaining way to hand the acceptance password to an unverified
  // server was an env flag on the very script whose job is proving the target.
  // It is measured behaviourally: the TLS options are asked for under every
  // spelling of the flag, and none of them may change the answer.
  const targetVerifier = (await import("./verify-acceptance-db-target-v1")) as Record<string, unknown>;
  const buildTls = targetVerifier.buildAcceptanceTlsOptions as
    | ((host: string, ca?: string) => { rejectUnauthorized: boolean; servername: string })
    | undefined;
  const BYPASS_SPELLINGS = ["1", "true", "yes", "TRUE", "0", ""];
  const savedFlag = process.env.ACCEPTANCE_DB_TLS_INSECURE;
  let tlsAlwaysVerifies = typeof buildTls === "function";
  if (typeof buildTls === "function") {
    for (const spelling of BYPASS_SPELLINGS) {
      process.env.ACCEPTANCE_DB_TLS_INSECURE = spelling;
      if (buildTls("example.pooler.supabase.com").rejectUnauthorized !== true) {
        tlsAlwaysVerifies = false;
      }
    }
    delete process.env.ACCEPTANCE_DB_TLS_INSECURE;
    if (buildTls("example.pooler.supabase.com").rejectUnauthorized !== true) {
      tlsAlwaysVerifies = false;
    }
  }
  if (savedFlag === undefined) delete process.env.ACCEPTANCE_DB_TLS_INSECURE;
  else process.env.ACCEPTANCE_DB_TLS_INSECURE = savedFlag;
  check(
    "K44-certificate-verification-cannot-be-turned-off",
    tlsAlwaysVerifies,
    typeof buildTls === "function"
      ? "an environment spelling still turns certificate verification off"
      : "the target verifier exposes no TLS options to measure, so the bypass cannot be ruled out",
  );
  // Ratchet over the sources: neither the flag's name nor an indirect spelling
  // of a disabled check may exist anywhere in the acceptance harness. The value
  // is EXTRACTED and compared rather than matched with a negative lookahead —
  // a lookahead after \s* can backtrack to zero width and match its own
  // exception, which is how "rejectUnauthorized: true" read as a violation.
  const verificationDisabled = (source: string): boolean => {
    if (/ACCEPTANCE_DB_TLS_INSECURE|checkServerIdentity/.test(source)) return true;
    for (const hit of source.matchAll(/rejectUnauthorized\s*:\s*([A-Za-z0-9_$.!]+)/g)) {
      if (hit[1] !== "true") return true;
    }
    return false;
  };
  const unsafeSources = acceptanceSources.filter((name) =>
    verificationDisabled(stripComments(readFileSync(join(SCRIPTS_DIR, name), "utf8"))),
  );
  check(
    "K44b-no-acceptance-source-names-a-verification-bypass",
    unsafeSources.length === 0,
    `a verification bypass survives in: ${unsafeSources.join(", ")}`,
  );
  check(
    "K44c-bypass-detector-still-detects",
    verificationDisabled("const x = process.env.ACCEPTANCE_DB_TLS_INSECURE === '1';") &&
      verificationDisabled("ssl: { rejectUnauthorized: allowInsecure }") &&
      verificationDisabled("ssl: { rejectUnauthorized: false }") &&
      verificationDisabled("ssl: { rejectUnauthorized: !bypass }") &&
      verificationDisabled("checkServerIdentity: () => undefined") &&
      !verificationDisabled("ssl: { rejectUnauthorized: true, servername: host }") &&
      !verificationDisabled("rejectUnauthorized: true;"),
    "the bypass detector no longer separates a disabled check from an enabled one",
  );

  // Exact spelling, measured on the RAW query text. A percent-encoded value
  // decodes to the same characters but is not the same string, and a consumer
  // that decodes differently would read a different mode from one the guard
  // called canonical.
  for (const [name, spelling, expected] of [
    ["K45-percent-encoded-value", "%76erify-full", "URL_TLS_DOWNGRADED"],
    ["K45b-percent-encoded-hyphen", "verify%2Dfull", "URL_TLS_DOWNGRADED"],
    ["K45c-percent-encoded-key", "%73slmode=verify-full", "URL_QUERY_OVERRIDES_CONNECTION"],
  ] as const) {
    expectReject(
      name,
      env(
        spelling.includes("=")
          ? `${bareTarget}?${spelling}`
          : `${bareTarget}?sslmode=${spelling}`,
        good("5432"),
      ),
      expected,
    );
  }
  // Control: the canonical spelling is still accepted, and order still does not
  // matter, so the rows above cannot pass by refusing everything.
  check(
    "K45d-exact-spelling-control",
    evaluateAcceptanceDbTarget(env(`${bareTarget}?sslmode=verify-full`, good("5432"))).ok &&
      evaluateAcceptanceDbTarget(
        env(`${bareTarget}?pgbouncer=true&sslmode=verify-full`, good("5432")),
      ).ok,
    "the canonical spelling is refused, so K45 only proves that everything fails",
  );

  // ---------------------------------------------------------------------------
  // The acceptance CA. Supabase signs the pooler with its own root, which is not
  // in Node's trust store, so `verify-full` fails with
  // SELF_SIGNED_CERT_IN_CHAIN. The answer is a pinned CA the operator downloads
  // by hand — never an automatic fetch, and never a relaxed check. These rows
  // measure the refusals; a CA that is present and correct is measured too, but
  // nothing here claims a handshake succeeded.
  const caModule = (await import("./lib/acceptance-ca-v1").catch(() => null)) as {
    evaluateAcceptanceCaPem?: (
      pem: string,
      opts: { expectedFingerprint?: string; now?: Date; parse?: (pem: string) => unknown },
    ) => { ok: boolean; reason?: string; fingerprint?: string };
    resolveAcceptanceCaPath?: (candidate?: string) => { ok: boolean; reason?: string; path?: string };
    loadAcceptanceCa?: (opts: Record<string, unknown>) => { ok: boolean; reason?: string };
    ACCEPTANCE_CA_FINGERPRINT_KEY?: string;
  } | null;
  const evaluateCa = caModule?.evaluateAcceptanceCaPem;
  const resolveCaPath = caModule?.resolveAcceptanceCaPath;

  // Fixtures come from Node's own trust store: real, in-date CA certificates, so
  // the happy path is not a hand-written approximation of one.
  const { rootCertificates } = await import("node:tls");
  const { X509Certificate } = await import("node:crypto");
  // Chosen by PROPERTY, not by index: rootCertificates[0] happens to expire in
  // 2026, and a fixture that ages out would turn the control row red on a date
  // with nothing in the product having changed. The index is also Node-version
  // dependent, so it is not a fixture at all — it is a coincidence.
  const usableRoots = rootCertificates.filter((pem) => {
    try {
      const parsed = new X509Certificate(pem);
      const now = Date.now();
      return (
        parsed.ca &&
        new Date(parsed.validFrom).getTime() < now &&
        new Date(parsed.validTo).getTime() > now
      );
    } catch {
      return false;
    }
  });
  check(
    "K46-L0-fixture-precondition",
    usableRoots.length >= 2,
    `only ${usableRoots.length} currently-valid CA roots available, so the rows below measure nothing`,
  );
  const realCa = usableRoots[0] ?? "";
  const secondCa = usableRoots[1] ?? "";
  const realFingerprint =
    realCa === "" ? "" : new X509Certificate(realCa).fingerprint256.replace(/:/g, "").toLowerCase();

  const caCase = (
    pem: string,
    opts: { expectedFingerprint?: string; now?: Date; parse?: (pem: string) => unknown } = {},
  ): string => {
    if (!evaluateCa) return "NO_MODULE";
    try {
      const decision = evaluateCa(pem, { expectedFingerprint: realFingerprint, ...opts });
      return decision.ok ? "ACCEPTED" : (decision.reason ?? "UNNAMED");
    } catch {
      return "THREW";
    }
  };

  const CA_ROWS: Array<[string, string]> = [
    ["L1-empty-file", caCase("")],
    ["L2-not-pem", caCase("this is not a certificate")],
    ["L3-private-key-present", caCase(`${realCa}\n-----BEGIN PRIVATE KEY-----\nAAAA\n-----END PRIVATE KEY-----\n`)],
    ["L4-multiple-certificates", caCase(`${realCa}\n${secondCa}`)],
    ["L5-truncated-pem", caCase(realCa.slice(0, Math.floor(realCa.length / 2)))],
    [
      "L5b-second-anchor-under-an-alias-label",
      caCase(`${realCa}
${secondCa.replace(/CERTIFICATE-----/g, "TRUSTED CERTIFICATE-----")}`),
    ],
    ["L5c-lowercase-private-key-label", caCase(`${realCa}
-----begin private key-----
AA
-----end private key-----
`)],
  ];
  for (const [name, outcome] of CA_ROWS) {
    check(
      `K46-${name}`,
      outcome !== "ACCEPTED" && outcome !== "NO_MODULE" && outcome !== "THREW",
      `outcome was ${outcome}`,
    );
  }
  // The validity window is the evaluator's invariant, not the parser's. An
  // `Invalid Date` compares false in BOTH directions, so a missing check here is
  // a fail-open that looks like no code at all — and `parse` is an exported
  // option, so the defence has to sit on this side of that seam.
  const INVALID_DATES: Array<[string, unknown, unknown]> = [
    ["invalid-date", new Date("not a date"), new Date("not a date")],
    ["nan-time", new Date(NaN), new Date(NaN)],
    ["wrong-type", "2020-01-01", "2030-01-01"],
    ["missing", undefined, undefined],
    ["infinite", new Date(8.64e15 + 1), new Date(8.64e15 + 1)],
  ];
  for (const [label, from, to] of INVALID_DATES) {
    check(
      `K46-L12-${label}-is-refused`,
      caCase(realCa, {
        parse: () =>
          ({
            ca: true,
            fingerprint256: realFingerprint,
            validFromDate: from,
            validToDate: to,
            pem: realCa,
          }) as never,
      }) === "CA_NOT_VALID_PEM",
      `a certificate with ${label} validity dates was not refused`,
    );
  }
  check(
    "K46-L13-a-throwing-parser-is-refused",
    caCase(realCa, {
      parse: () => {
        throw new Error("synthetic parser failure");
      },
    }) === "CA_NOT_VALID_PEM",
    "a parser that throws does not produce a refusal",
  );
  // Control: valid dates from an injected parser are still ACCEPTED, so the rows
  // above are not passing because every injected parser is refused.
  check(
    "K46-L14-date-control-valid-window-still-accepted",
    caCase(realCa, {
      parse: () => ({
        ca: true,
        fingerprint256: realFingerprint,
        validFromDate: new Date(0),
        validToDate: new Date(4102444800000),
        pem: realCa,
      }),
    }) === "ACCEPTED",
    "a certificate with a valid window is refused, so the date rows prove nothing",
  );

  check(
    "K46-L6-not-a-certificate-authority",
    caCase(realCa, { parse: () => ({ ca: false, fingerprint256: "", validFromDate: new Date(0), validToDate: new Date(8.64e15) }) }) ===
      "CA_NOT_A_CERTIFICATE_AUTHORITY",
    "a leaf certificate would be accepted as the acceptance CA",
  );
  check(
    "K46-L7-expired",
    caCase(realCa, { now: new Date(8.64e15) }) === "CA_EXPIRED",
    "an expired CA is not refused",
  );
  check(
    "K46-L8-not-yet-valid",
    caCase(realCa, { now: new Date(0) }) === "CA_NOT_YET_VALID",
    "a CA whose validity has not started is not refused",
  );
  check(
    "K46-L9-fingerprint-not-declared",
    caCase(realCa, { expectedFingerprint: undefined }) === "CA_FINGERPRINT_NOT_DECLARED",
    "a CA is accepted without a declared fingerprint to compare against",
  );
  check(
    "K46-L10-fingerprint-mismatch",
    caCase(realCa, { expectedFingerprint: "0".repeat(64) }) === "CA_FINGERPRINT_MISMATCH",
    "a different CA passes the pin",
  );
  // Control: the correct CA with its own fingerprint is ACCEPTED, or the ten
  // refusals above would only prove that everything fails.
  check(
    "K46-L11-correct-ca-is-accepted",
    caCase(realCa) === "ACCEPTED",
    "the pinned CA is refused, so the rows above prove nothing",
  );
  // Path: only the one fixed location, and only a regular file there. These are
  // two different claims and get two rows; the first also asserts the canonical
  // path is ACCEPTED, so a function that refused everything could not pass it.
  const caPathOf = (candidate?: string): { ok: boolean; path?: string } =>
    typeof resolveCaPath === "function" ? resolveCaPath(candidate) : { ok: true };
  check(
    "K47a-only-the-pinned-path-is-accepted",
    typeof resolveCaPath === "function" &&
      caPathOf("../../etc/ca.crt").ok === false &&
      caPathOf("/etc/ca.crt").ok === false &&
      caPathOf(".acceptance/../../elsewhere/supabase-ca.crt").ok === false &&
      caPathOf(".acceptance/other.crt").ok === false &&
      caPathOf(".acceptance/supabase-ca.crt").ok === true &&
      caPathOf().ok === true,
    "a path outside the pinned acceptance directory is accepted, or the pinned one is refused",
  );
  const loadCa = caModule?.loadAcceptanceCa as
    | ((opts: Record<string, unknown>) => { ok: boolean; reason?: string })
    | undefined;
  // A link is refused through an injected stat rather than by creating one: the
  // verifier must not leave a symlink behind, and the branch still gets measured.
  const asLink = { isFile: () => true, isSymbolicLink: () => true, size: 1024 };
  const asFile = { isFile: () => true, isSymbolicLink: () => false, size: 1024 };
  const asDirectory = { isFile: () => false, isSymbolicLink: () => false, size: 1024 };
  const asHuge = { isFile: () => true, isSymbolicLink: () => false, size: 50 * 1024 * 1024 };
  const loadWith = (stat: unknown): string => {
    if (!loadCa) return "NO_MODULE";
    const decision = loadCa({ expectedFingerprint: realFingerprint, lstat: () => stat });
    return decision.ok ? "ACCEPTED" : (decision.reason ?? "UNNAMED");
  };
  check(
    "K47b-a-link-or-directory-is-not-a-pinned-ca",
    loadWith(asLink) === "CA_PATH_NOT_A_REGULAR_FILE" &&
      loadWith(asDirectory) === "CA_PATH_NOT_A_REGULAR_FILE" &&
      loadWith(asHuge) === "CA_FILE_UNREADABLE" &&
      // Control: a plain file of a sane size gets PAST this check (and then fails
      // later for the absent file), so the row is not passing by refusing all.
      !["CA_PATH_NOT_A_REGULAR_FILE", "ACCEPTED"].includes(loadWith(asFile)),
    "a symlink, a directory or an oversized file is treated as the pinned CA",
  );
  // The CA file must never be committable.
  const webGitignore = readFileSync(join(SCRIPTS_DIR, "..", ".gitignore"), "utf8");
  check(
    "K48-acceptance-ca-directory-is-gitignored",
    /^\/?\.acceptance\/?$/m.test(webGitignore),
    "the .acceptance directory is not ignored, so a downloaded CA could be committed",
  );
  // The connection plan, DRIVEN. A source-offset comparison proved nothing here:
  // deleting the refusal block and dropping the CA from the ssl object both left
  // the old row green. What is measured now is the object a client would be
  // built from — and, for each claim, a mutation of that object that must fail.
  const targetModule = (await import("./verify-acceptance-db-target-v1")) as unknown as {
    planAcceptanceClient?: (
      meta: { user: string; password: string; host: string; port: string; database: string },
      ca: { ok: boolean; pem?: string; reason?: string },
    ) => { outcome: string; reason?: string; config?: Record<string, unknown> };
  };
  const planClient = targetModule.planAcceptanceClient;
  const syntheticMeta = {
    user: `postgres.${ACCEPT}`,
    password: PW,
    host: pooler,
    port: "5432",
    database: "postgres",
  };
  const PINNED_PEM = ["-----BEGIN CERTIFICATE-----", "PINNED", "-----END CERTIFICATE-----", ""].join("\n");
  const refusedPlan = planClient?.(syntheticMeta, { ok: false, reason: "CA_FILE_MISSING" });
  const acceptedPlan = planClient?.(syntheticMeta, { ok: true, pem: PINNED_PEM });
  const sslOf = (plan?: { config?: Record<string, unknown> }): Record<string, unknown> =>
    (plan?.config?.ssl as Record<string, unknown>) ?? {};
  check(
    "K49a-a-refused-ca-produces-no-client",
    typeof planClient === "function" &&
      refusedPlan?.outcome === "refused" &&
      refusedPlan?.config === undefined,
    typeof planClient === "function"
      ? `a refused CA still produced: ${refusedPlan?.outcome}`
      : "the target verifier exposes no connection plan, so the boundary cannot be measured",
  );
  // The predicates are named so each can be applied to a mutated object below.
  const carriesPinnedCa = (ssl: Record<string, unknown>): boolean => ssl.ca === PINNED_PEM;
  const verifies = (ssl: Record<string, unknown>): boolean => ssl.rejectUnauthorized === true;
  const identityIntact = (ssl: Record<string, unknown>): boolean =>
    ssl.checkServerIdentity === undefined;
  check(
    "K49b-the-canonical-ca-reaches-the-ssl-options",
    typeof planClient === "function" &&
      acceptedPlan?.outcome === "connect" &&
      carriesPinnedCa(sslOf(acceptedPlan)),
    "the verified CA is not the one the client would trust",
  );
  check(
    "K49c-the-same-ssl-object-still-verifies",
    typeof planClient === "function" && verifies(sslOf(acceptedPlan)),
    "the connection would be made without certificate verification",
  );
  check(
    "K49d-hostname-verification-is-not-replaced",
    typeof planClient === "function" && identityIntact(sslOf(acceptedPlan)),
    "checkServerIdentity is overridden, so the hostname is no longer checked",
  );
  // An empty PEM is the one shape that fails OPEN: Node treats a falsy `ca` as
  // "use the default trust store", so the pin disappears while the options still
  // read `rejectUnauthorized: true`. A blank-looking anchor is not an anchor.
  const BLANK_PEMS: Array<[string, string]> = [
    ["empty", ""],
    ["spaces", "   "],
    ["crlf", "\r\n\r\n"],
    ["tabs-and-newlines", " \t\n \r\n "],
  ];
  const blankPlans = BLANK_PEMS.map(([label, pem]) => ({
    label,
    plan: planClient?.(syntheticMeta, { ok: true, pem } as never),
  }));
  check(
    "K49f-a-blank-ca-is-not-an-anchor",
    typeof planClient === "function" &&
      blankPlans.every(
        ({ plan }) => plan?.outcome === "refused" && plan?.config === undefined,
      ),
    `a blank PEM still produced a client: ${blankPlans
      .filter(({ plan }) => plan?.outcome !== "refused")
      .map(({ label }) => label)
      .join(", ")}`,
  );
  // Control: the canonical PEM still connects and still carries its exact bytes,
  // so the row above cannot pass by refusing every certificate.
  check(
    "K49g-blank-control-canonical-pem-still-connects",
    typeof planClient === "function" &&
      acceptedPlan?.outcome === "connect" &&
      sslOf(acceptedPlan).ca === PINNED_PEM,
    "the canonical PEM is refused, so K49f proves nothing",
  );

  check(
    "K49e-plan-controls-catch-each-weakening",
    !carriesPinnedCa({ rejectUnauthorized: true }) &&
      !carriesPinnedCa({ ca: ["-----BEGIN CERTIFICATE-----", "OTHER", "-----END CERTIFICATE-----", ""].join("\n") }) &&
      !verifies({ ca: PINNED_PEM }) &&
      !verifies({ ca: PINNED_PEM, rejectUnauthorized: false }) &&
      !verifies({ ca: PINNED_PEM, rejectUnauthorized: "true" }) &&
      !identityIntact({ checkServerIdentity: () => undefined }),
    "a dropped CA, a substituted CA or a disabled check would satisfy K49b-K49d",
);

  // The session, DRIVEN end to end — and judged on what the CLIENT recorded, not
  // on what the production code said it was doing. An earlier version read the
  // decision out of the same `onEvent` stream the production emits, so deleting
  // `client.end()` outright left the row green: the narration outlived the call
  // it was narrating. `onEvent` is kept as a second observation only.
  const openSession = (
    targetModule as unknown as {
      openAcceptanceSession?: (
        meta: { user: string; password: string; host: string; port: string; database: string },
        deps: {
          loadCa: () => unknown;
          createClient: (config: { ssl?: Record<string, unknown> }) => unknown;
          onEvent?: (event: string) => void;
        },
      ) => Promise<{ outcome: string; close?: () => Promise<void> }>;
    }
  ).openAcceptanceSession;

  type SessionRun = {
    outcome: string;
    factoryCalls: number;
    connectCalls: number;
    queryCalls: number;
    endCalls: number;
    calls: string[];
    events: string[];
    ssl: Record<string, unknown>;
    threw: string;
  };
  const driveSession = async (
    ca: unknown,
    behaviour: { failOn?: "connect" | "query"; closeAfter?: boolean } = {},
  ): Promise<SessionRun> => {
    const run: SessionRun = {
      outcome: "NOT_RUN",
      factoryCalls: 0,
      connectCalls: 0,
      queryCalls: 0,
      endCalls: 0,
      calls: [],
      events: [],
      ssl: {},
      threw: "",
    };
    if (!openSession) return run;
    const client = {
      connect: async (): Promise<void> => {
        run.connectCalls += 1;
        run.calls.push("connect");
        if (behaviour.failOn === "connect") throw new Error("synthetic connect failure");
      },
      query: async (): Promise<{ rows: Array<{ ok: number }> }> => {
        run.queryCalls += 1;
        run.calls.push("query");
        if (behaviour.failOn === "query") throw new Error("synthetic query failure");
        return { rows: [{ ok: 1 }] };
      },
      end: async (): Promise<void> => {
        run.endCalls += 1;
        run.calls.push("end");
      },
    };
    try {
      const result = await openSession(syntheticMeta, {
        loadCa: () => ca,
        createClient: (config) => {
          run.factoryCalls += 1;
          run.ssl = config.ssl ?? {};
          return client;
        },
        onEvent: (event) => run.events.push(event),
      });
      run.outcome = result.outcome;
      if (behaviour.closeAfter && result.close) await result.close();
    } catch (sessionError) {
      run.threw = sessionError instanceof Error ? sessionError.message : "unknown";
    }
    return run;
  };

  const refusedCa = { ok: false, reason: "CA_FILE_MISSING", detail: "synthetic" };
  const blankCa = { ok: true, pem: "   ", fingerprint: "f" };
  const goodCa = { ok: true, pem: PINNED_PEM, fingerprint: "f" };
  const refusedRun = await driveSession(refusedCa);
  const blankRun = await driveSession(blankCa);
  const okRun = await driveSession(goodCa, { closeAfter: true });
  const connectFailRun = await driveSession(goodCa, { failOn: "connect" });
  const queryFailRun = await driveSession(goodCa, { failOn: "query" });

  const untouched = (run: SessionRun): boolean =>
    run.factoryCalls === 0 && run.connectCalls === 0 && run.queryCalls === 0 && run.endCalls === 0;
  check(
    "K51a-a-refused-ca-never-reaches-the-client-factory",
    typeof openSession === "function" &&
      refusedRun.outcome === "refused" &&
      blankRun.outcome === "refused" &&
      untouched(refusedRun) &&
      untouched(blankRun),
    typeof openSession === "function"
      ? `refused=${refusedRun.calls.join(">")} blank=${blankRun.calls.join(">")}`
      : "the target verifier exposes no drivable session, so the order cannot be measured",
  );
  check(
    "K51b-a-verified-ca-builds-exactly-one-client-with-the-pinned-options",
    typeof openSession === "function" &&
      okRun.outcome === "open" &&
      okRun.factoryCalls === 1 &&
      okRun.ssl.ca === PINNED_PEM &&
      okRun.ssl.rejectUnauthorized === true,
    `factory=${okRun.factoryCalls} outcome=${okRun.outcome}`,
  );
  check(
    "K51c-the-observed-calls-are-connect-then-query-then-end",
    typeof openSession === "function" &&
      okRun.calls.join(">") === "connect>query>end" &&
      okRun.connectCalls === 1 &&
      okRun.queryCalls === 1 &&
      okRun.endCalls === 1,
    `observed calls: ${okRun.calls.join(">") || "(none)"}`,
  );
  check(
    "K51d-a-failed-session-closes-the-client-it-created",
    typeof openSession === "function" &&
      connectFailRun.connectCalls === 1 &&
      connectFailRun.queryCalls === 0 &&
      connectFailRun.endCalls === 1 &&
      connectFailRun.threw === "synthetic connect failure" &&
      queryFailRun.connectCalls === 1 &&
      queryFailRun.queryCalls === 1 &&
      queryFailRun.endCalls === 1 &&
      queryFailRun.threw === "synthetic query failure",
    `connect-fail=${connectFailRun.calls.join(">")}, query-fail=${queryFailRun.calls.join(">")}`,
  );
  // The close contract has two halves that pull in opposite directions, so both
  // are pinned: a close error after successful work is the only failure there is
  // and must surface; a close error during a failure must not replace it.
  const closeFailure = async (
    failOn: "connect" | "query" | undefined,
    endStyle: "sync" | "reject",
  ): Promise<string> => {
    if (!openSession) return "NO_MODULE";
    const client = {
      connect: async (): Promise<void> => {
        if (failOn === "connect") throw new Error("original connect failure");
      },
      query: async (): Promise<{ rows: Array<{ ok: number }> }> => {
        if (failOn === "query") throw new Error("original query failure");
        return { rows: [{ ok: 1 }] };
      },
      end: (): Promise<void> => {
        if (endStyle === "sync") throw new Error("close failure");
        return Promise.reject(new Error("close failure"));
      },
    };
    try {
      const result = await openSession(syntheticMeta, {
        loadCa: () => goodCa,
        createClient: () => client,
      });
      if (result.close) await result.close();
      return "no-error";
    } catch (raised) {
      return raised instanceof Error ? raised.message : "unknown";
    }
  };
  const closeRows: Array<[string, string, string]> = [
    ["clean-then-sync-close-throw", await closeFailure(undefined, "sync"), "close failure"],
    ["clean-then-rejected-close", await closeFailure(undefined, "reject"), "close failure"],
    [
      "connect-failure-wins-over-sync-close",
      await closeFailure("connect", "sync"),
      "original connect failure",
    ],
    [
      "connect-failure-wins-over-rejected-close",
      await closeFailure("connect", "reject"),
      "original connect failure",
    ],
    [
      "query-failure-wins-over-sync-close",
      await closeFailure("query", "sync"),
      "original query failure",
    ],
    [
      "query-failure-wins-over-rejected-close",
      await closeFailure("query", "reject"),
      "original query failure",
    ],
  ];
  for (const [label, raised, expected] of closeRows) {
    check(`K51e-${label}`, raised === expected, `raised "${raised}", expected "${expected}"`);
  }

  check(
    "K50-ca-design-does-not-reopen-the-migrate-path",
    prismaTlsStatus().verificationProven === false,
    "pinning a CA was taken as proof the Prisma migrate path is verified",
  );

  // The shipped template is the only operator-facing statement of this contract.
  // It is read from disk, not restated here: a copy would drift exactly the way
  // the template already had, silently describing rules that no longer exist.
  const templatePath = join(SCRIPTS_DIR, "..", ".env.acceptance.example");
  const template = existsSync(templatePath) ? readFileSync(templatePath, "utf8") : "";
  const filledTemplate = template
    .replace(/<ACCEPTANCE_PROJECT_REF>/g, ACCEPT)
    .replace(/<PASSWORD>/g, PW)
    .replace(/<REGION>/g, "eu-central-1");
  const templateValue = (key: string): string | undefined =>
    filledTemplate
      .split(/\r?\n/)
      .find((line) => line.startsWith(`${key}=`))
      ?.slice(key.length + 1)
      .trim();
  check(
    "K39-filled-in-template-passes-the-guard",
    template !== "" &&
      evaluateAcceptanceDbTarget({
        TALEPO_ENVIRONMENT: templateValue("TALEPO_ENVIRONMENT"),
        DATABASE_URL: templateValue("DATABASE_URL"),
        DIRECT_URL: templateValue("DIRECT_URL"),
      }).ok,
    "an operator who fills in .env.acceptance.example correctly still gets a refused environment",
  );

  // Positive control: the same pair without the steering query must be ACCEPTED,
  // or the four rejections above would prove only that everything fails.
  check(
    "K24-steering-control-clean-pair-still-accepted",
    evaluateAcceptanceDbTarget(env(`${good("6543")}&pgbouncer=true`, good("5432"))).ok,
    "the query policy rejects a legitimate acceptance pair, so K19-K23 prove nothing",
  );
  // The repair path measured end to end. A Supabase password containing "?" is
  // the input the operator pastes in; the guard refuses it (rightly — `pg`
  // misreads it), so the normaliser is the ONLY way back. If the normaliser
  // refused it too, the harness would be unopenable, and that is what a
  // "no @ outside authority" rule applied to its INPUT would have caused.
  const rawPasswordUrl = `postgresql://postgres.${ACCEPT}:pa?ss#1@${pooler}:6543/postgres?sslmode=verify-full`;
  let repaired = "";
  let repairFailed = "";
  try {
    const parts = parsePostgresUrlRobust(rawPasswordUrl);
    repaired = rebuildPostgresUrl(parts, encodePasswordForUri(parts.passwordRaw));
  } catch (repairError) {
    repairFailed = formatAcceptanceError(repairError);
  }
  check(
    "K25-normalizer-repairs-an-unencoded-password",
    repairFailed === "" &&
      evaluateAcceptanceDbTarget(env(repaired, good("5432"))).ok &&
      !evaluateAcceptanceDbTarget(env(rawPasswordUrl, good("5432"))).ok,
    repairFailed === ""
      ? "the repaired pair is still refused, so an operator with a '?' in the password is locked out"
      : `the normaliser threw on the input it exists to repair: ${repairFailed}`,
  );
  // The guard's authority now rests on a package this workspace does not declare:
  // `pg-connection-string` reaches it only as `pg`'s own hoisted dependency.
  // Declaring it is a dependency change and belongs to its own decision, so what
  // is enforced here instead is that the coupling holds — the guard and the
  // driver must resolve to the SAME file. A hoisting or major-version change then
  // fails loudly in this verifier rather than silently shifting URL semantics.
  let guardParserPath = "";
  let driverParserPath = "";
  try {
    guardParserPath = require.resolve("pg-connection-string");
    driverParserPath = require.resolve("pg-connection-string", {
      paths: [dirname(require.resolve("pg/package.json"))],
    });
  } catch {
    // Left empty on purpose: an unresolvable module must fail the gate below,
    // not throw out of the verifier with a path in the message.
  }
  check(
    "K26-guard-and-driver-share-one-url-parser",
    guardParserPath !== "" && guardParserPath === driverParserPath,
    "the guard's URL parser is not the same module the pg driver resolves",
  );
  // Round-trip: repairing the password must not quietly rewrite anything else.
  // The rebuilt URL is judged by the CANONICAL guard and by the driver's parser,
  // not by the normaliser's own reader — asking the repairer to confirm its own
  // work measures internal consistency and reports it as production behaviour.
  const roundTripPassword = "pa?ss&x=2 %z";
  const roundTripQuery = "?sslmode=verify-full&pgbouncer=true&connection_limit=1";
  const roundTripInput = `postgresql://postgres.${ACCEPT}:${roundTripPassword}@${pooler}:6543/postgres${roundTripQuery}`;
  const repairAndRead = (
    input: string,
    encode: (password: string) => string,
  ): { accepted: boolean; user: string; host: string; database: string; password: string } => {
    const parts = parsePostgresUrlRobust(input);
    const rebuilt = rebuildPostgresUrl(parts, encode(parts.passwordRaw));
    const driverView = parseAcceptancePostgresUrl(rebuilt);
    return {
      accepted: evaluateAcceptanceDbTarget(env(rebuilt, good("5432"))).ok,
      user: driverView?.user ?? "",
      host: driverView?.host ?? "",
      database: driverView?.database ?? "",
      password: driverView?.password ?? "",
    };
  };
  let roundTrip: ReturnType<typeof repairAndRead> | null = null;
  let roundTripFailed = "";
  try {
    roundTrip = repairAndRead(roundTripInput, encodePasswordForUri);
  } catch (roundTripError) {
    roundTripFailed = formatAcceptanceError(roundTripError);
  }
  check(
    "K27-password-repair-preserves-query-and-target",
    roundTripFailed === "" &&
      roundTrip !== null &&
      roundTrip.accepted &&
      roundTrip.password === roundTripPassword &&
      roundTrip.user === `postgres.${ACCEPT}` &&
      roundTrip.host === pooler &&
      roundTrip.database === "postgres",
    roundTripFailed === ""
      ? "repairing the password rewrote the query, the credential, or the target"
      : `the round-trip threw: ${roundTripFailed}`,
  );
  // Positive control: a lossy encoder must break K27. Without it the gate could
  // pass by comparing two halves that are broken in the same way.
  let lossySurvived = false;
  try {
    lossySurvived =
      repairAndRead(roundTripInput, (password) => encodeURIComponent(password).slice(0, -1))
        .password === roundTripPassword;
  } catch {
    // A throwing mutant is a caught mutant.
  }
  check(
    "K27b-round-trip-control-catches-a-lossy-encoder",
    !lossySurvived,
    "a deliberately lossy password encoder still satisfies K27, so K27 proves nothing",
  );
  // Passwords already containing a percent sequence are the class the old
  // decode-then-encode repair silently rewrote: "%41BC" was written back "ABC".
  // A lone surrogate is included because encodeURIComponent throws on it, and a
  // gate that crashes the verifier is not a gate that turned red.
  const PERCENT_PASSWORDS = ["%41BC", "100%", "a%b", "ab%25cd", "%", "�", "%%", ""];
  const notIdempotent: string[] = [];
  for (const password of PERCENT_PASSWORDS) {
    try {
      const once = encodePasswordForUri(password);
      if (encodePasswordForUri(once) !== once) notIdempotent.push("changed");
    } catch {
      notIdempotent.push("threw");
    }
  }
  check(
    "K27c-password-repair-is-idempotent",
    notIdempotent.length === 0,
    `repairing twice changes or throws on ${notIdempotent.length} password(s)`,
  );
  // The accepted ambiguity, pinned so a future change to it cannot be silent:
  // a value that IS exactly what encoding its decoded form produces is treated
  // as already-encoded, so "p%2Fw" reaches the server as "p/w". That reading is
  // deliberate — a raw string cannot say which of the two was meant.
  const alreadyEncoded = ["p%2Fw", "a%20b", "ab%25cd", "%E4%B8%AD"];
  check(
    "K27d-already-encoded-passwords-are-left-as-they-are",
    alreadyEncoded.every((password) => encodePasswordForUri(password) === password),
    "the already-encoded reading changed, which silently changes what password is sent",
  );
  check(
    "K18-tls-control-detects-a-renamed-silent-bypass",
    !(
      !/rejectUnauthorized:\s*false/.test("ssl: { rejectUnauthorized: allowInsecure },") &&
      /TLS VERIFICATION:/.test("ssl: { rejectUnauthorized: allowInsecure },")
    ),
    "a renamed bypass that announces nothing would pass K13",
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
      // The verdict carries the closed path with it. A bare PASS would let a
      // reader take the whole harness as usable when one documented route is not.
      ? "PASS — only the acceptance project ref is accepted; every other target fails" +
        " closed. MIGRATE PATH CLOSED: Prisma TLS verification NOT MEASURED"
      : "FAIL — acceptance target guard is not fail-closed",
  );
  process.exit(problems.length === 0 ? 0 : 1);
}

// Inert on import, and no unhandled rejection: a verifier that crashes must say
// so through the shared redacting formatter, never as a raw stack.
if (isAcceptanceCliEntrypoint(module)) {
  main().catch((error) => {
    console.error(`FAIL — ${formatAcceptanceError(error)}`);
    process.exit(1);
  });
}
