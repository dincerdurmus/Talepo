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
    "Akıllı talep alarmları",
    "Kategori, bölge ve bütçeye göre takip ve bildirim.",
    "/panel/takiplerim",
  ),
  ai_offer_assistant: base(
    "AI Teklif Copilot",
    "Talebi, fırsat sinyallerini ve fiyat rehberini kullanarak stratejili teklif taslağı hazırlayın.",
    "/panel/asistan",
  ),
  smart_matching: base(
    "Akıllı eşleştirme",
    "Firma profili ile talepler arasında skorlu eşleşme.",
  ),
  saved_searches: base(
    "Kayıtlı aramalar",
    "Keşif filtrelerinizi kaydedin.",
    "/panel/takiplerim",
  ),
  advanced_filters: base(
    "Gelişmiş filtreler",
    "Kategoriye özel keşif filtreleri.",
    "/panel/talepler",
  ),
  basic_market_insights: base(
    "Temel piyasa içgörüleri",
    "Anonim toplu talep istatistikleri.",
  ),
  hot_opportunities: base(
    "Sıcak fırsatlar",
    "Skorlanmış yüksek potansiyelli talepler.",
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
    "Profesyonel analitik",
    "Teklif kabul oranı, yanıt süresi ve eşleşme metrikleri.",
    "/panel/analiz",
  ),
  talepo_insights: base(
    "Talepo Insights",
    "Anonim piyasa verisi — yetersiz veride insufficientData.",
  ),
  team_management: base("Ekip yönetimi", "Davet, rol ve üye yönetimi.", "/panel/ekip"),
  hidden_inventory: base(
    "Gizli envanter",
    "Herkese açık olmayan stok eşleştirmesi.",
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
    "Gelişmiş AI fiyat analizi",
    "Legacy — basic_market_insights ile hizalanır.",
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
  { id: "capture", title: "Fırsatları Yakala", description: "Size uygun talepleri bulun ve önemli fırsatları kaçırmayın.", features: ["smart_matching", "hot_opportunities", "smart_alerts", "saved_searches", "advanced_filters"] as FeatureKey[] },
  { id: "analyze", title: "Fırsatı Analiz Et", description: "Teklif vermeden önce fırsatın değerini, riskini ve piyasa konumunu anlayın.", features: ["advanced_opportunity_analysis", "basic_market_insights", "competition_signals", "talepo_insights"] as FeatureKey[] },
  { id: "offer", title: "Daha Güçlü Teklif Ver", description: "Fırsata uygun fiyat ve stratejiyle daha güçlü teklif hazırlayın.", features: ["ai_offer_assistant", "advanced_ai_pricing"] as FeatureKey[] },
  { id: "follow-up", title: "Satışı Takip Et", description: "Tekliften sonra doğru zamanda doğru aksiyonu alın.", features: [] as FeatureKey[] },
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
  "competition_signals",
  "professional_analytics",
  "hidden_inventory",
  "team_management",
  "automatic_opportunity_hunter",
  "corporate_intelligence",
];
