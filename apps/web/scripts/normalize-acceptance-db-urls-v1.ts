/**
 * Percent-encode ONLY the password component in .env.acceptance DB URLs.
 * Never prints secrets. Does not touch .env / .env.local.
 */
import { readFileSync, writeFileSync, existsSync } from "node:fs";
import { join } from "node:path";

import { ACCEPTANCE_PROJECT_REF } from "./lib/acceptance-db-target-v1";

const ACCEPTANCE_ENV_PATH = join(__dirname, "..", ".env.acceptance");
const URL_KEYS = new Set(["DATABASE_URL", "DIRECT_URL"]);

function safeDecodeURIComponent(value: string): string {
  try {
    return decodeURIComponent(value);
  } catch {
    return value;
  }
}

function parsePostgresUrlRobust(raw: string): {
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
  const database =
    slashIdx >= 0 ? safeDecodeURIComponent(authority.slice(slashIdx + 1)) : "postgres";
  const lastColon = hostPort.lastIndexOf(":");
  const host = lastColon >= 0 ? hostPort.slice(0, lastColon) : hostPort;
  const port = lastColon >= 0 ? hostPort.slice(lastColon + 1) : "5432";
  return { scheme, user, passwordRaw, host, port, database, query };
}

function encodePasswordForUri(passwordRaw: string): string {
  const decoded = safeDecodeURIComponent(passwordRaw);
  return encodeURIComponent(decoded);
}

function rebuildPostgresUrl(parts: ReturnType<typeof parsePostgresUrlRobust>, encodedPassword: string): string {
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

function main() {
  if (!existsSync(ACCEPTANCE_ENV_PATH)) {
    console.error("FAIL — .env.acceptance missing");
    process.exit(1);
  }

  const raw = readFileSync(ACCEPTANCE_ENV_PATH, "utf8");
  const lines = raw.split(/\r?\n/);
  const eol = raw.includes("\r\n") ? "\r\n" : "\n";
  let changed = 0;
  const ports: Record<string, string> = {};

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
      console.error(`FAIL — ${key} project ref mismatch (expected ${ACCEPTANCE_PROJECT_REF})`);
      process.exit(1);
    }

    if (normalized !== value) changed++;

    const rendered = quoted ? `${quote}${normalized}${quote}` : normalized;
    const prefix = line.slice(0, line.indexOf(key));
    return `${prefix}${key}=${rendered}`;
  });

  if (ports.DATABASE_URL !== "6543") {
    console.error("FAIL — DATABASE_URL port must remain 6543");
    process.exit(1);
  }
  if (ports.DIRECT_URL !== "5432") {
    console.error("FAIL — DIRECT_URL port must remain 5432");
    process.exit(1);
  }

  writeFileSync(ACCEPTANCE_ENV_PATH, outLines.join(eol) + (raw.endsWith("\n") || raw.endsWith("\r\n") ? eol : ""), "utf8");

  console.log("ENV PASSWORD ENCODED: yes");
  console.log(`URLS UPDATED: ${changed > 0 ? changed : "already encoded"}`);
  console.log(`DATABASE_URL PORT: ${ports.DATABASE_URL}`);
  console.log(`DIRECT_URL PORT: ${ports.DIRECT_URL}`);
  console.log(`TARGET PROJECT REF: ${ACCEPTANCE_PROJECT_REF}`);
  console.log("SECRETS PRINTED: no");
}

main();
