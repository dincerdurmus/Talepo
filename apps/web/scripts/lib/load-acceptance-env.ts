import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";

const ACCEPTANCE_ENV_PATH = join(__dirname, "..", "..", ".env.acceptance");

/** Load ONLY apps/web/.env.acceptance — never falls back to .env / .env.local. */
export function loadAcceptanceEnvOnly(): void {
  if (!existsSync(ACCEPTANCE_ENV_PATH)) {
    throw new Error(`.env.acceptance missing at ${ACCEPTANCE_ENV_PATH}`);
  }

  delete process.env.DATABASE_URL;
  delete process.env.DIRECT_URL;
  delete process.env.TALEPO_ENVIRONMENT;

  const raw = readFileSync(ACCEPTANCE_ENV_PATH, "utf8");
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
    process.env[key] = value;
  }
}

loadAcceptanceEnvOnly();
