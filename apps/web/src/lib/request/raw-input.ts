/**
 * Request text field roles (Phase 1 authority):
 *
 * - rawInput: User-authored free text before AI rewrite. Never AI-overwritten.
 * - professionalDescription: Talepo/AI composed readable description.
 * - description: Legacy primary display/storage field used by existing surfaces.
 *   Phase 1 keeps writing it as today so supplier/buyer views do not shift;
 *   rawInput is the durable original. Prefer rawInput when both exist.
 */

export const RAW_INPUT_MAX_LENGTH = 10_000;

/** System Category.slug for unresolved soft category (not in REQUEST_CATEGORIES). */
export const UNRESOLVED_CATEGORY_SLUG = "unresolved";

/** Display name for the persistence-only unresolved Category row. */
export const UNRESOLVED_CATEGORY_NAME = "Belirsiz kategori (sistem)";

export function isSystemCategorySlug(
  slug: string | null | undefined,
): boolean {
  const trimmed = slug?.trim() ?? "";
  return trimmed === UNRESOLVED_CATEGORY_SLUG;
}

/** Filter DB Category rows so system soft-categories never appear in pickers. */
export function excludeSystemCategories<T extends { slug: string }>(
  rows: T[],
): T[] {
  return rows.filter((row) => !isSystemCategorySlug(row.slug));
}

/**
 * Sanitize user free text without rewriting meaning.
 * Strips NULs / control chars only — does not replace PII or compose AI copy.
 */
export function sanitizeRawInput(value: unknown): string {
  if (typeof value !== "string") return "";
  return value
    .replace(/\u0000/g, "")
    .replace(/[\u0001-\u0008\u000B\u000C\u000E-\u001F\u007F]/g, "")
    .trim()
    .slice(0, RAW_INPUT_MAX_LENGTH);
}

/** Prefer durable original; fall back to legacy description for old rows. */
export function resolveAuthoritativeRequestText(input: {
  rawInput?: string | null;
  description?: string | null;
}): string {
  const raw = input.rawInput?.trim();
  if (raw) return raw;
  return input.description?.trim() ?? "";
}
