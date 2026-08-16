import type { FeatureKey } from "./entitlements";
import type { PlanTierId } from "./plans";

export type PublicProduct = "STANDARD" | "PRO";
export type ProductContext = "PERSONAL" | "WORKSPACE";

export function getPublicProduct(tier: PlanTierId, context: ProductContext = "PERSONAL"): PublicProduct {
  return tier === "STANDARD" ? "STANDARD" : "PRO";
}

export function getPublicProductLabel(tier: PlanTierId, context: ProductContext = "PERSONAL") {
  if (tier === "STANDARD") return "STANDARD";
  return context === "WORKSPACE" ? "PRO Workspace" : "PRO";
}

export const PUBLIC_FEATURE_MATRIX = [
  { label: "Temel Talep ve Teklif", standard: "Temel kullanım", pro: "Gelişmiş kullanım" },
  { label: "Opportunity Intelligence", standard: "Temel eşleşme", pro: "Gelişmiş fırsat analizi" },
  { label: "Price Intelligence", standard: "Temel piyasa göstergesi", pro: "Gelişmiş fiyat analizi" },
  { label: "Offer Copilot", standard: "—", pro: "Dahil" },
  { label: "Follow-up Intelligence", standard: "—", pro: "Dahil" },
  { label: "Workspace", standard: "—", pro: "Ekip kullanımında" },
] as const;

export const PRO_VALUE_MESSAGES: Partial<Record<FeatureKey, string>> = {
  advanced_opportunity_analysis: "Bu fırsatın neden sana uygun olduğunu gör.",
  advanced_ai_pricing: "Önerilen teklif aralığını ve güven seviyesini gör.",
  ai_offer_assistant: "Teklif taslağını PRO ile hazırla.",
};
