import { evaluateAcceptanceDbTarget } from "./acceptance-db-target-v1";
import { ACCEPTANCE_ENV_PATH, readAcceptanceEnvFile } from "./acceptance-env-file-v1";

/**
 * Load ONLY the acceptance env file (no fallback to the ambient dotenv files)
 * and refuse to hand the process an environment that points anywhere except the
 * single allowed acceptance project. Every acceptance script imports this file,
 * so seed and cleanup are guarded here too, not only the read-only verifier.
 */
export function loadAcceptanceEnvOnly(): void {
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
    throw new Error(
      `acceptance DB target refused (${decision.reason}): ${decision.detail} [${ACCEPTANCE_ENV_PATH}]`,
    );
  }
}

loadAcceptanceEnvOnly();
