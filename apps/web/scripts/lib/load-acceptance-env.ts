/**
 * Acceptance environment loader — a LIBRARY, not a side effect.
 *
 * Importing this file does nothing: it reads no file, throws nothing, prints
 * nothing and never calls process.exit(). That matters because it used to load
 * and throw at module scope, which meant a refused target killed the process
 * *before* the CLI's `main().catch(...)` was installed — Node then printed the
 * raw error, the full stack and the absolute path to the env file, bypassing
 * every redaction rule the harness has.
 *
 * Callers invoke `loadAcceptanceEnv()` inside their own catch boundary. The
 * library classifies the failure and throws; deciding what the operator sees
 * and what the exit code is belongs to the CLI, not here.
 */
import { evaluateAcceptanceDbTarget, type TargetRejectReason } from "./acceptance-db-target-v1";
import { acceptanceEnvFileExists, readAcceptanceEnvFile } from "./acceptance-env-file-v1";

export type AcceptanceEnvFailureReason = TargetRejectReason | "ENV_FILE_MISSING";

/** A classified, message-only failure: no path, no host, no raw driver text. */
export class AcceptanceEnvError extends Error {
  readonly reason: AcceptanceEnvFailureReason;

  constructor(reason: AcceptanceEnvFailureReason, detail: string) {
    super(`${reason}: ${detail}`);
    this.name = "AcceptanceEnvError";
    this.reason = reason;
  }
}

/**
 * Apply the acceptance env file (never the ambient dotenv files) and refuse any
 * database except the single allowed acceptance project. Ambient DB URLs are
 * cleared first and cleared again on refusal, so a rejected run cannot leave a
 * usable connection behind.
 */
export function loadAcceptanceEnv(): void {
  if (!acceptanceEnvFileExists()) {
    throw new AcceptanceEnvError(
      "ENV_FILE_MISSING",
      "the acceptance env file is not present next to package.json",
    );
  }

  const values = readAcceptanceEnvFile();

  delete process.env.DATABASE_URL;
  delete process.env.DIRECT_URL;
  delete process.env.TALEPO_ENVIRONMENT;

  for (const [key, value] of Object.entries(values)) {
    process.env[key] = value;
  }

  const decision = evaluateAcceptanceDbTarget(process.env);
  if (!decision.ok) {
    delete process.env.DATABASE_URL;
    delete process.env.DIRECT_URL;
    throw new AcceptanceEnvError(decision.reason, decision.detail);
  }
}
