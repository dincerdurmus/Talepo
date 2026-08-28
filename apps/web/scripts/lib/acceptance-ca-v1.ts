/**
 * The pinned acceptance CA.
 *
 * Supabase signs its pooler with a root that is not in Node's trust store, so a
 * `verify-full` connection fails with SELF_SIGNED_CERT_IN_CHAIN. There are two
 * ways out of that and only one of them is acceptable: turn verification off, or
 * tell Node which root to trust. This module does the second, and is written so
 * the first cannot creep back in — nothing here can produce a relaxed TLS
 * option, and every failure is a refusal rather than a fallback.
 *
 * The certificate is obtained by a person, from the acceptance project's own
 * Supabase dashboard, and placed at one fixed path. It is never fetched here:
 * a CA downloaded by the program that will trust it proves nothing, and a CA
 * taken from the primary project would quietly re-point this harness at the
 * database it exists to stay away from.
 *
 * Trust is pinned twice over. The file must parse as exactly one CA certificate
 * that is currently valid, AND its SHA-256 fingerprint must equal the one the
 * operator wrote into `.env.acceptance` after downloading it. The file alone is
 * not enough: anything that can write into the working tree could otherwise
 * substitute a root of its own choosing.
 *
 * Pure module: it reads one file at one fixed path and never opens a connection.
 */

import { X509Certificate } from "node:crypto";
import { lstatSync, readFileSync } from "node:fs";
import { isAbsolute, join, resolve } from "node:path";

/** The one directory a CA may live in, relative to apps/web. */
export const ACCEPTANCE_CA_DIR_NAME = ".acceptance";

/** The one file name. Both halves are fixed so there is nothing to point elsewhere. */
export const ACCEPTANCE_CA_FILE_NAME = "supabase-ca.crt";

/** A certificate is kilobytes; anything larger is not one. */
const MAX_CA_FILE_BYTES = 256 * 1024;

/** The `.env.acceptance` key holding the fingerprint the operator recorded. */
export const ACCEPTANCE_CA_FINGERPRINT_KEY = "ACCEPTANCE_DB_CA_SHA256";

export type CaRejectReason =
  | "CA_PATH_NOT_THE_PINNED_LOCATION"
  | "CA_PATH_NOT_A_REGULAR_FILE"
  | "CA_FILE_MISSING"
  | "CA_FILE_UNREADABLE"
  | "CA_FILE_EMPTY"
  | "CA_NOT_VALID_PEM"
  | "CA_CONTAINS_PRIVATE_KEY"
  | "CA_MULTIPLE_CERTIFICATES"
  | "CA_NOT_A_CERTIFICATE_AUTHORITY"
  | "CA_NOT_YET_VALID"
  | "CA_EXPIRED"
  | "CA_FINGERPRINT_NOT_DECLARED"
  | "CA_FINGERPRINT_MISMATCH";

export type CaDecision =
  | { ok: true; pem: string; fingerprint: string }
  | { ok: false; reason: CaRejectReason; detail: string };

export type CaPathDecision =
  | { ok: true; path: string }
  | { ok: false; reason: CaRejectReason; detail: string };

/** Minimal shape this module needs from a parsed certificate. */
type ParsedCertificate = {
  ca: boolean;
  fingerprint256: string;
  validFromDate: Date;
  validToDate: Date;
  /** Canonical re-encoding of this one certificate. */
  pem: string;
};

/**
 * Resolve the CA path, accepting only the single pinned location.
 *
 * A candidate is compared after `resolve`, so `..` segments, an absolute path
 * somewhere else and a nested path that climbs back out all collapse to a string
 * that is simply not the pinned one. There is no allowance to widen: an
 * acceptance CA that could come from anywhere is not pinned at all.
 */
export function resolveAcceptanceCaPath(
  candidate?: string,
  webRoot: string = join(__dirname, "..", ".."),
): CaPathDecision {
  const pinned = resolve(join(webRoot, ACCEPTANCE_CA_DIR_NAME, ACCEPTANCE_CA_FILE_NAME));
  if (candidate === undefined) return { ok: true, path: pinned };
  const resolved = resolve(isAbsolute(candidate) ? candidate : join(webRoot, candidate));
  if (resolved !== pinned) {
    return {
      ok: false,
      reason: "CA_PATH_NOT_THE_PINNED_LOCATION",
      detail: `the CA is read only from ${ACCEPTANCE_CA_DIR_NAME}/${ACCEPTANCE_CA_FILE_NAME}`,
    };
  }
  return { ok: true, path: pinned };
}

/**
 * Judge the CA file's CONTENT. Split from the filesystem so every refusal can be
 * driven with a certificate rather than inferred from one.
 *
 * `parse` is injectable for the same reason: branches like "this is a leaf, not
 * a CA" need a certificate shape that a trust store does not contain, and a gate
 * that cannot reach a branch cannot prove the branch works.
 */
export function evaluateAcceptanceCaPem(
  pem: string,
  opts: {
    expectedFingerprint?: string;
    now?: Date;
    parse?: (pem: string) => ParsedCertificate;
  } = {},
): CaDecision {
  if (pem.trim() === "") {
    return { ok: false, reason: "CA_FILE_EMPTY", detail: "the CA file has no content" };
  }
  // Refused before parsing: a bundle carrying a key is not a trust anchor, it is
  // a credential, and it must not be read further or reported on in any detail.
  if (/-----BEGIN [A-Za-z ]*PRIVATE KEY-----/i.test(pem)) {
    return {
      ok: false,
      reason: "CA_CONTAINS_PRIVATE_KEY",
      detail: "the CA file contains a private key and must be replaced",
    };
  }
  // Every label OpenSSL reads as a certificate is counted, not just the usual
  // one. `TRUSTED CERTIFICATE` and `X509 CERTIFICATE` parse the same way, so a
  // file could otherwise carry the pinned CA first — matching the fingerprint —
  // and a second anchor after it, and both would reach Node's trust list.
  const certificateBlocks =
    pem.match(/-----BEGIN (?:TRUSTED |X509 )?CERTIFICATE-----/gi)?.length ?? 0;
  if (certificateBlocks === 0) {
    return { ok: false, reason: "CA_NOT_VALID_PEM", detail: "no PEM certificate block found" };
  }
  // One anchor, not a bundle. A chain would let an unexamined certificate ride
  // along with the one the fingerprint was computed for.
  if (certificateBlocks > 1) {
    return {
      ok: false,
      reason: "CA_MULTIPLE_CERTIFICATES",
      detail: `expected exactly one certificate, found ${certificateBlocks}`,
    };
  }

  let certificate: ParsedCertificate;
  try {
    certificate = (opts.parse ?? defaultParse)(pem);
  } catch {
    return { ok: false, reason: "CA_NOT_VALID_PEM", detail: "the certificate did not parse" };
  }

  if (!certificate.ca) {
    return {
      ok: false,
      reason: "CA_NOT_A_CERTIFICATE_AUTHORITY",
      detail: "the certificate is not a CA and cannot anchor a chain",
    };
  }

  // The validity window is checked HERE, whichever parser produced it. An
  // `Invalid Date` compares false in both directions, so a certificate carrying
  // one would slip past both bounds — a fail-open that looks like no code at
  // all. `parse` is an exported option, so this invariant cannot live inside the
  // default parser: it has to sit on the evaluator's side of that seam.
  if (!isUsableInstant(certificate.validFromDate) || !isUsableInstant(certificate.validToDate)) {
    return {
      ok: false,
      reason: "CA_NOT_VALID_PEM",
      detail: "the certificate's validity dates are not readable instants",
    };
  }

  const now = opts.now ?? new Date();
  if (now < certificate.validFromDate) {
    return { ok: false, reason: "CA_NOT_YET_VALID", detail: "the CA's validity has not started" };
  }
  if (now > certificate.validToDate) {
    return { ok: false, reason: "CA_EXPIRED", detail: "the CA has expired" };
  }

  const fingerprint = normaliseFingerprint(certificate.fingerprint256);
  const expected = normaliseFingerprint(opts.expectedFingerprint ?? "");
  if (expected === "") {
    return {
      ok: false,
      reason: "CA_FINGERPRINT_NOT_DECLARED",
      detail: `${ACCEPTANCE_CA_FINGERPRINT_KEY} is not set in .env.acceptance`,
    };
  }
  // Compared in full. A prefix match would accept a certificate that merely
  // starts the same way, which is the whole content of a pin.
  if (fingerprint !== expected) {
    return {
      ok: false,
      reason: "CA_FINGERPRINT_MISMATCH",
      detail: `${ACCEPTANCE_CA_FINGERPRINT_KEY} does not match the file on disk`,
    };
  }

  // The CANONICAL re-encoding of the certificate that was judged is returned,
  // never the file's raw bytes. Anything the parser ignored — a second anchor
  // under another label, text before the block — is dropped here instead of
  // being handed to Node as a trust anchor nobody examined.
  return { ok: true, pem: certificate.pem, fingerprint };
}

/**
 * Read and judge the pinned CA.
 *
 * `lstat` — not `stat` — because a symlink or a Windows junction pointing at
 * another file would otherwise be read as if it were the pinned one, which is
 * exactly the substitution the fixed path exists to prevent.
 */
export function loadAcceptanceCa(opts: {
  expectedFingerprint?: string;
  /** Injectable so the non-regular-file refusal can be measured without creating links. */
  lstat?: (path: string) => { isFile(): boolean; isSymbolicLink(): boolean; size: number };
  candidatePath?: string;
  webRoot?: string;
  now?: Date;
}): CaDecision {
  const path = resolveAcceptanceCaPath(opts.candidatePath, opts.webRoot);
  if (!path.ok) return { ok: false, reason: path.reason, detail: path.detail };

  let stats;
  try {
    stats = (opts.lstat ?? lstatSync)(path.path);
  } catch (statError) {
    // "Not there" and "cannot be read" are different problems for the operator,
    // and collapsing them sends someone with a permissions error hunting for a
    // missing file.
    const code = (statError as { code?: string }).code;
    return code === "ENOENT"
      ? {
          ok: false,
          reason: "CA_FILE_MISSING",
          detail: `no CA at ${ACCEPTANCE_CA_DIR_NAME}/${ACCEPTANCE_CA_FILE_NAME}`,
        }
      : { ok: false, reason: "CA_FILE_UNREADABLE", detail: "the CA path could not be inspected" };
  }
  // A CA is a few kilobytes. A larger file is not one, and reading it into memory
  // before finding that out is work done on behalf of whoever placed it there.
  if (stats.size > MAX_CA_FILE_BYTES) {
    return {
      ok: false,
      reason: "CA_FILE_UNREADABLE",
      detail: "the CA file is far larger than a certificate",
    };
  }
  if (!stats.isFile() || stats.isSymbolicLink()) {
    return {
      ok: false,
      reason: "CA_PATH_NOT_A_REGULAR_FILE",
      detail: "the pinned CA path is a link or a directory, not a regular file",
    };
  }

  let pem: string;
  try {
    pem = readFileSync(path.path, "utf8");
  } catch {
    return { ok: false, reason: "CA_FILE_UNREADABLE", detail: "the CA file could not be read" };
  }

  return evaluateAcceptanceCaPem(pem, {
    expectedFingerprint: opts.expectedFingerprint,
    now: opts.now,
  });
}

function defaultParse(pem: string): ParsedCertificate {
  const certificate = new X509Certificate(pem);
  return {
    ca: certificate.ca,
    fingerprint256: certificate.fingerprint256,
    // Parsed from the string form: the Date accessors exist at runtime but not
    // in this workspace's @types/node, and the harness types are checked.
    validFromDate: requireDate(certificate.validFrom),
    validToDate: requireDate(certificate.validTo),
    pem: certificate.toString(),
  };
}

/**
 * A real point in time: a Date instance whose value is finite. Rejects
 * `Invalid Date`, NaN, `undefined` and anything that is not a Date at all —
 * every shape a substituted parser could return in place of a timestamp.
 */
function isUsableInstant(value: unknown): value is Date {
  return value instanceof Date && Number.isFinite(value.getTime());
}

/**
 * A date that cannot be read is an error, not a permissive default. Left as an
 * `Invalid Date`, BOTH validity comparisons return false and an expired CA would
 * sail through — a fail-open produced by doing nothing.
 */
function requireDate(value: string): Date {
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) {
    throw new Error("certificate validity dates could not be read");
  }
  return parsed;
}

/** Colons and case are presentation; the pin is the 32 bytes underneath. */
function normaliseFingerprint(value: string): string {
  return value.replace(/[:\s]/g, "").toLowerCase();
}
