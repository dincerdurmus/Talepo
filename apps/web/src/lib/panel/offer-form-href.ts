import { OPPORTUNITY_REQUEST_DETAIL_BASE } from "@/lib/panel/opportunity-request-detail-href";

/**
 * Canonical supplier offer composer href for a published request.
 * Must stay aligned with `src/app/panel/talepler/[id]/teklif/page.tsx`.
 */
export function offerFormHref(
  requestId: string,
  attributionTouch?: string | null,
): string {
  const base = `${OPPORTUNITY_REQUEST_DETAIL_BASE}/${requestId}/teklif`;
  if (typeof attributionTouch === "string" && attributionTouch.trim()) {
    return `${base}?acq=${encodeURIComponent(attributionTouch.trim())}`;
  }
  return base;
}
