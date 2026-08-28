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
  check(
    "G9-guard-runs-before-prisma-spawn",
    prismaWrapperSrc.length > 0 &&
      /\bloadAcceptanceEnv\(\)/.test(prismaWrapperSrc) &&
      prismaWrapperSrc.indexOf("loadAcceptanceEnv()") < prismaWrapperSrc.indexOf("spawn("),
    "the canonical target guard does not run before Prisma is spawned",
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

    for (const call of source.matchAll(printCalls())) {
      // Strip the sanctioned wrappers first; whatever error value still reaches
      // the print unwrapped is a leak, in any spelling: `error`, `${e}`,
      // `error.message`, `err.stack`, `String(e)`, `(error as Error).message`.
      const remaining = call[1]!.replace(SANCTIONED_SINK, " ");
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
