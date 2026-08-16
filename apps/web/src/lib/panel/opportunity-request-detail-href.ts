/**
 * Canonical supplier-facing request detail for opportunity cards.
 * Uses Request.id only — never match / opportunity / feed-item ids.
 */
export const OPPORTUNITY_REQUEST_DETAIL_BASE = "/panel/talepler";

export function opportunityRequestDetailHref(
  requestId: string | null | undefined,
): string | null {
  if (typeof requestId !== "string") return null;
  const id = requestId.trim();
  if (!id) return null;
  return `${OPPORTUNITY_REQUEST_DETAIL_BASE}/${id}`;
}
