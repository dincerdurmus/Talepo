import type { FeatureKey } from "./entitlements";

const base = (
  label: string,
  description: string,
  surface?: string,
) => ({ label, description, surface });

export const FEATURE_META: Record<
  FeatureKey,
  { label: string; description: string; surface?: string }
> = {
  submit_offer: base("Teklif gönderme", "Açık taleplere teklif verebilirsiniz."),
  instant_request_access: base(
    "Anında talep erişimi",
    "Yeni talepleri 24 saat beklemeden görün.",
    "/panel/talepler",
  ),
  unlimited_offers: base("Sınırsız teklif", "Aylık teklif kotası olmadan teklif verin."),
  smart_alerts: base(
    "Takiplerim",
    "Kategori, bölge ve bütçeye göre takip ve bildirim.",
    "/panel/takiplerim",
  ),
  ai_offer_assistant: base(
    "Teklif taslağı",
    "Talep metnine göre kural tabanlı taslak. Gerçek AI veya Price Intelligence değildir.",
    "/panel/asistan",
  ),
  smart_matching: base(
    "Akıllı eşleştirme",
    "Firma profili ile talepler arasında skorlu eşleşme.",
  ),
  saved_searches: base(
    "Takiplerim",
    "Takip kriterlerinizi kaydedin; yeni eşleşmede bildirim alın.",
    "/panel/takiplerim",
  ),
  advanced_filters: base(
    "Gelişmiş filtreler",
    "Kategoriye özel keşif filtreleri.",
    "/panel/talepler",
  ),
  basic_market_insights: base(
    "Platform talep özeti",
    "Anonim yayınlanan talep sayısı ve ortalama talep bütçesi. Piyasa fiyatı değildir.",
    "/panel/analiz",
  ),
  hot_opportunities: base(
    "Fırsatlar",
    "Sana uygun açık talepleri yakala.",
    "/panel/firsatlar",
  ),
  high_budget_opportunities: base(
    "Yüksek bütçe fırsatları",
    "Bütçe sinyali güçlü talepler (UNKNOWN when no data).",
  ),
  advanced_opportunity_analysis: base(
    "Gelişmiş fırsat analizi",
    "Çok boyutlu fırsat skorlaması.",
  ),
  competition_signals: base(
    "Rekabet sinyalleri",
    "Anonim teklif yoğunluğu — rakip fiyatları asla gösterilmez.",
  ),
  budget_change_alerts: base(
    "Bütçe değişikliği takibi",
    "Watchlist taleplerinde bütçe/acil değişim kaydı.",
  ),
  watchlist: base("Takip listesi", "Talepleri izleme listesine alın."),
  professional_analytics: base(
    "Teklif Zekâsı",
    "Teklif verdiğiniz taleplerde anonim fiyat dağılımı ve kendi konumunuz. Temel Analiz tüm planlarda açıktır.",
    "/panel/talepler",
  ),
  talepo_radar: base(
    "Talepo Radar",
    "Platformda olağan dışı ilgi gören talepleri takip alanlarınızın dışında bile keşfedin.",
    "/panel/firsatlar?view=radar",
  ),
  talepo_insights: base(
    "Talepo Insights",
    "Anonim piyasa verisi — yetersiz veride insufficientData.",
  ),
  team_management: base("Ekip yönetimi", "Davet, rol ve üye yönetimi.", "/panel/ekip"),
  hidden_inventory: base(
    "Gizli envanter",
    "Firma çalışma alanında ücretli eklenti. Professional üyeliğe otomatik dahil değildir.",
    "/panel/envanter",
  ),
  automatic_opportunity_hunter: base(
    "Otomatik fırsat avcısı",
    "Yayınlanan talepler envanter ve kurallarla taranır.",
  ),
  inventory_import: base("Envanter içe aktarma", "CSV ile toplu envanter yükleme."),
  lead_distribution: base("Lead dağıtımı", "Fırsatları ekip üyelerine atama."),
  corporate_intelligence: base(
    "Kurumsal istihbarat",
    "Talep trendleri ve kategori/şehir dağılımı.",
  ),
  erp_integration: base(
    "ERP entegrasyonu",
    "Adapter arayüzü hazır — gerçek entegrasyon sonraki faz.",
  ),
  alert_rules: base(
    "Talep bildirim kuralları",
    "smart_alerts ile aynı (legacy key).",
    "/panel/takiplerim",
  ),
  advanced_ai_pricing: base(
    "Kategori fiyat bandı",
    "Kategori katsayılarına dayalı taslak bant. Price Intelligence veya piyasa fiyatı değildir.",
    "/panel/asistan",
  ),
  urgent_request_priority: base(
    "Acil talep önceliği",
    "Legacy — hot_opportunities ile hizalanır.",
  ),
  feature_request_boost: base(
    "Talep öne çıkarma",
    "Alıcı tarafı boost — ödeme altyapısı sonraki faz.",
  ),
};

export const PRO_VALUE_PILLARS = [
  {
    id: "capture",
    title: "Keşfet",
    description:
      "Sana uygun açık talepleri ve platformda olağan dışı hareketi yakala.",
    features: [
      "talepo_radar",
      "hot_opportunities",
      "saved_searches",
      "smart_alerts",
      "smart_matching",
      "advanced_filters",
    ] as FeatureKey[],
  },
  {
    id: "analyze",
    title: "Karar ver",
    description:
      "Teklif verdikten sonra aynı talebe gelen anonim fiyat dağılımını gör.",
    features: ["professional_analytics", "competition_signals"] as FeatureKey[],
  },
  {
    id: "offer",
    title: "Ölç / geliştir",
    description:
      "Kendi performansını ve platform talep özetini Analiz’de takip et.",
    features: ["basic_market_insights"] as FeatureKey[],
  },
  {
    id: "follow-up",
    title: "Takip et",
    description: "Kriterlerini kaydet; yeni eşleşmede bildirim al.",
    features: ["watchlist", "budget_change_alerts"] as FeatureKey[],
  },
] as const;

/** Features shown on the plan entitlement summary (user-facing). */
export const PLAN_SUMMARY_FEATURE_KEYS: FeatureKey[] = [
  "instant_request_access",
  "unlimited_offers",
  "smart_alerts",
  "ai_offer_assistant",
  "smart_matching",
  "saved_searches",
  "advanced_filters",
  "hot_opportunities",
  "talepo_radar",
  "competition_signals",
  "professional_analytics",
  "hidden_inventory",
  "team_management",
  "automatic_opportunity_hunter",
  "corporate_intelligence",
];
