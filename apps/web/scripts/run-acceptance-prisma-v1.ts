/**
 * The only sanctioned way to point the Prisma CLI at the acceptance database.
 *
 * `npx prisma migrate status` on its own resolves its datasource through
 * `prisma.config.ts`, which imports `dotenv/config` and therefore reads the
 * ambient `.env` — i.e. the primary project. This wrapper closes that path: the
 * canonical target guard runs first, the child process receives ONLY the
 * verified acceptance values, and dotenv is pinned to `.env.acceptance` so even
 * the config file's own loader cannot reach another environment.
 *
 * Two actions exist. `status` is read-only. `deploy` additionally demands an
 * explicit `--apply`, so no schema is ever written by accident. Everything else
 * — `dev`, `reset`, `resolve`, `db push`, `db pull`, `generate` — fails closed.
 *
 * Run from apps/web:
 *   npx --yes tsx scripts/run-acceptance-prisma-v1.ts status
 *   npx --yes tsx scripts/run-acceptance-prisma-v1.ts deploy --apply
 */
import { spawn, type StdioOptions } from "node:child_process";
import { existsSync } from "node:fs";
import { join } from "node:path";

import {
  createStreamRedactor,
  formatAcceptanceError,
  redactPrismaOutput,
} from "./lib/acceptance-redaction-v1";
import { loadAcceptanceEnv } from "./lib/load-acceptance-env";
import { evaluateAcceptanceDbTarget } from "./lib/acceptance-db-target-v1";
import { isAcceptanceCliEntrypoint } from "./lib/acceptance-cli-entry-v1";
import {
  PRISMA_TLS_UNAVAILABLE_REASON,
  prismaTlsStatus,
} from "./lib/acceptance-prisma-tls-v1";

const WEB_ROOT = join(__dirname, "..");

/** Talepo's existing Prisma authority; the wrapper binds to it instead of restating paths. */
export const PRISMA_CONFIG_PATH = join(WEB_ROOT, "prisma.config.ts");
export const PRISMA_SCHEMA_PATH = join(WEB_ROOT, "prisma", "schema.prisma");
export const PRISMA_MIGRATIONS_PATH = join(WEB_ROOT, "prisma", "migrations");
export const ACCEPTANCE_ENV_PATH = join(WEB_ROOT, ".env.acceptance");

export const ALLOWED_PRISMA_ACTIONS = ["status", "deploy"] as const;
export type AcceptancePrismaAction = (typeof ALLOWED_PRISMA_ACTIONS)[number];

/** OS variables a child process needs to start at all. Nothing else is forwarded. */
const FORWARDED_OS_KEYS = [
  "PATH",
  "Path",
  "PATHEXT",
  "ComSpec",
  "SystemRoot",
  "SystemDrive",
  "windir",
  "TEMP",
  "TMP",
  "HOME",
  "USERPROFILE",
  "APPDATA",
  "LOCALAPPDATA",
  "LANG",
  "TZ",
];

export type ParsedPrismaAction = { action: AcceptancePrismaAction; apply: boolean };

/**
 * Accept exactly one action, with `--apply` only for deploy. Unknown verbs,
 * extra flags and empty input are refused rather than passed through.
 */
export function parseAcceptancePrismaAction(argv: string[]): ParsedPrismaAction {
  const args = argv.filter((value) => value.trim().length > 0);
  if (args.length === 0) {
    throw new Error("no action given — expected: status | deploy --apply");
  }
  const [action, ...rest] = args;
  if (!ALLOWED_PRISMA_ACTIONS.includes(action as AcceptancePrismaAction)) {
    throw new Error(`action "${action}" is not permitted on the acceptance database`);
  }
  if (action === "status") {
    if (rest.length > 0) throw new Error("status takes no further arguments");
    return { action: "status", apply: false };
  }
  if (rest.length !== 1 || rest[0] !== "--apply") {
    throw new Error("deploy requires an explicit --apply and nothing else");
  }
  return { action: "deploy", apply: true };
}

export function buildPrismaArgs(action: AcceptancePrismaAction): string[] {
  return ["--yes", "prisma", "migrate", action];
}

/**
 * Build the child environment from the VERIFIED acceptance values. Ambient DB
 * URLs and unrelated secrets are dropped, never merged.
 */
export function buildAcceptancePrismaEnv(
  parentEnv: Record<string, string | undefined>,
  verified: { DATABASE_URL: string; DIRECT_URL: string },
  acceptanceEnvPath: string = ACCEPTANCE_ENV_PATH,
): Record<string, string | undefined> {
  const childEnv: Record<string, string | undefined> = {};
  for (const key of FORWARDED_OS_KEYS) {
    if (parentEnv[key] !== undefined) childEnv[key] = parentEnv[key];
  }
  childEnv.TALEPO_ENVIRONMENT = "acceptance";
  // The child receives the URL the guard approved, byte for byte. There is no
  // TLS translation: a spelling this harness cannot demonstrate is not one it
  // will emit, so the migrate path is closed instead.
  childEnv.DATABASE_URL = verified.DATABASE_URL;
  childEnv.DIRECT_URL = verified.DIRECT_URL;
  // prisma.config.ts calls `import "dotenv/config"`; pin it to the acceptance file.
  childEnv.DOTENV_CONFIG_PATH = acceptanceEnvPath;
  return childEnv;
}

/** Re-exported from the single redaction authority; no second copy lives here. */
export { redactPrismaOutput };

/**
 * Dependencies of the execution decision, injectable so the boundary can be
 * DRIVEN in a test instead of inferred from where a string sits in this file.
 * The previous gate compared the index of a name with the index of "spawn(" —
 * and the name's first occurrence was its own import line, so a refusal moved
 * below the spawn would still have passed.
 */
export type AcceptancePrismaDeps = {
  loadEnv: () => void;
  tlsStatus: () => { verificationProven: boolean; detail: string };
  readEnv: () => { DATABASE_URL: string; DIRECT_URL: string };
  spawn: typeof spawn;
};

export type AcceptancePrismaOutcome =
  | { outcome: "refused"; reason: string; detail: string }
  | { outcome: "spawned"; child: ReturnType<typeof spawn> };

/**
 * The whole execution decision, in one place and with no output of its own.
 *
 * Order is the contract: parse, then the target guard, then the TLS gate, and
 * only after all three a process. Returning a refusal instead of exiting is what
 * lets a caller observe the decision; `main()` below turns it into output.
 */
export function executeAcceptancePrisma(
  argv: string[],
  deps: AcceptancePrismaDeps,
): AcceptancePrismaOutcome {
  const parsed = parseAcceptancePrismaAction(argv);

  // Canonical target guard first: refuses any database except the acceptance project.
  deps.loadEnv();

  const verified = deps.readEnv();
  if (!verified.DATABASE_URL || !verified.DIRECT_URL) {
    throw new Error("verified acceptance URLs are missing after the target guard");
  }

  // The URLs are judged here as well, by the canonical guard, and not merely
  // assumed to have been judged by whoever supplied them. `loadEnv` and
  // `readEnv` are injectable so this decision can be driven in a test — and that
  // same seam would otherwise make the boundary depend on the caller's honesty
  // rather than on the guard. The pair that reaches a child process is the pair
  // this function checked.
  const targetDecision = evaluateAcceptanceDbTarget({
    TALEPO_ENVIRONMENT: "acceptance",
    DATABASE_URL: verified.DATABASE_URL,
    DIRECT_URL: verified.DIRECT_URL,
  });
  if (!targetDecision.ok) {
    return {
      outcome: "refused",
      reason: "ACCEPTANCE_TARGET_REFUSED",
      detail: targetDecision.reason,
    };
  }

  // The migrate path runs only when a verified connection can be DEMONSTRATED.
  // It cannot be, from here: what the schema engine does with the canonical
  // sslmode is not measurable without a handshake. Closing is the fail-closed
  // answer, and there is deliberately no weaker mode to fall back to — running
  // migrate over an unverified connection is worse than not running it.
  const tls = deps.tlsStatus();
  if (!tls.verificationProven) {
    return { outcome: "refused", reason: PRISMA_TLS_UNAVAILABLE_REASON, detail: tls.detail };
  }

  return {
    outcome: "spawned",
    child: deps.spawn("npx", buildPrismaArgs(parsed.action), {
      // Typed explicitly so the tuple survives; a widened string[] silently stops
      // matching the overload and takes every child stream type down with it.
      cwd: WEB_ROOT,
      shell: true,
      // Narrow, named cast. This app augments NodeJS.ProcessEnv with a REQUIRED
      // NODE_ENV, and the child env is deliberately an allowlist that does not
      // carry it — inventing one here would change how the child behaves. Only
      // this property is waived; cwd, shell and stdio stay type-checked.
      env: buildAcceptancePrismaEnv(process.env, verified) as NodeJS.ProcessEnv,
      // `as const` keeps this a tuple. Widened to string[] it stops matching the
      // overload, and every downstream child.stdout/stderr type collapses with it.
      stdio: ["ignore", "pipe", "pipe"] satisfies StdioOptions,
    }),
  };
}

async function main(): Promise<void> {
  if (!existsSync(PRISMA_CONFIG_PATH) || !existsSync(PRISMA_SCHEMA_PATH)) {
    throw new Error("prisma.config.ts or prisma/schema.prisma is missing");
  }

  const decision = executeAcceptancePrisma(process.argv.slice(2), {
    loadEnv: loadAcceptanceEnv,
    tlsStatus: prismaTlsStatus,
    readEnv: () => ({
      DATABASE_URL: process.env.DATABASE_URL ?? "",
      DIRECT_URL: process.env.DIRECT_URL ?? "",
    }),
    spawn,
  });

  if (decision.outcome === "refused") {
    console.error(`FAIL — ${decision.reason}`);
    console.error(`REASON: ${decision.detail}`);
    console.error("MIGRATE PATHS CLOSED: status, deploy");
    console.error("NO FALLBACK: verification is not downgraded to run this command");
    process.exitCode = 1;
    return;
  }

  console.log("ACCEPTANCE PRISMA: migrate");
  console.log(`SCHEMA: ${PRISMA_SCHEMA_PATH.replace(WEB_ROOT, "apps/web")}`);
  console.log(`MIGRATIONS: ${PRISMA_MIGRATIONS_PATH.replace(WEB_ROOT, "apps/web")}`);
  console.log("SECRETS PRINTED: no\n");

  const child = decision.child;
  // The pipes are typed nullable because a caller may ask for other stdio; this
  // path always asks for pipes, so their absence is a contract break, not a case.
  if (!child.stdout || !child.stderr) {
    throw new Error("the migrate child was started without the piped streams");
  }

  // Line-buffered redaction: a pipe boundary can fall inside a host, so nothing
  // is released until its line is complete.
  const outRedactor = createStreamRedactor();
  const errRedactor = createStreamRedactor();
  // setEncoding, not String(chunk): a UTF-8 character split across a pipe
  // boundary would otherwise decode to U+FFFD (Turkish output is full of them).
  child.stdout.setEncoding("utf8");
  child.stderr.setEncoding("utf8");
  child.stdout.on("data", (chunk: string) => process.stdout.write(outRedactor.push(chunk)));
  child.stderr.on("data", (chunk: string) => process.stderr.write(errRedactor.push(chunk)));

  let spawnFailed = false;
  child.on("error", (error) => {
    // spawn ENOENT arrives asynchronously, long after main().catch() resolved.
    console.error(`FAIL — ${formatAcceptanceError(error, "spawn")}`);
    spawnFailed = true;
    process.exitCode = 1;
  });
  // "close" — not "exit" — so both pipes have ended before the held-back tail is
  // flushed; on "exit" the final partial line could still be in flight.
  child.on("close", (code, signal) => {
    process.stdout.write(outRedactor.flush());
    process.stderr.write(errRedactor.flush());
    // A signal-killed child reports code=null; treating that as 0 would report
    // a Ctrl-C or OOM kill as success. A spawn error already set the code.
    if (spawnFailed) return;
    process.exitCode = code ?? (signal ? 1 : 0);
  });
}

if (isAcceptanceCliEntrypoint(module)) {
  main().catch((error) => {
    console.error(`FAIL — ${formatAcceptanceError(error)}`);
    process.exit(1);
  });
}
