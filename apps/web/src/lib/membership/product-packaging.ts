import type { FeatureKey } from "./entitlements";
import {
  ENABLE_STANDARD_REQUEST_ACCESS_DELAY,
  PLAN_DEFINITIONS,
  type PlanTierId,
} from "./plans";

/**
 * User-facing plan catalog. Only STANDARD and PROFESSIONAL are products.
 * PREMIUM and CORPORATE remain legacy storage/billing values — never public SKUs.
 * Runtime entitlements stay on featuresForPlan(effectivePlanTier).
 */
export const PUBLIC_PLAN_IDS = ["STANDARD", "PROFESSIONAL"] as const;
export type PublicPlanId = (typeof PUBLIC_PLAN_IDS)[number];

export type PublicProduct = PublicPlanId;
export type ProductContext = "PERSONAL" | "WORKSPACE";

export function toPublicPlanId(tier: PlanTierId): PublicPlanId {
  if (tier === "STANDARD") return "STANDARD";
  return "PROFESSIONAL";
}

/** Label for a live account: expired → Standart; stored Premium/Corporate → Profesyonel. */
export function getPublicFacingPlanId(
  _storedPlanTier: PlanTierId,
  effectivePlanTier: PlanTierId,
): PublicPlanId {
  if (effectivePlanTier === "STANDARD") return "STANDARD";
  return toPublicPlanId(effectivePlanTier);
}

export function getPublicFacingPlanLabel(
  storedPlanTier: PlanTierId,
  effectivePlanTier: PlanTierId,
): string {
  return PLAN_DEFINITIONS[getPublicFacingPlanId(storedPlanTier, effectivePlanTier)]
    .label;
}

export function getPublicProduct(
  tier: PlanTierId,
  _context: ProductContext = "PERSONAL",
): PublicProduct {
  return toPublicPlanId(tier);
}

export function getPublicProductLabel(
  tier: PlanTierId,
  _context: ProductContext = "PERSONAL",
) {
  return PLAN_DEFINITIONS[toPublicPlanId(tier)].label;
}

/** Self-serve checkout is Professional only. Corporate is not a purchasable SKU. */
export function isSelfServeCheckoutPlan(tier: PlanTierId): boolean {
  return tier === "PROFESSIONAL";
}

export const PUBLIC_PLAN_TAGLINES: Record<PublicPlanId, string> = {
  STANDARD: "Talepo'yu kullanmaya başla.",
  PROFESSIONAL: "Fırsatı bul. Doğru teklifi ver. Performansını geliştir.",
};

/** Expansion path — not a third plan and not a live add-on checkout claim. */
export const PROFESSIONAL_WORKSPACE_NOTE =
  "Firma çalışma alanında ek ekip koltukları ve ücretli Gizli Envanter ile genişletilebilir.";

export const PUBLIC_PLAN_CARD_FEATURES: Record<PublicPlanId, string[]> = {
  STANDARD: [
    "Talep oluştur",
    "Ayda 5 teklif",
    ENABLE_STANDARD_REQUEST_ACCESS_DELAY
      ? "Yeni taleplere 24 saat gecikmeli erişim"
      : "Talepleri keşfet",
    "Temel Analiz",
  ],
  PROFESSIONAL: [
    "Sınırsız teklif",
    "Takiplerim",
    "Fırsatlar",
    "Talepo Radar",
    "Teklif Zekâsı",
    "Analiz / Platform özeti",
  ],
};

export const PUBLIC_FEATURE_MATRIX = [
  {
    label: "Talep oluşturma",
    standard: "Ücretsiz",
    professional: "Ücretsiz",
  },
  {
    label: "Teklif",
    standard: "Ayda 5",
    professional: "Sınırsız",
  },
  {
    label: "Analiz",
    standard: "Temel kişisel",
    professional: "Temel + platform özeti",
  },
  {
    label: "Takiplerim",
    standard: "—",
    professional: "Dahil",
  },
  {
    label: "Fırsatlar",
    standard: "—",
    professional: "Sana uygun açık talepler",
  },
  {
    label: "Talepo Radar",
    standard: "—",
    professional: "Platform hareketi",
  },
  {
    label: "Teklif Zekâsı",
    standard: "Kilitli önizleme",
    professional: "Anonim aggregate",
  },
] as const;

export const PRO_VALUE_MESSAGES: Partial<Record<FeatureKey, string>> = {
  advanced_opportunity_analysis:
    "Sana uygun açık talepleri Fırsatlar’da yakala.",
  talepo_radar:
    "Takip alanının dışında bile platformda olağan dışı ilgi gören talepleri gör.",
  professional_analytics:
    "Teklif verdikten sonra aynı talebe gelen anonim fiyat dağılımını gör.",
  saved_searches: "İlgilendiğin talepleri kaydet, yeni eşleşmede haberin olsun.",
  smart_alerts: "İlgilendiğin talepleri kaydet, yeni eşleşmede haberin olsun.",
  ai_offer_assistant:
    "Kural tabanlı teklif taslağı — gerçek AI fiyat önerisi değildir.",
  hidden_inventory:
    "Gizli Envanter, firma çalışma alanında ücretli eklentidir. Professional üyeliğe dahil değildir.",
};
