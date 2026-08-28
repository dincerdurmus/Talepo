/**
 * Single reader for apps/web/.env.acceptance.
 *
 * Parsing the acceptance env file lived in two places (the loader and the
 * read-only target verifier); this module is the one authority so the two can
 * never drift. It only reads and parses — it applies nothing to process.env and
 * makes no target decision. Values are returned to the caller and never logged.
 */
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";

export const ACCEPTANCE_ENV_PATH = join(__dirname, "..", "..", ".env.acceptance");

export function acceptanceEnvFileExists(): boolean {
  return existsSync(ACCEPTANCE_ENV_PATH);
}

/** Parse KEY=VALUE lines; comments and blank lines are ignored. */
export function readAcceptanceEnvFile(): Record<string, string> {
  if (!acceptanceEnvFileExists()) {
    throw new Error(`.env.acceptance missing at ${ACCEPTANCE_ENV_PATH}`);
  }

  const raw = readFileSync(ACCEPTANCE_ENV_PATH, "utf8");
  const out: Record<string, string> = {};
  for (const line of raw.split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const eq = trimmed.indexOf("=");
    if (eq <= 0) continue;
    const key = trimmed.slice(0, eq).trim();
    let value = trimmed.slice(eq + 1).trim();
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }
    out[key] = value;
  }
  return out;
}
