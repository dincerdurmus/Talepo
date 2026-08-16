export type PlanTierId = "STANDARD" | "PREMIUM" | "PROFESSIONAL" | "CORPORATE";

/** Public product catalog. PREMIUM/CORPORATE remain legacy storage values only. */
export const AVAILABLE_PLAN_IDS = ["STANDARD", "PROFESSIONAL"] as const;
export type AvailablePlanTierId = (typeof AVAILABLE_PLAN_IDS)[number];

/** Storage accepts 4 legacy plan values; normalize unknowns to STANDARD. */
export function normalizeStoredPlanTier(
  value: string | null | undefined,
): PlanTierId {
  if (
    value === "STANDARD" ||
    value === "PREMIUM" ||
    value === "PROFESSIONAL" ||
    value === "CORPORATE"
  ) {
    return value;
  }

  return "STANDARD";
}

/** Canonical entitlement interpretation used across runtime checks:
 * PREMIUM and CORPORATE are treated as PROFESSIONAL entitlement for feature access.
 */
export function canonicalizePlanTier(storedPlanTier: PlanTierId): PlanTierId {
  return storedPlanTier === "PREMIUM" || storedPlanTier === "CORPORATE"
    ? "PROFESSIONAL"
    : storedPlanTier;
}

/** Compatibility predicates kept for P0 contract; legacy names must stay stored but not reintroduced elsewhere. */
export function isLegacyCorporateAccount(storedPlanTier: PlanTierId): boolean {
  return storedPlanTier === "CORPORATE";
}

export function isWorkspaceEligible(storedOrEffectivePlanTier: PlanTierId): boolean {
  return canonicalizePlanTier(storedOrEffectivePlanTier) === "PROFESSIONAL";
}

export function hasWorkspaceCapability(storedPlanTier: PlanTierId): boolean {
  return isWorkspaceEligible(storedPlanTier);
}

/**
 * TEST bayrağı — Standart plan 24 saat talep görme gecikmesi.
 * `true` = canlı davranış (Standart 24 saat bekler).
 * `false` = test/geçici: herkes anında görür.
 *
 * Bağlı yerler:
 * - entitlements.ts → STANDARD'a instant_request_access ver/alma (asıl keşif filtresi)
 * - create-request.ts → Request.visibleToSuppliersAt
 * - assert-entitlement.ts → canAccessRequest / buildSupplierVisibilityFilter
 * - distribute-request.ts → gecikmeli bildirim metni
 * - panel/talepler + OfferForm → uyarı kutuları (instant_request_access)
 */
export const ENABLE_STANDARD_REQUEST_ACCESS_DELAY = false;

const STANDARD_REQUEST_ACCESS_DELAY_HOURS = 24;

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
  /** Display mirror of PLAN_PRICING — pricing-config.ts is canonical SoT. */
  priceTry: number | null;
};

export const PLAN_DEFINITIONS: Record<PlanTierId, PlanDefinition> = {
  STANDARD: {
    id: "STANDARD",
    label: "Bireysel",
    badge: "Ücretsiz",
    description: "Talep oluşturma ücretsiz. Firmalar ayda 5 teklif hakkı ile başlar.",
    monthlyOfferQuota: 5,
    requestAccessDelayHours: ENABLE_STANDARD_REQUEST_ACCESS_DELAY
      ? STANDARD_REQUEST_ACCESS_DELAY_HOURS
      : 0,
    instantRequestAccess: !ENABLE_STANDARD_REQUEST_ACCESS_DELAY,
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
    description:
      "Hız: anında erişim, sınırsız teklif, akıllı alarmlar, AI asistan ve gelişmiş filtreler.",
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
    description:
      "Tüm profesyonel özellikler: sınırsız teklif, AI, fırsatlar, ekip, envanter, analiz ve otomasyon.",
    monthlyOfferQuota: null,
    requestAccessDelayHours: 0,
    instantRequestAccess: true,
    aiOfferAssistant: true,
    advancedAiPricing: true,
    alertRules: true,
    urgentRequestPriority: true,
    advancedFilters: true,
    hiddenInventory: true,
    priceTry: 2490,
  },
  CORPORATE: {
    id: "CORPORATE",
    label: "Kurumsal",
    badge: "Kurumsal",
    description:
      "Otomasyon ve veri: Profesyonel haklar + 5 ekip koltuğu, gizli envanter, fırsat merkezi, lead dağıtımı.",
    monthlyOfferQuota: null,
    requestAccessDelayHours: 0,
    instantRequestAccess: true,
    aiOfferAssistant: true,
    advancedAiPricing: true,
    alertRules: true,
    urgentRequestPriority: true,
    advancedFilters: true,
    hiddenInventory: true,
    priceTry: 5990,
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
  if (tier === "PREMIUM" || tier === "CORPORATE") {
    return PLAN_DEFINITIONS.PROFESSIONAL;
  }
  return PLAN_DEFINITIONS[tier as PlanTierId] ?? PLAN_DEFINITIONS.STANDARD;
}

export function getAvailablePlans(): PlanDefinition[] {
  return AVAILABLE_PLAN_IDS.map((tier) => PLAN_DEFINITIONS[tier]);
}

export function isPaidPlan(tier: string) {
  return tier !== "STANDARD";
}

const PLAN_TIER_RANK: Record<PlanTierId, number> = {
  STANDARD: 0,
  PREMIUM: 1,
  PROFESSIONAL: 2,
  CORPORATE: 3,
};

/** Compare plan tiers for entitlement precedence (not billing). */
export function planTierRank(tier: PlanTierId): number {
  return PLAN_TIER_RANK[tier] ?? 0;
}

export function hasInstantAccess(tier: string) {
  return getPlanDefinition(tier).instantRequestAccess;
}

/** Legacy display helper when UI still expects a finite number. */
export function legacyQuotaDisplay(limit: number | null): number {
  return limit ?? 9999;
}
