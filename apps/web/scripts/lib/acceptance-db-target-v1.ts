/**
 * Canonical acceptance DB target authority.
 *
 * Single source for "which database may an acceptance script touch". Both the
 * env loader (`load-acceptance-env.ts`) and the read-only target verifier
 * (`verify-acceptance-db-target-v1.ts`) derive their decision from here; they
 * do NOT keep a second copy of the ref list or of the URL parser.
 *
 * No network, no process.env mutation; it can be exercised with synthetic
 * connection strings and never opens a connection. It does not touch the
 * filesystem either, but that is not free: `pg-connection-string` reads
 * `sslrootcert`/`sslcert`/`sslkey` from disk while parsing, so those keys are
 * refused by the query policy BEFORE the URL is handed to the parser.
 */

import { parse as parseConnectionString } from "pg-connection-string";

/** The one acceptance project that may be written to. */
export const ACCEPTANCE_PROJECT_REF = "yyirpdhcydavrttiongo";

/** Known primary/shared Supabase project ref — must NEVER be an acceptance target. */
export const BLOCKED_PRIMARY_PROJECT_REFS = new Set(["jgfwofiygnsylaclykkb"]);

/**
 * Refs that are no longer a target but must still never reach a log. They live
 * here, with the live refs, so redaction derives every ref it hides from ONE
 * source instead of keeping a second list of its own.
 */
export const HISTORICAL_PROJECT_REFS = new Set(["cpeoiqppesacjlyrszrl"]);

/** Every ref this repository knows about, live or retired. */
export const ALL_KNOWN_PROJECT_REFS: readonly string[] = [
  ACCEPTANCE_PROJECT_REF,
  ...BLOCKED_PRIMARY_PROJECT_REFS,
  ...HISTORICAL_PROJECT_REFS,
];

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
  | "URL_HAS_SURROUNDING_WHITESPACE"
  | "URL_AT_OUTSIDE_AUTHORITY"
  | "URL_QUERY_OVERRIDES_CONNECTION"
  | "URL_FRAGMENT_NOT_ALLOWED"
  | "URL_TLS_DOWNGRADED"
  | "URL_QUERY_KEY_REPEATED"
  | "URL_TLS_NOT_REQUESTED"
  | "RAW_STRING_NAMES_FORBIDDEN_REF"
  | "HOST_NOT_RECOGNISED"
  | "DATABASE_NOT_EXPLICIT"
  | "PROJECT_REF_HOST_USER_MISMATCH"
  | "USERNAME_REF_NOT_ALLOWED"
  | "PROJECT_REF_BLOCKED_PRIMARY"
  | "PROJECT_REF_NOT_DERIVABLE"
  | "PROJECT_REF_NOT_ALLOWED"
  | "PROJECT_REF_MISMATCH_BETWEEN_URLS"
  | "DATABASE_MISMATCH_BETWEEN_URLS";

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

/**
 * Parse a postgres URL through the DRIVER'S OWN parser.
 *
 * This module used to split the URL itself with `lastIndexOf("@")`. `pg` uses
 * WHATWG URL semantics, where the authority ends at the first `/` — so a single
 * `@` in the path or query made the two disagree: the guard saw the acceptance
 * pooler and approved, while `pg` connected somewhere else entirely and shipped
 * the acceptance password there. There is exactly one correct parser here, and
 * it is the one the connection actually uses.
 */
export function parseAcceptancePostgresUrl(raw: string): ParsedPostgresUrl | null {
  const trimmed = raw.trim();
  if (!/^postgres(?:ql)?:\/\//i.test(trimmed)) return null;
  // The query is judged separately by the policy above and may not steer the
  // connection, so it is cut off before parsing. That keeps the parser's answer
  // a function of the authority alone, and keeps it quiet: parsing an `sslmode`
  // makes it write a deprecation notice straight to stderr, bypassing the
  // redactor every other line in this harness goes through.
  const authorityOnly = trimmed.split("?")[0]!;
  let parsed: ReturnType<typeof parseConnectionString>;
  try {
    parsed = parseConnectionString(authorityOnly);
  } catch {
    return null;
  }
  const host = (parsed.host ?? "").toLowerCase();
  if (!host) return null;
  const user = parsed.user ?? "";
  const password = parsed.password ?? "";
  const port = parsed.port ?? "5432";
  // NOT defaulted to "postgres": when a URL carries no path, `pg` falls back to
  // the USERNAME as the database name. Inventing "postgres" here made two such
  // URLs look equal while the driver would open two different databases.
  const database = parsed.database ?? "";

  return {
    user,
    password,
    host,
    port,
    database,
    projectRef: projectRefFromHost(host) ?? projectRefFromUser(user),
  };
}

/** `db.<ref>.supabase.co` → ref. Pooler hosts do not name the project. */
function projectRefFromHost(host: string): string | null {
  const direct = host.match(/^db\.([a-z0-9]+)\.supabase\.co$/i);
  return direct?.[1]?.toLowerCase() ?? null;
}

/** `postgres.<ref>` → ref. This is how the pooler routes to a project. */
function projectRefFromUser(user: string): string | null {
  const match = user.match(/^postgres\.([a-z0-9]+)$/i);
  return match?.[1]?.toLowerCase() ?? null;
}

/**
 * An `@` outside the authority is what let the two parsers disagree. There is no
 * legitimate reason for one in an acceptance connection string, so it is refused
 * outright rather than interpreted.
 */
function hasAtOutsideAuthority(raw: string): boolean {
  const match = raw.trim().match(/^postgres(?:ql)?:\/\/([^/?#]*)/i);
  if (!match) return true;
  return raw.trim().slice(match[0].length).includes("@");
}

/**
 * The only query keys an acceptance connection string may carry.
 *
 * This is an ALLOWLIST on purpose. A list of known-bad keys was the first
 * attempt and it kept losing: `pg-connection-string` copies every query
 * parameter over the authority, so `?host=` outranks the host in the URL,
 * `?connectionString=` replaces the whole target when a client is built from
 * a string, and `?uselibpqcompat=true` turns `sslmode=require` into an
 * unverified connection. Each of those is one key that was not on a denylist
 * yet — and `pg` keeps adding keys. Naming what is allowed instead means a
 * key nobody has thought of is refused by default, in this version and the next.
 */
const ALLOWED_QUERY_KEYS = new Set([
  "sslmode",
  "pgbouncer",
  "connection_limit",
  "pool_timeout",
  "connect_timeout",
  "application_name",
]);

/**
 * The one `sslmode` this harness accepts, spelled exactly like this.
 *
 * `require` is deliberately NOT here. In libpq — and therefore in Prisma's Rust
 * connector — `require` means "encrypt", not "check who you are talking to": no
 * certificate chain check, no hostname check. `pg-connection-string` currently
 * treats it as an alias for `verify-full`, and warns that it will adopt the
 * libpq meaning in its next major. So `require` is a value on which the two
 * consumers of this URL disagree today and will diverge further tomorrow, and a
 * guard whose whole purpose is proving WHICH server answered cannot be built on
 * it. `verify-ca` is excluded for the same reason one step down: it checks the
 * chain but not the hostname, so the right CA signing the wrong host passes.
 *
 * The contract this expresses is not "TLS is on". It is "the server is verified".
 */
const REQUIRED_SSL_MODE = "verify-full";

/**
 * Refuse a URL that steers itself through its query, or that does not ask for a
 * verified TLS connection. Runs BEFORE parsing, so a key that would make the
 * parser read a certificate off disk never reaches it.
 *
 * The query is read as RAW TEXT, never decoded. A decoded reading would accept
 * `%73slmode=%76erify-full` as the canonical spelling — the same characters, a
 * different string — and any consumer that decodes differently would then read a
 * different mode from the one this guard called canonical. Being stricter than
 * the driver is safe; being more generous is not.
 */
function evaluateQueryPolicy(
  raw: string,
): { ok: true } | { ok: false; reason: TargetRejectReason; detail: string } {
  // A fragment is refused rather than interpreted. `#` has no meaning in a
  // connection string, and a "?" living inside one is invisible to the driver
  // while looking exactly like a query to anything scanning the raw text.
  if (raw.includes("#")) {
    return {
      ok: false,
      reason: "URL_FRAGMENT_NOT_ALLOWED",
      detail: 'connection string carries a "#" fragment',
    };
  }
  const qIdx = raw.indexOf("?");
  // Read the RAW pairs, not decoded ones. `URLSearchParams` would accept
  // `%73slmode=%76erify-full` as the canonical spelling because it decodes to
  // the same characters — but it is a different string, and a consumer that
  // decodes differently would read a different mode from the one this guard
  // called canonical. The query is a short, fixed vocabulary; it is spelled
  // literally or it is refused.
  const rawPairs = qIdx < 0 ? [] : raw.slice(qIdx + 1).split("&").filter((pair) => pair !== "");
  // Repetition is decided in its own pass, before any value is read. Judged
  // inline, a first bad value would be reported and the repetition itself
  // would go unnoticed — the same rejection, from a rule that says nothing
  // about the second copy.
  const seenKeys = new Set<string>();
  for (const pair of rawPairs) {
    const eq = pair.indexOf("=");
    const key = eq < 0 ? pair : pair.slice(0, eq);
    if (seenKeys.has(key)) {
      return {
        ok: false,
        reason: "URL_QUERY_KEY_REPEATED",
        detail: `query parameter "${key}" appears more than once`,
      };
    }
    seenKeys.add(key);
  }
  let sawRequiredSslMode = false;
  for (const pair of rawPairs) {
    const eq = pair.indexOf("=");
    const key = eq < 0 ? pair : pair.slice(0, eq);
    // A key is written in plain lower-case letters or not at all. This is what
    // makes the comparison below a comparison of spellings rather than of
    // meanings, and it costs nothing: every allowed key already looks like this.
    if (!/^[a-z_]+$/.test(key)) {
      return {
        ok: false,
        reason: "URL_QUERY_OVERRIDES_CONNECTION",
        detail: `query parameter "${key.toLowerCase()}" is not written as a plain lower-case key`,
      };
    }
    if (!ALLOWED_QUERY_KEYS.has(key)) {
      return {
        ok: false,
        reason: "URL_QUERY_OVERRIDES_CONNECTION",
        detail: `query parameter "${key}" is not on the allowed list`,
      };
    }
    if (key === "sslmode") {
      if (pair !== `sslmode=${REQUIRED_SSL_MODE}`) {
        return {
          ok: false,
          reason: "URL_TLS_DOWNGRADED",
          detail: `sslmode must be written exactly as "${REQUIRED_SSL_MODE}"`,
        };
      }
      sawRequiredSslMode = true;
    }
  }
  if (!sawRequiredSslMode) {
    return {
      ok: false,
      reason: "URL_TLS_NOT_REQUESTED",
      detail: `no sslmode=${REQUIRED_SSL_MODE}; the server would not be verified`,
    };
  }
  return { ok: true };
}

function safeDecode(value: string): string {
  try {
    return decodeURIComponent(value.replace(/\+/g, " "));
  } catch {
    return value;
  }
}

/**
 * Scan the RAW string for a ref that must never be a target, wherever it sits —
 * host, user, database, query or fragment. Parsing decides which ref is used;
 * this decides which refs may appear at all.
 */
function rawStringNamesForbiddenRef(raw: string): string | null {
  // Both spellings are scanned: percent-encoding a ref must not hide it, and the
  // historical refs have no second line of defence in the parsed-field checks.
  const haystacks = [raw.toLowerCase(), safeDecode(raw).toLowerCase()];
  for (const ref of BLOCKED_PRIMARY_PROJECT_REFS) {
    if (haystacks.some((h) => h.includes(ref.toLowerCase()))) return "primary";
  }
  for (const ref of HISTORICAL_PROJECT_REFS) {
    if (haystacks.some((h) => h.includes(ref.toLowerCase()))) return "historical";
  }
  return null;
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

  // NOT trimmed here. The untrimmed value is what the driver and the Prisma
  // child receive, so it is the string that has to be judged; padding is
  // refused below rather than quietly normalised away.
  const databaseUrl = env.DATABASE_URL ?? "";
  const directUrl = env.DIRECT_URL ?? "";
  if (!databaseUrl.trim() || !directUrl.trim()) {
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

  // Refused before parsing: an `@` past the authority is the exact shape that made
  // this guard and the driver read two different hosts out of one string.
  for (const [label, raw] of [
    ["DATABASE_URL", databaseUrl],
    ["DIRECT_URL", directUrl],
  ] as const) {
    // The guard trims before judging, but the UNTRIMMED string is what reaches
    // the driver and the Prisma child. Judging one string and shipping another
    // is the divergence this module exists to prevent, so padding is refused.
    if (raw !== raw.trim()) {
      return {
        ok: false,
        reason: "URL_HAS_SURROUNDING_WHITESPACE",
        detail: `${label} is padded with whitespace the driver would keep`,
      };
    }
    if (hasAtOutsideAuthority(raw)) {
      return {
        ok: false,
        reason: "URL_AT_OUTSIDE_AUTHORITY",
        detail: `${label} carries an "@" outside the authority`,
      };
    }
    const forbidden = rawStringNamesForbiddenRef(raw);
    if (forbidden) {
      return {
        ok: false,
        reason: "RAW_STRING_NAMES_FORBIDDEN_REF",
        detail: `${label} names a ${forbidden} project ref somewhere in the raw string`,
      };
    }
    const queryPolicy = evaluateQueryPolicy(raw);
    if (!queryPolicy.ok) {
      return {
        ok: false,
        reason: queryPolicy.reason,
        detail: `${label}: ${queryPolicy.detail}`,
      };
    }
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
    // Host and username are checked separately: the pooler host names no project,
    // so `postgres.<ref>` is the field that actually routes the connection.
    const userRef = projectRefFromUser(meta.user);
    if (userRef && userRef !== ACCEPTANCE_PROJECT_REF) {
      return {
        ok: false,
        reason: "USERNAME_REF_NOT_ALLOWED",
        detail: `${label} username routes to a project that is not the acceptance project`,
      };
    }
    if (!meta.database) {
      return {
        ok: false,
        reason: "DATABASE_NOT_EXPLICIT",
        detail: `${label} names no database, so the driver would fall back to the username`,
      };
    }
    const hostRef = projectRefFromHost(meta.host);
    if (hostRef && userRef && hostRef !== userRef) {
      return {
        ok: false,
        reason: "PROJECT_REF_HOST_USER_MISMATCH",
        detail: `${label} host and username name different projects`,
      };
    }
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

  // Same project is not the same database: the pooler and the session URL must
  // land in one place, or migrations and reads describe two different schemas.
  if (dbMeta.database !== directMeta.database) {
    return {
      ok: false,
      reason: "DATABASE_MISMATCH_BETWEEN_URLS",
      detail: "DATABASE_URL and DIRECT_URL name different databases",
    };
  }

  return {
    ok: true,
    projectRef: ACCEPTANCE_PROJECT_REF,
    databaseHost: dbMeta.host,
    directHost: directMeta.host,
  };
}
