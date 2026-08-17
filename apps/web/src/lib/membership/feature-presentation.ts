import type { FeatureKey } from "./entitlements";
export type FeaturePresentation = {
  label: string;
  description: string;
  trustNote?: string;
  contexts: ("PERSONAL" | "WORKSPACE")[];
  interactionType?: "AUTOMATIC_SIGNAL" | "DESTINATION" | "ASSISTED_ACTION" | "ALERT" | "SAVED_CONFIGURATION" | "INFORMATIONAL";
  howItWorks?: string;
  resultLocation?: string;
  emptyStateDescription?: string;
  status?: "LIVE" | "PARTIAL" | "COMING_LATER";
  actionLabel?: string;
};
export const PRO_FEATURE_PRESENTATION: Partial<Record<FeatureKey | "follow_up_intelligence" | "opportunity_intelligence", FeaturePresentation>> = {
  smart_matching: { label: "Akıllı Eşleştirme", description: "Sana uygun talepleri otomatik olarak ayırt etmeye yardımcı olur.", howItWorks: "Talepo mevcut eşleşme sinyallerini yeni fırsatlarla değerlendirir.", resultLocation: "Fırsatlar ekranı", emptyStateDescription: "Şu anda gösterilecek uygun fırsat bulunmuyor.", interactionType: "AUTOMATIC_SIGNAL", status: "LIVE", actionLabel: "Fırsatları gör →", contexts: ["PERSONAL", "WORKSPACE"] },
  hot_opportunities: { label: "Sıcak Fırsatlar", description: "Uygun talepleri eşleşme, aciliyet, tazelik ve güvenilir sinyallere göre önceliklendirir.", contexts: ["PERSONAL", "WORKSPACE"] },
  smart_alerts: { label: "Akıllı Talep Alarmları", description: "Desteklenen kriterlere uygun yeni fırsatları takip etmenize yardımcı olur.", contexts: ["PERSONAL", "WORKSPACE"] },
  saved_searches: { label: "Kayıtlı Aramalar", description: "Sık kullandığınız arama ve filtreleri tekrar oluşturmadan kullanmanızı sağlar.", contexts: ["PERSONAL", "WORKSPACE"] },
  opportunity_intelligence: { label: "Opportunity Intelligence", description: "Fırsatın değerini, risklerini ve sonraki aksiyonunu birlikte değerlendirir.", howItWorks: "Mevcut fırsat sinyallerini açıklanabilir bir değerlendirmede birleştirir.", resultLocation: "Fırsat değerlendirmesi", interactionType: "INFORMATIONAL", status: "LIVE", contexts: ["PERSONAL", "WORKSPACE"] },
  basic_market_insights: { label: "Platform talep özeti", description: "Son 30 günde yayınlanan taleplerin anonim sayısını ve ortalama talep bütçesini gösterir.", howItWorks: "Yayınlanmış talep kayıtlarının toplu özetidir. Piyasa fiyatı veya fiyat trendi üretmez.", resultLocation: "Analiz", interactionType: "INFORMATIONAL", status: "LIVE", contexts: ["PERSONAL", "WORKSPACE"] },
  ai_offer_assistant: { label: "AI Teklif Copilot", description: "Nasıl teklif vermen gerektiğini düzenlenebilir bir taslakla netleştirir.", howItWorks: "Talep, fırsat ve fiyat bağlamını değerlendirerek taslak oluşturur.", resultLocation: "AI asistan", interactionType: "ASSISTED_ACTION", status: "LIVE", actionLabel: "Copilot'u aç →", trustNote: "Teklif sizin onayınız olmadan gönderilmez.", contexts: ["PERSONAL", "WORKSPACE"] },
  follow_up_intelligence: { label: "Follow-up Intelligence", description: "Tekliften sonra ne zaman takip etmenin uygun olduğunu anlamana yardımcı olur.", howItWorks: "Teklif sonrası mevcut durum sinyallerine göre aksiyon önerir.", resultLocation: "Teklif takip akışı", interactionType: "INFORMATIONAL", status: "LIVE", trustNote: "Mesaj sizin onayınız olmadan otomatik gönderilmez.", contexts: ["PERSONAL", "WORKSPACE"] },
  competition_signals: { label: "Rekabet Sinyalleri", description: "Bir fırsatta ne kadar rekabet olduğunu anlamana yardımcı olur.", howItWorks: "Mevcut anonim fırsat ve teklif sinyallerini değerlendirir.", resultLocation: "Fırsat analizi", interactionType: "AUTOMATIC_SIGNAL", status: "LIVE", actionLabel: "Fırsatı gör →", contexts: ["PERSONAL", "WORKSPACE"] },
  hidden_inventory: { label: "Gizli Envanter", description: "Workspace şirketinizin herkese açık olmayan stok bilgisini uygun taleplerle eşleştirmesine yardımcı olur.", contexts: ["WORKSPACE"] },
  team_management: { label: "Ekip Yönetimi", description: "Workspace üyelerini ve mevcut rollerini yönetmenize yardımcı olur.", contexts: ["WORKSPACE"] },
  professional_analytics: { label: "Profesyonel Analitik", description: "Kişisel hesabınızda talep ve teklif performansınızı, firma çalışma alanında şirket teklif özetini gösterir.", contexts: ["PERSONAL", "WORKSPACE"] },
  corporate_intelligence: { label: "Workspace Insights", description: "Mevcut workspace verileri üzerinden talep trendleri ve kategori/şehir dağılımını görmenize yardımcı olur.", contexts: ["WORKSPACE"] },
};
