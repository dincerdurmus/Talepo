export type PlanTierId = "STANDARD" | "PREMIUM" | "PROFESSIONAL" | "CORPORATE";

export type PlanDefinition = {
  id: PlanTierId;
  label: string;
  badge: string;
  description: string;
  /**
   * Monthly included offer quota.
   * `null` means unlimited (no magic 9999 in the core model).
   */
  monthlyOfferQuota: number | null;
  requestAccessDelayHours: number;
  instantRequestAccess: boolean;
  aiOfferAssistant: boolean;
  advancedAiPricing: boolean;
  alertRules: boolean;
  urgentRequestPriority: boolean;
  advancedFilters: boolean;
  hiddenInventory: boolean;
  priceTry: number | null;
};

export const PLAN_DEFINITIONS: Record<PlanTierId, PlanDefinition> = {
  STANDARD: {
    id: "STANDARD",
    label: "Standart",
    badge: "Ücretsiz",
    description: "Talep oluşturma ücretsiz. Firmalar ayda 5 teklif hakkı ile başlar.",
    monthlyOfferQuota: 5,
    requestAccessDelayHours: 24,
    instantRequestAccess: false,
    aiOfferAssistant: false,
    advancedAiPricing: false,
    alertRules: false,
    urgentRequestPriority: false,
    advancedFilters: false,
    hiddenInventory: false,
    priceTry: null,
  },
  PREMIUM: {
    id: "PREMIUM",
    label: "Premium",
    badge: "Popüler",
    description: "Yeni taleplere anında eriş, sınırsız teklif ver, AI araçlarından yararlan.",
    monthlyOfferQuota: null,
    requestAccessDelayHours: 0,
    instantRequestAccess: true,
    aiOfferAssistant: true,
    advancedAiPricing: true,
    alertRules: true,
    urgentRequestPriority: false,
    advancedFilters: false,
    hiddenInventory: false,
    priceTry: 990,
  },
  PROFESSIONAL: {
    id: "PROFESSIONAL",
    label: "Profesyonel",
    badge: "Pro",
    description: "Acil taleplere öncelik, gelişmiş filtreler ve detaylı piyasa analizi.",
    monthlyOfferQuota: null,
    requestAccessDelayHours: 0,
    instantRequestAccess: true,
    aiOfferAssistant: true,
    advancedAiPricing: true,
    alertRules: true,
    urgentRequestPriority: true,
    advancedFilters: true,
    hiddenInventory: false,
    priceTry: 2490,
  },
  CORPORATE: {
    id: "CORPORATE",
    label: "Kurumsal",
    badge: "Kurumsal",
    description: "Kategori takibi, otomatik bildirimler ve gizli envanter eşleştirme.",
    monthlyOfferQuota: null,
    requestAccessDelayHours: 0,
    instantRequestAccess: true,
    aiOfferAssistant: true,
    advancedAiPricing: true,
    alertRules: true,
    urgentRequestPriority: true,
    advancedFilters: true,
    hiddenInventory: true,
    priceTry: null,
  },
};

export const OFFER_CREDIT_PACKS = {
  PACK_5: { credits: 5, priceTry: 149, label: "Ek 5 teklif" },
  PACK_10: { credits: 10, priceTry: 249, label: "Ek 10 teklif" },
  PACK_25: { credits: 25, priceTry: 499, label: "Ek 25 teklif" },
} as const;

export const FEATURE_BOOST_OPTIONS = {
  FEATURE_24H: { hours: 24, priceTry: 99, label: "24 saat öne çıkar" },
  FEATURE_3D: { hours: 72, priceTry: 199, label: "3 gün öne çıkar" },
  FEATURE_7D: { hours: 168, priceTry: 349, label: "7 gün öne çıkar" },
} as const;

export function getPlanDefinition(tier: string): PlanDefinition {
  return PLAN_DEFINITIONS[tier as PlanTierId] ?? PLAN_DEFINITIONS.STANDARD;
}

export function isPaidPlan(tier: string) {
  return tier !== "STANDARD";
}

export function hasInstantAccess(tier: string) {
  return getPlanDefinition(tier).instantRequestAccess;
}

/** Legacy display helper when UI still expects a finite number. */
export function legacyQuotaDisplay(limit: number | null): number {
  return limit ?? 9999;
}
