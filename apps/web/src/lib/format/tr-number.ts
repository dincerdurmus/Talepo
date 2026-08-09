/**
 * Turkish number helpers for money inputs.
 * Thousands: `.`  ·  Decimal: `,` (optional; product mostly uses whole TL)
 */

function digitsOnly(value: string): string {
  return value.replace(/\D/g, "");
}

/** 42500 → "42.500" */
export function formatTrNumber(value: number | string): string {
  const digits =
    typeof value === "number"
      ? Number.isFinite(value)
        ? String(Math.trunc(Math.abs(value)))
        : ""
      : digitsOnly(String(value));

  if (!digits) return "";

  const normalized = digits.replace(/^0+(?=\d)/, "");
  return normalized.replace(/\B(?=(\d{3})+(?!\d))/g, ".");
}

/**
 * Parse a TR-formatted amount to a number.
 * "42.500" → 42500 · "42,5" → 42.5 · "₺ 1.234" → 1234
 */
export function parseTrNumber(raw: string): number {
  const trimmed = raw.trim().replace(/\s/g, "").replace(/₺/g, "");
  if (!trimmed) return NaN;

  const hasComma = trimmed.includes(",");
  let normalized = hasComma
    ? trimmed.replace(/\./g, "").replace(",", ".")
    : trimmed.replace(/\./g, "");

  normalized = normalized.replace(/[^\d.-]/g, "");
  if (!normalized || normalized === "-" || normalized === ".") return NaN;

  return Number(normalized);
}

/**
 * Format while the user types. Strips non-digits and regroups with `.`.
 * With `allowFreeText`, leaves range/label strings (e.g. "10.000 – 50.000 TL") unchanged.
 */
export function formatTrNumberInput(
  raw: string,
  options?: { allowFreeText?: boolean },
): string {
  if (!raw) return "";

  if (options?.allowFreeText) {
    const moneyLike = raw.replace(/[₺\s]/g, "");
    if (!/^[\d.]*$/.test(moneyLike)) {
      return raw;
    }
  }

  const digits = digitsOnly(raw);
  if (!digits) return "";
  return formatTrNumber(digits);
}
