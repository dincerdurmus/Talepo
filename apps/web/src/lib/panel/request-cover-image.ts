/**
 * Canonical request cover: Request.coverImageUrl only.
 * Same field the request detail page reads. No second URL scheme,
 * Wikimedia fetch, or category stock path.
 */
export function primaryRequestCoverImageUrl(
  coverImageUrl: string | null | undefined,
): string | null {
  const value = coverImageUrl?.trim() || null;
  if (!value) return null;
  if (value.startsWith("https://") || value.startsWith("/")) return value;
  return null;
}
