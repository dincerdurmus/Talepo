import type { FeatureKey } from "./entitlements";

export const FEATURE_META: Record<
  FeatureKey,
  { label: string; description: string; surface?: string }
> = {
  submit_offer: {
    label: "Teklif gönderme",
    description: "Açık taleplere teklif verebilirsiniz.",
  },
  instant_request_access: {
    label: "Anında talep erişimi",
    description: "Yeni talepleri 24 saat beklemeden görün.",
    surface: "/panel/talepler",
  },
  ai_offer_assistant: {
    label: "AI teklif asistanı",
    description: "Teklif taslağı ve fiyat önerisi için AI desteği.",
    surface: "/panel/asistan",
  },
  advanced_ai_pricing: {
    label: "Gelişmiş AI fiyat analizi",
    description: "Kategori ve bölge bazlı fiyat aralığı analizi.",
    surface: "/panel/asistan?tab=fiyat",
  },
  alert_rules: {
    label: "Talep bildirim kuralları",
    description: "Kategori, bölge ve bütçeye göre otomatik uyarılar.",
    surface: "/panel/uyarilar",
  },
  hidden_inventory: {
    label: "Gizli envanter eşleştirme",
    description:
      "Firma içi stok listesi; dışarıya açık değil. Uygun taleplerde eşleşme için kullanılır.",
    surface: "/panel/envanter",
  },
  urgent_request_priority: {
    label: "Acil talep önceliği",
    description: "Acil talepler keşif listesinde en üste alınır.",
    surface: "/panel/talepler",
  },
  advanced_filters: {
    label: "Gelişmiş filtreler",
    description: "Keşif ve eşleştirmede gelişmiş filtre seti.",
    surface: "/panel/talepler?tab=all",
  },
  feature_request_boost: {
    label: "Talep öne çıkarma",
    description:
      "Talebinizi keşifte öne çıkarın. Ödeme altyapısı bağlanınca ücretli olarak açılacak.",
  },
};

/** Features shown on the plan entitlement summary (user-facing). */
export const PLAN_SUMMARY_FEATURE_KEYS: FeatureKey[] = [
  "instant_request_access",
  "ai_offer_assistant",
  "advanced_ai_pricing",
  "alert_rules",
  "urgent_request_priority",
  "advanced_filters",
  "hidden_inventory",
];
