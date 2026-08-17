/**
 * Offer acquisition source taxonomy (Attribution V1).
 * Decision-assistance (Offer Intelligence) is NOT an acquisition source.
 */

export const OFFER_ACQUISITION_SOURCES = [
  "DIRECT",
  "DISCOVERY",
  "RADAR",
  "FOLLOW",
  "OPPORTUNITY",
  "UNKNOWN",
] as const;

export type OfferAcquisitionSource = (typeof OFFER_ACQUISITION_SOURCES)[number];

/** Product surfaces that may appear in Professional Analiz source performance. */
export const ANALIZ_SOURCE_PERFORMANCE_SOURCES = [
  "RADAR",
  "FOLLOW",
  "OPPORTUNITY",
  "DISCOVERY",
] as const;

export type AnalizSourcePerformanceSource =
  (typeof ANALIZ_SOURCE_PERFORMANCE_SOURCES)[number];

/**
 * Touch tokens expire after one day.
 * Reasoning: attribution must reflect the journey that led to offer create.
 * A Radar/Follow/OC link reused weeks later is not the same commercial session;
 * expired tokens downgrade to UNKNOWN instead of inventing source.
 */
export const OFFER_ATTRIBUTION_TOUCH_TTL_MS = 24 * 60 * 60 * 1000;

/** Query param carrying the signed acquisition touch (not authority by itself). */
export const OFFER_ATTRIBUTION_TOUCH_PARAM = "acq";

export const OFFER_ACQUISITION_SOURCE_LABELS: Record<
  OfferAcquisitionSource,
  string
> = {
  DIRECT: "Doğrudan",
  DISCOVERY: "Talepleri Keşfet",
  RADAR: "Talepo Radar",
  FOLLOW: "Takiplerim",
  OPPORTUNITY: "Fırsatlar",
  UNKNOWN: "Kaynak bilinmiyor",
};

export function isOfferAcquisitionSource(
  value: unknown,
): value is OfferAcquisitionSource {
  return (
    typeof value === "string" &&
    (OFFER_ACQUISITION_SOURCES as readonly string[]).includes(value)
  );
}

export function appendAttributionTouch(
  href: string,
  touch: string | null | undefined,
): string {
  if (!touch) return href;
  const join = href.includes("?") ? "&" : "?";
  return `${href}${join}${OFFER_ATTRIBUTION_TOUCH_PARAM}=${encodeURIComponent(touch)}`;
}

export function readAttributionTouchFromSearchParams(
  params: URLSearchParams | { get(name: string): string | null },
): string | null {
  const raw = params.get(OFFER_ATTRIBUTION_TOUCH_PARAM);
  if (!raw || typeof raw !== "string") return null;
  const trimmed = raw.trim();
  return trimmed.length > 0 ? trimmed : null;
}
