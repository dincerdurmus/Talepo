/**
 * Start Next.js dev against the acceptance database only.
 *
 * The acceptance server has one port: 3187. It is passed to Next explicitly, it
 * is checked for availability first, and a busy port is a visible failure — the
 * harness never slides onto another port, and it never touches port 3000, which
 * belongs to the developer's ordinary dev server.
 *
 * The canonical target guard (`./lib/load-acceptance-env`) is loaded inside
 * main(), before the server is spawned, so importing this module for
 * verification neither reads .env.acceptance nor starts anything.
 *
 * Run from apps/web:
 *   npx --yes tsx scripts/run-acceptance-dev-v1.ts
 */
import { spawn } from "node:child_process";
import { createServer } from "node:net";
import {
  createStreamRedactor,
  formatAcceptanceError,
} from "./lib/acceptance-redaction-v1";
import { loadAcceptanceEnv } from "./lib/load-acceptance-env";

/** The one port the acceptance harness may listen on. */
export const ACCEPTANCE_DEV_PORT = 3187;
export const ACCEPTANCE_DEV_URL = `http://localhost:${ACCEPTANCE_DEV_PORT}`;

/** Next is always told the port explicitly; no implicit default is relied on. */
export function buildNextDevArgs(port: number = ACCEPTANCE_DEV_PORT): string[] {
  return ["next", "dev", "-p", String(port)];
}

/**
 * Apply the local-only auth defaults. A NEXTAUTH_URL that names a different
 * port is refused rather than silently overridden, so the session cookie and
 * the listening port can never disagree.
 */
export function applyAcceptanceDevDefaults(
  env: Record<string, string | undefined>,
): Record<string, string | undefined> {
  const existing = env.NEXTAUTH_URL?.trim();
  if (existing && existing !== ACCEPTANCE_DEV_URL) {
    throw new Error(
      `NEXTAUTH_URL must be ${ACCEPTANCE_DEV_URL} for the acceptance harness (got ${existing})`,
    );
  }
  env.NEXTAUTH_URL = ACCEPTANCE_DEV_URL;
  env.NEXTAUTH_SECRET = env.NEXTAUTH_SECRET ?? "acceptance-local-smoke-dev-only-v1";
  env.NODE_ENV = "development";
  return env;
}

/** Reject when the acceptance port is taken; never fall back to another port. */
export async function assertPortAvailable(port: number): Promise<void> {
  await new Promise<void>((resolve, reject) => {
    const probe = createServer();
    probe.once("error", (error) => {
      reject(
        new Error(
          `port ${port} is not available (${(error as NodeJS.ErrnoException).code ?? "unknown"}) — ` +
            "stop whatever holds it; the acceptance harness does not move to another port",
        ),
      );
    });
    probe.listen(port, "127.0.0.1", () => {
      probe.close(() => resolve());
    });
  });
}

async function main(): Promise<void> {
  // Canonical target guard first: refuses any database except the acceptance project.
  loadAcceptanceEnv();

  if (process.env.TALEPO_ENVIRONMENT !== "acceptance") {
    console.error("FAIL — TALEPO_ENVIRONMENT must be acceptance");
    process.exit(1);
  }

  applyAcceptanceDevDefaults(process.env);
  await assertPortAvailable(ACCEPTANCE_DEV_PORT);

  console.log(`ACCEPTANCE DEV: starting Next.js on ${ACCEPTANCE_DEV_URL}`);
  console.log("DB: acceptance project via .env.acceptance only");
  console.log("SECRETS PRINTED: no");

  // Piped, not inherited: this child runs the product with DATABASE_URL in hand,
  // so a Prisma P1001 here names the acceptance host. Inheriting the terminal
  // would print it verbatim — the one spawner that most needs redaction had none.
  const child = spawn("npx", buildNextDevArgs(), {
    stdio: ["inherit", "pipe", "pipe"],
    shell: true,
    env: process.env,
  });

  const outRedactor = createStreamRedactor();
  const errRedactor = createStreamRedactor();
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
  child.on("close", (code, signal) => {
    process.stdout.write(outRedactor.flush());
    process.stderr.write(errRedactor.flush());
    if (spawnFailed) return;
    // A signal-killed dev server must not report success.
    process.exitCode = code ?? (signal ? 1 : 0);
  });
}

if (require.main === module) {
  main().catch((error) => {
    console.error(`FAIL — ${formatAcceptanceError(error)}`);
    process.exit(1);
  });
}
