/**
 * The single redaction authority for every acceptance CLI.
 *
 * It lives under `scripts/lib` rather than inside a runner because several
 * entry points need it — including `precheck-personal-resource-ownership-v1`,
 * which has no business importing a script that spawns child processes.
 *
 * Two design rules, both learned from findings rather than guessed:
 *
 * 1. The failures that actually reach stderr rarely contain a URI. Prisma
 *    reports ``Can't reach database server at `db.<ref>.supabase.co`:`5432` ``
 *    and pg reports `getaddrinfo ENOTFOUND <pooler host>` — the target is named
 *    with no scheme at all. So the rules match hosts, roles, addresses and refs
 *    directly, not just connection strings.
 * 2. Redaction must not destroy the diagnosis. An earlier version matched
 *    `pass:`, `user:` and any two-slash path, which erased `pass: 12, fail: 3`
 *    and `GET /api/requests/abc/publish` — in a harness whose failures ARE
 *    route and counter failures. Every rule below is anchored to a credential
 *    or infrastructure context, never to a bare product word.
 */
import { ALL_KNOWN_PROJECT_REFS } from "./acceptance-db-target-v1";

const MAX_MESSAGE_LENGTH = 300;
const MAX_FORMATTED_LENGTH = 400;

function escapeForRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/** Connection URIs. Stops at JSON/quote punctuation so the rest of a line survives. */
const URI_RULE = /postgres(?:ql)?:\/\/[^\s"'`,}\])>]+/gi;

/** Supabase hosts with or without scheme, port or backticks. */
const HOST_RULE = /[a-z0-9-]+\.(?:pooler\.)?supabase\.(?:com|co)(?::\d+)?/gi;

/**
 * Credentials. The key must CONTAIN one of the secret words below — that covers
 * `PGPASSWORD`, `SUPABASE_DB_PASSWORD`, `DB_PASSWORD_2` and `db_pwd`, while
 * leaving a bare `pass: 12` counter alone.
 */
/**
 * A value is: a quoted run that may be UNTERMINATED (`PGPASSWORD="hunter2` with
 * no closing quote still leaks otherwise), or a bare run. Never crosses a line —
 * `[^"\n]` — because a stray opening quote used to swallow the following output.
 */
const VALUE = String.raw`(?:"[^"\n]*"?|'[^'\n]*'?|[^\s,;}"'\n]+)`;
/**
 * Secret-bearing key names. No greedy PREFIX in the assignment rule: that made
 * it quadratic in line length (a 64 KB line took seconds), because the engine
 * restarted a full scan at every index. The keyword is matched first and the
 * key's own suffix after it, so `PGPASSWORD=` still matches on `PASSWORD=` and
 * the operator still sees which variable was wrong.
 */
const SECRET_KEYWORD =
  String.raw`(?:password|passwd|pwd|secret|token|api[-_]?key|service_role|authorization|bearer)`;
// A quoted JSON key MAY carry a prefix (`"PGPASSWORD"`): the surrounding quote
// anchors the scan, so the prefix costs nothing here.
const CREDENTIAL_JSON_RULE = new RegExp(
  String.raw`(["'])([\w]*${SECRET_KEYWORD}[\w]*)\1(\s*:\s*)` + VALUE,
  "gi",
);
/** `Authorization: Bearer <token>` — the value follows a space, not a separator. */
const BEARER_RULE = /\bbearer\s+\S+/gi;
const CREDENTIAL_ASSIGN_RULE = new RegExp(
  String.raw`(${SECRET_KEYWORD}[\w]*)(\s*[=:]\s*)` + VALUE,
  "gi",
);

/** Database roles, in the shapes Postgres, Prisma and libpq actually print. */
const ROLE_QUOTED_RULE = /\b(?:for user|role|credentials for|user)\s+(["'`])[^"'`\n]+\1/gi;
const ROLE_BARE_RULE = /\brole\s+[A-Za-z_][\w$]*\s+does not exist/gi;
// `pguser=` too: libpq accepts the PG-prefixed conninfo spelling.
const ROLE_CONNINFO_RULE = new RegExp(
  String.raw`\b(?:pg)?(?:user|username)\s*=\s*` + VALUE,
  "gi",
);
// `role` is deliberately ABSENT: in this harness `"role":"PRO"` is the persona
// contract under test, not a Postgres login. Only `user`/`username` are masked,
// and the key itself is preserved so the line still says what was reported.
const ROLE_JSON_RULE = /(["'])(user|username)\1(\s*:\s*)(["'])[^"'\n]*\4/gi;
const PG_ENV_RULE = new RegExp(
  String.raw`\b(PG(?:USER|PASSWORD|HOST|DATABASE|PORT))(\s*[=:]\s*)` + VALUE,
  "gi",
);

/**
 * Resolved addresses. Anchored to a connection verb so a version number
 * (`5.22.0.1`) or a duration (`00:01:23`) is not mistaken for an address.
 */
// `at` and `server` are deliberately ABSENT: they turn "prisma at 5.22.0.1" and
// "failed at 00:01:23" into redacted noise. libpq's own quoted shape gets its
// own rule below instead.
const ADDRESS_CONTEXT =
  /\b(?:ECONNREFUSED|ECONNRESET|ETIMEDOUT|EHOSTUNREACH|ENETUNREACH|ENOTFOUND|EAI_AGAIN|EPIPE|connect|connecting|bind|listening on)\s+/i;
/** libpq: `connection to server at "10.1.2.3", port 5432 failed: ...` */
const LIBPQ_SERVER_RULE = /\bat\s+(["'])[^"'`\n]+\1\s*,\s*port\s*\d+/gi;
const IPV4 = /\d{1,3}(?:\.\d{1,3}){3}(?::\d+)?/;
const IPV6_BRACKETED = /\[[0-9a-f:.]+\](?::\d+)?/i;
// `::ffff:1.2.3.4` first: the bare-IPv6 alternative would otherwise stop at the
// `::ffff:` prefix and publish the embedded IPv4 octets.
const IPV6_MAPPED = /(?:[0-9a-f]{0,4}:){1,}(?::)?\d{1,3}(?:\.\d{1,3}){3}(?::\d+)?/i;
const IPV6_BARE = /(?:[0-9a-f]{0,4}:){2,}[0-9a-f]{0,4}(?:%[\w.]+)?(?::\d+)?/i;
const ADDRESS_RULE = new RegExp(
  `(${ADDRESS_CONTEXT.source})(${IPV6_BRACKETED.source}|${IPV6_MAPPED.source}|${IPV4.source}|${IPV6_BARE.source})`,
  "gi",
);

/**
 * Filesystem paths. Absolute system roots and any `.env*` file — but NOT an
 * HTTP route, which is the thing a failing acceptance run most needs to show.
 */
// Drive-letter paths AND UNC hosts, which name the machine. The drive letter
// must be preceded by a non-word char and followed by a BACKSLASH — `[A-Za-z]:/`
// would also match the `p:/` inside `http://`, erasing every URL in the output.
const WINDOWS_PATH_RULE = /(?:(?<![\w])[A-Za-z]:\\|\\\\[A-Za-z0-9._-]+)[^\s"'`)]*/g;
// `app`, `data` and `srv` are deliberately ABSENT: `/app/requests/42` and
// `/data/import` are Talepo routes, and a harness whose failures are route
// failures must still show them.
const POSIX_SYSTEM_PATH_RULE =
  /\/(?:home|Users|var|tmp|opt|etc|root|mnt|usr|Volumes)\/[^\s"'`)]*/g;
// A dotfile env name only: `.env`, `.env.acceptance`, `web/.env`. The lookbehind
// keeps `process.env.DATABASE_URL` intact — there `.env` follows a word char.
const ENV_FILE_RULE = /(?<![\w])\.env(?:\.[\w-]+)?(?![\w.])/g;

const QUERY_RULE = /\?[A-Za-z0-9_]+=[^\s"'`,}]*/g;

/**
 * Remove connection strings, hosts, credentials, roles, addresses, paths,
 * query strings and project refs from any text bound for stdout/stderr.
 */
export function redactAcceptanceOutput(text: string): string {
  // Line by line, keeping the separators. Two reasons, both measured:
  //  - a quoted value rule such as `password="..."` would otherwise cross a
  //    newline and swallow the following lines of output;
  //  - bounding each scan to one line keeps a large stream affordable.
  return text
    .split(/(\r\n|\n)/)
    .map((part) => (part === "\n" || part === "\r\n" ? part : redactLine(part)))
    .join("");
}

function redactLine(text: string): string {
  // Cheap pre-checks: on a line with no candidate at all these skip the
  // expensive scans entirely, which is what makes a 64 KB line affordable.
  let safe = text;
  if (/postgres/i.test(safe)) safe = safe.replace(URI_RULE, "[redacted-uri]");
  if (/supabase/i.test(safe)) safe = safe.replace(HOST_RULE, "[redacted-host]");
  // Cheap keyword guards: they skip the scan entirely on a line that cannot
  // match, which is most of a build log. Behaviour is unchanged.
  if (
    /password|passwd|pwd|secret|token|api[-_]?key|service_role|authorization|bearer/i.test(safe)
  ) {
    // The KEY is kept and only the VALUE masked: "PGPASSWORD=[redacted]" tells
    // the operator which variable was wrong; "password=[redacted]" does not.
    safe = safe
      .replace(
        CREDENTIAL_JSON_RULE,
        (_m, q: string, key: string, sep: string) => `${q}${key}${q}${sep}"[redacted]"`,
      )
      .replace(BEARER_RULE, "Bearer [redacted]")
      .replace(CREDENTIAL_ASSIGN_RULE, (_m, key: string, sep: string) => `${key}${sep}[redacted]`);
  }
  if (/\bpg[a-z]/i.test(safe)) {
    safe = safe.replace(PG_ENV_RULE, (_m, key: string, sep: string) => `${key}${sep}[redacted]`);
  }
  if (/user|username|role|credentials/i.test(safe)) {
    safe = safe
      .replace(ROLE_CONNINFO_RULE, "user=[redacted-user]")
      .replace(ROLE_BARE_RULE, "role [redacted-user] does not exist")
      .replace(
        ROLE_JSON_RULE,
        (_m, q1: string, key: string, sep: string) => `${q1}${key}${q1}${sep}"[redacted-user]"`,
      )
      .replace(ROLE_QUOTED_RULE, (match) => {
        const keyword = match.slice(0, match.search(/\s+["'`]/));
        return `${keyword} "[redacted-user]"`;
      });
  }
  safe = safe
    .replace(LIBPQ_SERVER_RULE, 'at "[redacted-host]", port [redacted]')
    .replace(ADDRESS_RULE, "$1[redacted-address]")
    .replace(WINDOWS_PATH_RULE, "[redacted-path]")
    .replace(POSIX_SYSTEM_PATH_RULE, "[redacted-path]");
  if (/\.env/.test(safe)) safe = safe.replace(ENV_FILE_RULE, "[redacted-path]");
  safe = safe.replace(QUERY_RULE, "?[redacted-query]");
  // A ref survives on its own — "project <ref> refused the connection" — and
  // drivers echo whatever case the caller used.
  for (const ref of ALL_KNOWN_PROJECT_REFS) {
    safe = safe.replace(new RegExp(escapeForRegExp(ref), "gi"), "[redacted-ref]");
  }
  return safe;
}

/** Backwards-compatible name used by the Prisma wrapper. */
export const redactPrismaOutput = redactAcceptanceOutput;

/** Hard cap so a stream with no newline at all cannot grow without bound. */
const MAX_LINE_BUFFER = 64 * 1024;
/** Tail kept when that cap is hit, so a token cannot be cut in half. */
const OVERFLOW_CARRY = 256;

/**
 * Redact a byte stream that arrives in arbitrary chunks.
 *
 * A child process emits `data` events at pipe boundaries, not token
 * boundaries. Redacting each chunk on its own — or evicting a sliding window —
 * publishes fragments: at 7-byte chunks an earlier version emitted
 * `yirpdhc`, `ydavrtt`, `iongo.s` one after another, which reassembles into the
 * full host on the terminal. So nothing is released until a LINE is complete;
 * a partial tail is held back until its newline arrives.
 */
export function createStreamRedactor(): {
  push(chunk: string): string;
  flush(): string;
} {
  let buffer = "";
  return {
    push(chunk: string): string {
      buffer += chunk;
      const lastNewline = buffer.lastIndexOf("\n");
      if (lastNewline < 0) {
        if (buffer.length <= MAX_LINE_BUFFER) return "";
        // One absurdly long line. Redact the WHOLE buffer first, then split:
        // slicing before redacting would cut a host in half at the boundary.
        // The carry is already redacted. Re-redacting it can only remove MORE
        // (no rule restores text), so a second pass cannot re-expose anything.
        const redacted = redactAcceptanceOutput(buffer);
        const release = redacted.slice(0, Math.max(0, redacted.length - OVERFLOW_CARRY));
        buffer = redacted.slice(Math.max(0, redacted.length - OVERFLOW_CARRY));
        return release;
      }
      const complete = buffer.slice(0, lastNewline + 1);
      buffer = buffer.slice(lastNewline + 1);
      return redactAcceptanceOutput(complete);
    },
    flush(): string {
      const rest = buffer;
      buffer = "";
      return rest ? redactAcceptanceOutput(rest) : "";
    },
  };
}

/**
 * Read an error defensively. A broken error object — a throwing getter, a
 * Proxy, a custom toString — must not blow up the handler that exists to keep
 * the failure quiet; a throw here would surface the original error raw.
 */
function describe(value: unknown): {
  name: string;
  message: string;
  cause: unknown;
  aggregated: unknown[];
} {
  const read = (fn: () => unknown, fallback: string): string => {
    try {
      const raw = fn();
      return typeof raw === "string" ? raw : String(raw);
    } catch {
      return fallback;
    }
  };
  const safeGet = <T>(fn: () => T): T | undefined => {
    try {
      return fn();
    } catch {
      return undefined;
    }
  };
  if (value instanceof Error) {
    const aggregated = safeGet(() => (value as { errors?: unknown[] }).errors);
    return {
      name: read(() => value.name, "Error") || "Error",
      message: read(() => value.message, "(unreadable message)"),
      cause: safeGet(() => (value as { cause?: unknown }).cause),
      aggregated: Array.isArray(aggregated) ? aggregated.slice(0, 2) : [],
    };
  }
  return {
    name: "Error",
    message: read(() => String(value), "(unreadable value)"),
    cause: undefined,
    aggregated: [],
  };
}

/**
 * Format a failure for stderr: error class, optional step and a redacted, short
 * message. The stack is never printed — it names files, and driver stacks carry
 * the host — while the `cause` chain and `AggregateError.errors` ARE walked,
 * because Node's connection failures hide the host in exactly those places.
 */
export function formatAcceptanceError(error: unknown, step?: string): string {
  try {
    if (error === undefined || error === null) {
      return `${step ? `${redactAcceptanceOutput(step).slice(0, 60)} — ` : ""}Error: (no error value)`;
    }
    const parts: string[] = [];
    const seen = new Set<unknown>();
    const visit = (value: unknown, depth: number, label: string): void => {
      if (value === undefined || value === null || depth >= 3 || seen.has(value)) return;
      seen.add(value);
      const { name, message, cause, aggregated } = describe(value);
      // The class name and the step are output too — a caller can put a host in
      // either, so neither is trusted.
      const safeName = redactAcceptanceOutput(name).slice(0, 60);
      const safeMessage = redactAcceptanceOutput(message).slice(0, MAX_MESSAGE_LENGTH);
      parts.push(`${label}${safeName}: ${safeMessage}`);
      visit(cause, depth + 1, "caused by ");
      for (const inner of aggregated) visit(inner, depth + 1, "including ");
    };
    visit(error, 0, "");
    const prefix = step ? `${redactAcceptanceOutput(step).slice(0, 60)} — ` : "";
    return `${prefix}${parts.join(" | ")}`.slice(0, MAX_FORMATTED_LENGTH);
  } catch {
    // Last resort: never let the quiet-failure helper become the loud failure.
    return "Error: (unformattable failure)";
  }
}
