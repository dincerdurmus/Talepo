/**
 * Central redaction policy for operational logs and product telemetry.
 * Never log secrets, auth material, or raw user free-text by default.
 */

const SENSITIVE_KEY =
  /^(password|passwd|pwd|token|secret|cookie|authorization|auth|api[_-]?key|access[_-]?token|refresh[_-]?token|id[_-]?token|session|credential|private[_-]?key|client[_-]?secret|verification[_-]?token|email[_-]?token|bearer)$/i;

const SENSITIVE_SUBSTRING =
  /(password|secret|token|cookie|authorization|api[_-]?key|credential|private[_-]?key)/i;

export const REDACTED = "[REDACTED]";

export function isSensitiveKey(key: string): boolean {
  if (SENSITIVE_KEY.test(key)) return true;
  return SENSITIVE_SUBSTRING.test(key);
}

export function redactValue(value: unknown, key?: string): unknown {
  if (key && isSensitiveKey(key)) return REDACTED;
  if (typeof value === "string") {
    if (looksLikeBearer(value) || looksLikeJwt(value)) return REDACTED;
    return value;
  }
  if (Array.isArray(value)) {
    return value.map((item) => redactValue(item));
  }
  if (value && typeof value === "object") {
    return redactObject(value as Record<string, unknown>);
  }
  return value;
}

export function redactObject(
  input: Record<string, unknown> | null | undefined,
): Record<string, unknown> {
  if (!input) return {};
  const out: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(input)) {
    out[key] = redactValue(value, key);
  }
  return out;
}

/** Headers commonly carrying secrets — strip before logging. */
export function redactHeaders(
  headers: Headers | Record<string, string | null | undefined>,
): Record<string, string> {
  const out: Record<string, string> = {};
  const entries =
    headers instanceof Headers
      ? Array.from(headers.entries())
      : Object.entries(headers).map(([k, v]) => [k, v ?? ""] as const);

  for (const [key, value] of entries) {
    if (isSensitiveKey(key) || key.toLowerCase() === "cookie") {
      out[key] = REDACTED;
    } else {
      out[key] = String(value);
    }
  }
  return out;
}

function looksLikeBearer(value: string): boolean {
  return /^bearer\s+\S+/i.test(value.trim());
}

function looksLikeJwt(value: string): boolean {
  return /^[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+$/.test(value.trim());
}

/** Keys that must never appear in product telemetry metadata. */
export const TELEMETRY_FORBIDDEN_METADATA_KEYS = [
  "password",
  "token",
  "secret",
  "cookie",
  "authorization",
  "email",
  "phone",
  "description",
  "message",
  "content",
  "rawText",
  "freeText",
  "title",
  "professionalDescription",
] as const;

export function sanitizeTelemetryMetadata(
  metadata: Record<string, unknown> | undefined,
): Record<string, unknown> {
  if (!metadata) return {};
  const out: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(metadata)) {
    if (TELEMETRY_FORBIDDEN_METADATA_KEYS.some((k) => k.toLowerCase() === key.toLowerCase())) {
      continue;
    }
    if (isSensitiveKey(key)) continue;
    if (typeof value === "string" && value.length > 120) {
      out[key] = value.slice(0, 120);
      continue;
    }
    out[key] = redactValue(value, key);
  }
  return out;
}
