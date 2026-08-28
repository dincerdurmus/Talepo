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
  await import("./lib/load-acceptance-env");

  if (process.env.TALEPO_ENVIRONMENT !== "acceptance") {
    console.error("FAIL — TALEPO_ENVIRONMENT must be acceptance");
    process.exit(1);
  }

  applyAcceptanceDevDefaults(process.env);
  await assertPortAvailable(ACCEPTANCE_DEV_PORT);

  console.log(`ACCEPTANCE DEV: starting Next.js on ${ACCEPTANCE_DEV_URL}`);
  console.log("DB: acceptance project via .env.acceptance only");
  console.log("SECRETS PRINTED: no");

  const child = spawn("npx", buildNextDevArgs(), {
    stdio: "inherit",
    shell: true,
    env: process.env,
  });

  child.on("exit", (code) => process.exit(code ?? 0));
}

if (require.main === module) {
  main().catch((error) => {
    const message = error instanceof Error ? error.message : String(error);
    console.error(`FAIL — ${message.replace(/postgres(?:ql)?:\/\/[^\s]+/gi, "[redacted-uri]")}`);
    process.exit(1);
  });
}
