import type { PriceIntelligenceResult } from "@/lib/price-intelligence/types";

export type ProPriceIntelligence = {
  marketBand: { low: number; mid: number; high: number; currency: string } | null;
  confidence: number;
  confidenceLevel: "LOW" | "MEDIUM" | "HIGH" | "UNKNOWN";
  sourceQuality: "LOW" | "MEDIUM" | "HIGH" | "UNKNOWN";
  pricePosition: "BELOW_MARKET" | "MARKET" | "ABOVE_MARKET" | "UNKNOWN";
  anomalies: string[];
  suggestedOfferBand: { low: number; target: number; high: number; currency: string } | null;
  strategy: string | null;
  reasons: string[];
  warnings: string[];
  providerSummary: { provider: string; status: string; fetchedCount: number }[];
};

function level(score: number | undefined, sample: number): ProPriceIntelligence["confidenceLevel"] {
  if (score == null || sample <= 0) return "UNKNOWN";
  if (score >= 0.75) return "HIGH";
  if (score >= 0.45) return "MEDIUM";
  return "LOW";
}

export function toProPriceIntelligence(result: PriceIntelligenceResult): ProPriceIntelligence {
  const score = result.overallConfidence?.score;
  const confidence = score ?? 0;
  const confidenceLevel = level(score, result.sampleSize);
  const range = result.marketRange;
  const budget = result.budgetEvaluation;
  const position = budget?.status === "WITHIN_MARKET" ? "MARKET" : budget?.status === "BELOW_MARKET" ? "BELOW_MARKET" : budget?.status === "ABOVE_MARKET" ? "ABOVE_MARKET" : "UNKNOWN";
  const anomalies: string[] = [];
  const warnings: string[] = [];
  if (result.insufficientData || result.sampleSize < 5) { anomalies.push("INSUFFICIENT_SAMPLE"); warnings.push("Örnek sayısı düşük; aralık geniş yorumlanmalı."); }
  if (result.conditionAmbiguity) { anomalies.push("MIXED_CONDITION"); warnings.push("Ürün kondisyonu tam ayrıştırılamadı."); }
  if (result.overallConfidence?.reasons?.length) warnings.push(...result.overallConfidence.reasons.slice(0, 2));
  const reasons = [
    result.sampleSize > 0 ? `${result.sampleSize} fiyat sinyali değerlendirildi.` : "Fiyat sinyali bulunamadı.",
    ...(result.strategy?.strategyReasons?.slice(0, 1) ?? []),
    ...(result.confidenceReasons?.slice(0, 2) ?? []),
  ].filter(Boolean);
  const suggestedOfferBand = range && confidenceLevel !== "UNKNOWN" ? {
    low: Math.round(range.low * 0.97),
    target: Math.round(range.median * (position === "BELOW_MARKET" ? 1.02 : 1)),
    high: Math.round(range.high * 1.03),
    currency: range.currency,
  } : null;
  const providerSummary = result.external ? [{ provider: result.external.providerId ?? "internal", status: result.external.providerStatus, fetchedCount: result.external.fetchedCount }] : [];
  return {
    marketBand: range ? { low: range.low, mid: range.median, high: range.high, currency: range.currency } : null,
    confidence,
    confidenceLevel,
    sourceQuality: result.sampleSize >= 15 && providerSummary.length > 0 ? "HIGH" : result.sampleSize >= 5 ? "MEDIUM" : result.sampleSize > 0 ? "LOW" : "UNKNOWN",
    pricePosition: position,
    anomalies,
    suggestedOfferBand,
    strategy: result.strategy?.strategy ?? null,
    reasons: [...new Set(reasons)].slice(0, 4),
    warnings: [...new Set(warnings)].slice(0, 4),
    providerSummary,
  };
}
