/**
 * Canonical acceptance DB target authority.
 *
 * Single source for "which database may an acceptance script touch". Both the
 * env loader (`load-acceptance-env.ts`) and the read-only target verifier
 * (`verify-acceptance-db-target-v1.ts`) derive their decision from here; they
 * do NOT keep a second copy of the ref list or of the URL parser.
 *
 * Pure module: no filesystem, no network, no process.env mutation. It can be
 * exercised with synthetic connection strings and never opens a connection.
 */

/** The one acceptance project that may be written to. */
export const ACCEPTANCE_PROJECT_REF = "yyirpdhcydavrttiongo";

/** Known primary/shared Supabase project ref — must NEVER be an acceptance target. */
export const BLOCKED_PRIMARY_PROJECT_REFS = new Set(["jgfwofiygnsylaclykkb"]);

export const PLACEHOLDER_MARKERS = [
  "<STAGING_TRANSACTION_POOLER_URI>",
  "<STAGING_SESSION_POOLER_URI>",
  "STAGING_TRANSACTION_POOLER_URI",
  "STAGING_SESSION_POOLER_URI",
  // Placeholders shipped in .env.acceptance.example — an unfilled copy fails closed.
  "<ACCEPTANCE_PROJECT_REF>",
  "<PASSWORD>",
  "<REGION>",
];

export type TargetRejectReason =
  | "ENVIRONMENT_NOT_ACCEPTANCE"
  | "URL_MISSING"
  | "URL_PLACEHOLDER"
  | "URL_UNPARSABLE"
  | "HOST_NOT_RECOGNISED"
  | "PROJECT_REF_BLOCKED_PRIMARY"
  | "PROJECT_REF_NOT_DERIVABLE"
  | "PROJECT_REF_NOT_ALLOWED"
  | "PROJECT_REF_MISMATCH_BETWEEN_URLS";

export type TargetDecision =
  | { ok: true; projectRef: string; databaseHost: string; directHost: string }
  | { ok: false; reason: TargetRejectReason; detail: string };

export type ParsedPostgresUrl = {
  user: string;
  password: string;
  host: string;
  port: string;
  database: string;
  projectRef: string | null;
};

function safeDecodeURIComponent(value: string): string {
  try {
    return decodeURIComponent(value);
  } catch {
    return value;
  }
}

/**
 * Parse postgres URLs when passwords contain unencoded ? & % (common in Supabase).
 * Returns null instead of throwing so callers can fail closed with a reason.
 */
export function parseAcceptancePostgresUrl(raw: string): ParsedPostgresUrl | null {
  const trimmed = raw.trim();
  const schemeMatch = trimmed.match(/^postgres(?:ql)?:\/\//i);
  if (!schemeMatch) return null;
  const afterScheme = trimmed.slice(schemeMatch[0].length);
  const atIdx = afterScheme.lastIndexOf("@");
  if (atIdx < 0) return null;
  const userinfo = afterScheme.slice(0, atIdx);
  const hostpart = afterScheme.slice(atIdx + 1);
  const colonInUser = userinfo.indexOf(":");
  if (colonInUser < 0) return null;
  const user = safeDecodeURIComponent(userinfo.slice(0, colonInUser));
  const password = safeDecodeURIComponent(userinfo.slice(colonInUser + 1));
  const qIdx = hostpart.indexOf("?");
  const authority = qIdx >= 0 ? hostpart.slice(0, qIdx) : hostpart;
  const slashIdx = authority.indexOf("/");
  const hostPort = slashIdx >= 0 ? authority.slice(0, slashIdx) : authority;
  const database =
    slashIdx >= 0 ? safeDecodeURIComponent(authority.slice(slashIdx + 1)) : "postgres";
  const lastColon = hostPort.lastIndexOf(":");
  const host = (lastColon >= 0 ? hostPort.slice(0, lastColon) : hostPort).toLowerCase();
  const port = lastColon >= 0 ? hostPort.slice(lastColon + 1) : "5432";
  if (!host) return null;

  let projectRef: string | null = null;
  const direct = host.match(/^db\.([a-z0-9]+)\.supabase\.co$/i);
  if (direct?.[1]) projectRef = direct[1].toLowerCase();
  const userRef = user.match(/^postgres\.([a-z0-9]+)$/i);
  if (!projectRef && userRef?.[1]) projectRef = userRef[1].toLowerCase();

  return { user, password, host, port, database, projectRef };
}

const SUPABASE_POOLER_HOST = /^aws-\d+-[a-z0-9-]+\.pooler\.supabase\.com$/;
const SUPABASE_DIRECT_HOST = /^db\.[a-z0-9]+\.supabase\.co$/;

/** Only Supabase pooler/direct hosts may be an acceptance target. */
export function isRecognisedSupabaseHost(host: string): boolean {
  const h = host.trim().toLowerCase();
  return SUPABASE_POOLER_HOST.test(h) || SUPABASE_DIRECT_HOST.test(h);
}

export function looksLikePlaceholder(value: string): boolean {
  const v = value.trim();
  if (!v) return true;
  for (const marker of PLACEHOLDER_MARKERS) {
    if (v.includes(marker)) return true;
  }
  if (v.startsWith("<") && v.endsWith(">")) return true;
  return false;
}

/**
 * Decide whether the supplied acceptance environment points at the one allowed
 * acceptance project. Never throws; never echoes a connection string.
 */
export function evaluateAcceptanceDbTarget(
  env: Record<string, string | undefined>,
): TargetDecision {
  if ((env.TALEPO_ENVIRONMENT ?? "").trim() !== "acceptance") {
    return {
      ok: false,
      reason: "ENVIRONMENT_NOT_ACCEPTANCE",
      detail: `TALEPO_ENVIRONMENT must be "acceptance" (got ${env.TALEPO_ENVIRONMENT ?? "missing"})`,
    };
  }

  const databaseUrl = (env.DATABASE_URL ?? "").trim();
  const directUrl = (env.DIRECT_URL ?? "").trim();
  if (!databaseUrl || !directUrl) {
    return {
      ok: false,
      reason: "URL_MISSING",
      detail: "DATABASE_URL and DIRECT_URL are both required in .env.acceptance",
    };
  }
  if (looksLikePlaceholder(databaseUrl) || looksLikePlaceholder(directUrl)) {
    return {
      ok: false,
      reason: "URL_PLACEHOLDER",
      detail: "Placeholders not resolved in .env.acceptance",
    };
  }

  const dbMeta = parseAcceptancePostgresUrl(databaseUrl);
  const directMeta = parseAcceptancePostgresUrl(directUrl);
  if (!dbMeta || !directMeta) {
    return {
      ok: false,
      reason: "URL_UNPARSABLE",
      detail: "DATABASE_URL or DIRECT_URL is not a parsable postgres URL",
    };
  }

  // Each URL is judged on its own; a single foreign side is enough to fail closed.
  for (const [label, meta] of [
    ["DATABASE_URL", dbMeta],
    ["DIRECT_URL", directMeta],
  ] as const) {
    if (!isRecognisedSupabaseHost(meta.host)) {
      return {
        ok: false,
        reason: "HOST_NOT_RECOGNISED",
        detail: `${label} host is not a Supabase pooler or direct host`,
      };
    }
    if (!meta.projectRef) {
      return {
        ok: false,
        reason: "PROJECT_REF_NOT_DERIVABLE",
        detail: `${label} does not carry a derivable Supabase project ref`,
      };
    }
    if (BLOCKED_PRIMARY_PROJECT_REFS.has(meta.projectRef)) {
      return {
        ok: false,
        reason: "PROJECT_REF_BLOCKED_PRIMARY",
        detail: `${label} points at the known primary/shared project`,
      };
    }
    if (meta.projectRef !== ACCEPTANCE_PROJECT_REF) {
      return {
        ok: false,
        reason: "PROJECT_REF_NOT_ALLOWED",
        detail: `${label} project ref is not the single allowed acceptance project`,
      };
    }
  }

  if (dbMeta.projectRef !== directMeta.projectRef) {
    return {
      ok: false,
      reason: "PROJECT_REF_MISMATCH_BETWEEN_URLS",
      detail: "DATABASE_URL and DIRECT_URL resolve to different projects",
    };
  }

  return {
    ok: true,
    projectRef: ACCEPTANCE_PROJECT_REF,
    databaseHost: dbMeta.host,
    directHost: directMeta.host,
  };
}
