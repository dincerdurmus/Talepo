import type { PlanTierId } from "./plans";

/**
 * Canonical pricing SoT — do not hardcode prices in business logic.
 * PLAN_DEFINITIONS.priceTry must stay mirrored (verified by seat/pricing script).
 * Payment / checkout display mapping reads from here.
 */
export type PlanPricing = {
  tier: PlanTierId;
  priceTry: number | null;
  billingPeriod: "month" | "year" | "custom";
  label: string;
  tagline: string;
};

export const PLAN_PRICING: Record<PlanTierId, PlanPricing> = {
  STANDARD: {
    tier: "STANDARD",
    priceTry: null,
    billingPeriod: "month",
    label: "Bireysel",
    tagline: "Ücretsiz kullanım",
  },
  /**
   * KALDIRILMIŞ PAKET — yalnız legacy depolama değeri (11-DECISION-LOG →
   * Karar D). Etiketi "Profesyonel"di ve satılan Profesyonel 2490 TL iken bu
   * girdi 990 TL taşıyordu: **aynı ad altında iki fiyat**. Bir yüzey yanlış
   * girdiye ulaşsa hangi fiyatı gösterdiği okunamazdı. Etiket artık paketin
   * kaldırıldığını söylüyor; fiyat, mevcut abonelik kayıtlarının okunabilmesi
   * için tarihsel değer olarak duruyor. Yeni satış yolu açılamaz:
   * `getPlanPriceMapping().checkoutAllowed` `AVAILABLE_PLAN_IDS`'e bağlıdır.
   */
  PREMIUM: {
    tier: "PREMIUM",
    priceTry: 990,
    billingPeriod: "month",
    label: "Premium (kaldırıldı)",
    tagline: "Satıştan kaldırıldı — yalnız eski kayıtlar",
  },
  PROFESSIONAL: {
    tier: "PROFESSIONAL",
    priceTry: 2490,
    billingPeriod: "month",
    label: "Profesyonel",
    tagline: "Keşfet, karar ver, ölç",
  },
  /**
   * KALDIRILMIŞ PAKET — PREMIUM ile aynı durumda (Karar D). Etiketi zaten
   * benzersizdi ("Kurumsal"), o yüzden ad çakışması yoktu; yine de satılan bir
   * paket sanılmaması için kaldırıldığı burada yazılı. Firma çalışma alanı
   * artık bir plan değil, eklentidir.
   */
  CORPORATE: {
    tier: "CORPORATE",
    priceTry: 5990,
    billingPeriod: "month",
    label: "Kurumsal (kaldırıldı)",
    tagline: "Satıştan kaldırıldı — firma çalışma alanı artık eklenti",
  },
};

export function getPlanPricing(tier: PlanTierId): PlanPricing {
  return PLAN_PRICING[tier];
}
