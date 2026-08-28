/**
 * Percent-encode ONLY the password component in .env.acceptance DB URLs.
 * Never prints secrets. Does not touch .env / .env.local.
 */
import { readFileSync, writeFileSync, existsSync } from "node:fs";
import { join } from "node:path";

import { ACCEPTANCE_PROJECT_REF, evaluateAcceptanceDbTarget } from "./lib/acceptance-db-target-v1";
import { formatAcceptanceError } from "./lib/acceptance-redaction-v1";
import { isAcceptanceCliEntrypoint } from "./lib/acceptance-cli-entry-v1";
import { readAcceptanceEnvFile } from "./lib/acceptance-env-file-v1";

const ACCEPTANCE_ENV_PATH = join(__dirname, "..", ".env.acceptance");
const URL_KEYS = new Set(["DATABASE_URL", "DIRECT_URL"]);

function safeDecodeURIComponent(value: string): string {
  try {
    return decodeURIComponent(value);
  } catch {
    return value;
  }
}

/** Exported so the allowlist verifier can measure the repair path directly. */
export function parsePostgresUrlRobust(raw: string): {
  scheme: string;
  user: string;
  passwordRaw: string;
  host: string;
  port: string;
  database: string;
  query: string;
} {
  const trimmed = raw.trim();
  const schemeMatch = trimmed.match(/^(postgres(?:ql)?):\/\//i);
  if (!schemeMatch) throw new Error("Not a postgres URL");
  const scheme = schemeMatch[1]!.toLowerCase();
  const afterScheme = trimmed.slice(schemeMatch[0].length);
  // This is the ONE place that must still read an un-encoded password, because
  // encoding it is this script's entire job: a Supabase password containing "?"
  // or "#" is exactly the input the operator pastes in and needs repaired. The
  // canonical guard refuses such a URL — rightly, since `pg` misreads it — so if
  // this function refused it too there would be no way back. It is not an
  // authority on the target: the pair it produces is judged by the guard below,
  // and nothing is written unless the guard accepts.
  const atIdx = afterScheme.lastIndexOf("@");
  if (atIdx < 0) throw new Error("Missing @ in postgres URL");
  const userinfo = afterScheme.slice(0, atIdx);
  const hostpart = afterScheme.slice(atIdx + 1);
  const colonInUser = userinfo.indexOf(":");
  if (colonInUser < 0) throw new Error("Missing password separator in postgres URL");
  const user = safeDecodeURIComponent(userinfo.slice(0, colonInUser));
  const passwordRaw = userinfo.slice(colonInUser + 1);
  const qIdx = hostpart.indexOf("?");
  const authority = qIdx >= 0 ? hostpart.slice(0, qIdx) : hostpart;
  const query = qIdx >= 0 ? hostpart.slice(qIdx) : "";
  const slashIdx = authority.indexOf("/");
  const hostPort = slashIdx >= 0 ? authority.slice(0, slashIdx) : authority;
  // Inventing "postgres" here would WRITE a database name the operator never
  // chose, quietly moving the target away from the driver's own fallback.
  if (slashIdx < 0) throw new Error("Postgres URL names no database");
  const database = safeDecodeURIComponent(authority.slice(slashIdx + 1));
  const lastColon = hostPort.lastIndexOf(":");
  const host = lastColon >= 0 ? hostPort.slice(0, lastColon) : hostPort;
  const port = lastColon >= 0 ? hostPort.slice(lastColon + 1) : "5432";
  return { scheme, user, passwordRaw, host, port, database, query };
}

/**
 * Encode the password component, and be idempotent about it.
 *
 * Decoding first and re-encoding was wrong: a password that genuinely contains
 * "%41BC" decodes to "ABC" and was written back as "ABC" — a silently changed
 * credential whose only symptom is an authentication failure that no output is
 * allowed to explain. A value is now left alone ONLY when it already is exactly
 * what encoding its decoded form would produce; anything else is encoded
 * verbatim. Running this twice therefore changes nothing the second time.
 *
 * The remaining ambiguity is real and deliberate: "p%2Fw" is read as an
 * already-encoded "p/w", because the raw string cannot say which was meant.
 */
export function encodePasswordForUri(passwordRaw: string): string {
  const decoded = safeDecodeURIComponent(passwordRaw);
  if (encodeURIComponent(decoded) === passwordRaw) return passwordRaw;
  return encodeURIComponent(passwordRaw);
}

export function rebuildPostgresUrl(parts: ReturnType<typeof parsePostgresUrlRobust>, encodedPassword: string): string {
  const userPart = parts.user.includes("@") || parts.user.includes(":")
    ? encodeURIComponent(parts.user)
    : parts.user;
  const dbPart = parts.database.includes("/") || parts.database.includes("?")
    ? encodeURIComponent(parts.database)
    : parts.database;
  return `${parts.scheme}://${userPart}:${encodedPassword}@${parts.host}:${parts.port}/${dbPart}${parts.query}`;
}

function projectRefFromUser(user: string): string | null {
  const m = user.match(/^postgres\.([a-z0-9]+)$/i);
  return m?.[1] ?? null;
}

/**
 * Every refusal ends here, so the operator learns the file's state on EVERY
 * failing path — not only the one that happened to print it. Nothing is written
 * before the canonical guard accepts, so "unchanged" is always the truth here.
 */
function refuse(message: string): never {
  console.error(`FAIL — ${message}`);
  console.error("FILE UNCHANGED: yes");
  process.exit(1);
}

function main() {
  if (!existsSync(ACCEPTANCE_ENV_PATH)) refuse(".env.acceptance missing");

  const raw = readFileSync(ACCEPTANCE_ENV_PATH, "utf8");
  const lines = raw.split(/\r?\n/);
  const eol = raw.includes("\r\n") ? "\r\n" : "\n";
  let changed = 0;
  const ports: Record<string, string> = {};
  const normalizedUrls: Record<string, string> = {};
  // The guard is asked about this file's OWN environment, not an assumed one, and
  // the value is read through the canonical env-file reader rather than a third
  // hand-written KEY=VALUE parser living in this script.
  const environment = readAcceptanceEnvFile().TALEPO_ENVIRONMENT;

  const outLines = lines.map((line) => {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) return line;
    const eq = trimmed.indexOf("=");
    if (eq <= 0) return line;
    const key = trimmed.slice(0, eq).trim();
    if (!URL_KEYS.has(key)) return line;

    let value = trimmed.slice(eq + 1).trim();
    const quoted =
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"));
    const quote = value.startsWith("'") ? "'" : '"';
    if (quoted) value = value.slice(1, -1);

    const parts = parsePostgresUrlRobust(value);
    const encodedPassword = encodePasswordForUri(parts.passwordRaw);
    const normalized = rebuildPostgresUrl(parts, encodedPassword);
    ports[key] = parts.port;

    const ref = projectRefFromUser(parts.user);
    if (ref !== ACCEPTANCE_PROJECT_REF) {
      refuse(`${key} does not name the allowed acceptance project`);
    }

    if (normalized !== value) changed++;
    normalizedUrls[key] = normalized;

    const rendered = quoted ? `${quote}${normalized}${quote}` : normalized;
    const prefix = line.slice(0, line.indexOf(key));
    return `${prefix}${key}=${rendered}`;
  });

  if (ports.DATABASE_URL !== "6543") refuse("DATABASE_URL port must remain 6543");
  if (ports.DIRECT_URL !== "5432") refuse("DIRECT_URL port must remain 5432");

  // The classification below is not this script's own opinion. The canonical
  // guard judges the pair that is about to be written, and nothing is written
  // if it refuses — a rejected run leaves .env.acceptance exactly as it was.
  const decision = evaluateAcceptanceDbTarget({
    TALEPO_ENVIRONMENT: environment,
    DATABASE_URL: normalizedUrls.DATABASE_URL,
    DIRECT_URL: normalizedUrls.DIRECT_URL,
  });
  if (!decision.ok) refuse(`canonical guard rejected the normalized pair (${decision.reason})`);

  // `split(/\r?\n/)` already turns a trailing newline into a final empty element,
  // so joining restores it. Appending another grew the file by one line per run.
  writeFileSync(ACCEPTANCE_ENV_PATH, outLines.join(eol), "utf8");

  console.log("ENV PASSWORD ENCODED: yes");
  console.log(`URLS UPDATED: ${changed > 0 ? changed : "already encoded"}`);
  console.log("PORTS: expected transaction/session pooler pair");
  console.log("TARGET_CLASSIFICATION=ACCEPTANCE_ALLOWLISTED");
  console.log("SAME_PROJECT=yes");
  console.log("SECRETS PRINTED: no");
}

// main() is synchronous, so the boundary is a try/catch: a URL-parsing throw
// used to reach Node unhandled and print the raw error with a full stack.
// Inert on import: only the started process runs. Importing this file to reach
// one exported helper must never launch the scenario it drives.
if (isAcceptanceCliEntrypoint(module)) {
  try {
    main();
  } catch (error) {
    refuse(formatAcceptanceError(error));
  }
}
