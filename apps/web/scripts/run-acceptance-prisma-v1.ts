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
import { spawn } from "node:child_process";
import { existsSync } from "node:fs";
import { join } from "node:path";

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
  childEnv.DATABASE_URL = verified.DATABASE_URL;
  childEnv.DIRECT_URL = verified.DIRECT_URL;
  // prisma.config.ts calls `import "dotenv/config"`; pin it to the acceptance file.
  childEnv.DOTENV_CONFIG_PATH = acceptanceEnvPath;
  return childEnv;
}

/** Strip connection strings, hosts, users, passwords and query strings from CLI output. */
export function redactPrismaOutput(text: string): string {
  return text
    .replace(/postgres(?:ql)?:\/\/\S+/gi, "[redacted-uri]")
    .replace(/[a-z0-9-]+\.(?:pooler\.)?supabase\.(?:com|co)(?::\d+)?/gi, "[redacted-host]")
    .replace(/password\s*[=:]\s*\S+/gi, "password=[redacted]")
    .replace(/\?[A-Za-z0-9_]+=\S*/g, "?[redacted-query]");
}

async function main(): Promise<void> {
  const parsed = parseAcceptancePrismaAction(process.argv.slice(2));

  if (!existsSync(PRISMA_CONFIG_PATH) || !existsSync(PRISMA_SCHEMA_PATH)) {
    throw new Error("prisma.config.ts or prisma/schema.prisma is missing");
  }

  // Canonical target guard first: refuses any database except the acceptance project.
  await import("./lib/load-acceptance-env");

  const verified = {
    DATABASE_URL: process.env.DATABASE_URL ?? "",
    DIRECT_URL: process.env.DIRECT_URL ?? "",
  };
  if (!verified.DATABASE_URL || !verified.DIRECT_URL) {
    throw new Error("verified acceptance URLs are missing after the target guard");
  }

  console.log(`ACCEPTANCE PRISMA: migrate ${parsed.action}`);
  console.log(`SCHEMA: ${PRISMA_SCHEMA_PATH.replace(WEB_ROOT, "apps/web")}`);
  console.log(`MIGRATIONS: ${PRISMA_MIGRATIONS_PATH.replace(WEB_ROOT, "apps/web")}`);
  console.log("SECRETS PRINTED: no\n");

  const child = spawn("npx", buildPrismaArgs(parsed.action), {
    cwd: WEB_ROOT,
    shell: true,
    env: buildAcceptancePrismaEnv(process.env, verified),
    stdio: ["ignore", "pipe", "pipe"],
  });

  child.stdout.on("data", (chunk: Buffer) => process.stdout.write(redactPrismaOutput(String(chunk))));
  child.stderr.on("data", (chunk: Buffer) => process.stderr.write(redactPrismaOutput(String(chunk))));
  child.on("exit", (code) => process.exit(code ?? 0));
}

if (require.main === module) {
  main().catch((error) => {
    const message = error instanceof Error ? error.message : String(error);
    console.error(`FAIL — ${redactPrismaOutput(message)}`);
    process.exit(1);
  });
}
