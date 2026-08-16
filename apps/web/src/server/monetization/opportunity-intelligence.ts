import type { FeatureKey } from "@/lib/membership/entitlements";

export type OpportunitySignal = {
  key: string;
  value: "POSITIVE" | "UNKNOWN" | "NEGATIVE";
  weight: number;
  confidence: number;
  reason: string;
};

export type OpportunityIntelligence = {
  context: "PERSONAL" | "WORKSPACE";
  opportunityScore: number;
  confidence: number;
  fitLevel: "STRONG" | "PROMISING" | "LIMITED" | "UNKNOWN";
  reasons: string[];
  risks: string[];
  signals: OpportunitySignal[];
  recommendedAction: "PREPARE_OFFER" | "REVIEW_REQUEST" | "CHECK_INVENTORY" | "WAIT_FOR_MORE_INFO" | "SKIP";
  recommendedActionReason: string;
  urgency: "HIGH" | "MEDIUM" | "LOW" | "UNKNOWN";
  urgencyReason: string;
  pricePosition: "UNKNOWN" | "BELOW_MARKET" | "MARKET" | "ABOVE_MARKET";
  inventoryFit: "MATCH" | "UNKNOWN" | "NO_MATCH";
  nextBestAction: string;
};

export type OpportunityIntelligenceInput = {
  context: "PERSONAL" | "WORKSPACE";
  matchScore: number | null;
  matchReasons?: string[];
  isUrgent: boolean;
  requestCompleteness: number | null;
  ageHours: number | null;
  inventoryFit?: "MATCH" | "UNKNOWN" | "NO_MATCH";
  pricePosition?: OpportunityIntelligence["pricePosition"];
  priceConfidence?: number | null;
  offerCount?: number | null;
};

export const OPPORTUNITY_INTELLIGENCE_FEATURE: FeatureKey = "advanced_opportunity_analysis";

export const OPPORTUNITY_ACTION_LABELS: Record<OpportunityIntelligence["recommendedAction"], string> = {
  PREPARE_OFFER: "Teklif hazırlamaya değer",
  REVIEW_REQUEST: "Talebi ayrıntılı incele",
  CHECK_INVENTORY: "Envanteri kontrol et",
  WAIT_FOR_MORE_INFO: "Daha fazla bilgi bekle",
  SKIP: "Şimdilik bekle",
};

function resolveRecommendedAction(
  context: OpportunityIntelligenceInput["context"],
  fitLevel: OpportunityIntelligence["fitLevel"],
  inventoryFit: OpportunityIntelligenceInput["inventoryFit"],
  matchScore: number | null,
): OpportunityIntelligence["recommendedAction"] {
  const candidate: OpportunityIntelligence["recommendedAction"] =
    fitLevel === "STRONG" && inventoryFit !== "NO_MATCH"
      ? "PREPARE_OFFER"
      : fitLevel === "UNKNOWN" || matchScore == null
        ? "WAIT_FOR_MORE_INFO"
        : fitLevel === "LIMITED"
          ? "REVIEW_REQUEST"
          : inventoryFit === "UNKNOWN"
            ? "CHECK_INVENTORY"
            : "REVIEW_REQUEST";
  // Personal has no company inventory; CHECK_INVENTORY is only a workspace next step.
  if (context === "PERSONAL" && candidate === "CHECK_INVENTORY") return "REVIEW_REQUEST";
  return candidate;
}

export function buildOpportunityIntelligence(input: OpportunityIntelligenceInput): OpportunityIntelligence {
  const signals: OpportunitySignal[] = [];
  const reasons: string[] = [];
  const risks: string[] = [];
  let score = 0;
  let known = 0;

  if (input.matchScore != null) {
    const value = input.matchScore >= 70 ? "POSITIVE" : input.matchScore < 30 ? "NEGATIVE" : "UNKNOWN";
    signals.push({ key: "MATCH_FIT", value, weight: 45, confidence: 1, reason: input.matchScore >= 70 ? "Kategori, konum veya uzmanlık eşleşmesi güçlü." : input.matchScore < 30 ? "Mevcut eşleşme sinyali zayıf." : "Eşleşme sinyali kısmi." });
    score += Math.round(input.matchScore * 0.45);
    known += 45;
    if (input.matchScore >= 70) reasons.push(...(input.matchReasons?.slice(0, 2) ?? ["Güçlü talep eşleşmesi."]));
    if (input.matchScore < 50) risks.push("Eşleşme sinyali henüz yeterince güçlü değil.");
  } else {
    signals.push({ key: "MATCH_FIT", value: "UNKNOWN", weight: 45, confidence: 0, reason: "Eşleşme verisi mevcut değil." });
    risks.push("Eşleşme verisi bulunamadı.");
  }

  if (input.inventoryFit === "MATCH") {
    score += 20;
    known += 20;
    if (input.context !== "PERSONAL") reasons.push("Şirket envanterinde uyumlu ürün bulundu.");
    signals.push({ key: "INVENTORY_FIT", value: "POSITIVE", weight: 20, confidence: 1, reason: "Kanonik envanter eşleşmesi mevcut." });
  } else if (input.inventoryFit === "NO_MATCH") {
    known += 20;
    if (input.context !== "PERSONAL") risks.push("Şirket envanterinde uygun ürün bulunamadı.");
    signals.push({ key: "INVENTORY_FIT", value: "NEGATIVE", weight: 20, confidence: 1, reason: "Kanonik envanter eşleşmesi bulunamadı." });
  } else signals.push({ key: "INVENTORY_FIT", value: "UNKNOWN", weight: 20, confidence: 0, reason: "Envanter bilgisi mevcut değil." });

  if (input.requestCompleteness != null) { const c = Math.max(0, Math.min(100, input.requestCompleteness)); score += Math.round(c * 0.15); known += 15; signals.push({ key: "REQUEST_COMPLETENESS", value: c >= 70 ? "POSITIVE" : "UNKNOWN", weight: 15, confidence: 1, reason: c >= 70 ? "Talep karar vermek için yeterince detaylı." : "Talepte karar için eksik bilgiler var." }); if (c < 70) risks.push("Talep detayları eksik; teklif öncesi inceleme gerekebilir."); }
  else signals.push({ key: "REQUEST_COMPLETENESS", value: "UNKNOWN", weight: 15, confidence: 0, reason: "Talep doluluk verisi mevcut değil." });

  if (input.pricePosition && input.pricePosition !== "UNKNOWN" && (input.priceConfidence ?? 0) > 0) { known += 10; if (input.pricePosition === "MARKET" || input.pricePosition === "BELOW_MARKET") { score += 10; reasons.push("Bütçe mevcut piyasa sinyaliyle uyumlu."); } else risks.push("Bütçe piyasa sinyalinin üzerinde görünüyor."); signals.push({ key: "PRICE_FIT", value: input.pricePosition === "ABOVE_MARKET" ? "NEGATIVE" : "POSITIVE", weight: 10, confidence: input.priceConfidence ?? 0, reason: "Mevcut fiyat istihbaratı sonucu." }); }
  else signals.push({ key: "PRICE_FIT", value: "UNKNOWN", weight: 10, confidence: 0, reason: "Güvenilir fiyat sinyali yok; fiyat varsayılmadı." });

  const urgency = input.isUrgent ? "HIGH" : input.ageHours != null && input.ageHours <= 24 ? "MEDIUM" : input.ageHours == null ? "UNKNOWN" : "LOW";
  const urgencyReason = input.isUrgent ? "Alıcı talebi acil olarak işaretledi." : urgency === "MEDIUM" ? "Talep yeni yayınlandı." : urgency === "UNKNOWN" ? "Tazelik verisi mevcut değil." : "Acil sinyal bulunmuyor.";
  if (input.isUrgent) { score += 10; known += 10; }
  if (input.offerCount != null && input.offerCount <= 1) reasons.push("Görünen teklif sayısı düşük.");

  score = Math.max(0, Math.min(100, score));
  const confidence = Math.round((known / 100) * 100) / 100;
  const fitLevel = score >= 75 ? "STRONG" : score >= 50 ? "PROMISING" : score > 0 ? "LIMITED" : "UNKNOWN";
  const recommendedAction = resolveRecommendedAction(input.context, fitLevel, input.inventoryFit, input.matchScore);
  const recommendedActionReason = recommendedAction === "PREPARE_OFFER" ? "Eşleşme güçlü; mevcut sinyaller teklif hazırlamayı destekliyor." : recommendedAction === "CHECK_INVENTORY" ? "Teklif öncesi envanter uygunluğu doğrulanmalı." : recommendedAction === "WAIT_FOR_MORE_INFO" ? "Karar vermek için güvenilir sinyal eksik." : "Eksik veya zayıf sinyaller nedeniyle talep incelenmeli.";
  return { context: input.context, opportunityScore: score, confidence, fitLevel, reasons: [...new Set(reasons)].slice(0, 4), risks: [...new Set(risks)].slice(0, 4), signals, recommendedAction, recommendedActionReason, urgency, urgencyReason, pricePosition: input.pricePosition ?? "UNKNOWN", inventoryFit: input.inventoryFit ?? "UNKNOWN", nextBestAction: recommendedAction === "PREPARE_OFFER" ? "Uygun ürünü seçerek teklif taslağı hazırla." : recommendedAction === "CHECK_INVENTORY" ? "Şirket envanterini kontrol et." : "Talep detaylarını ve eksik bilgileri incele." };
}
