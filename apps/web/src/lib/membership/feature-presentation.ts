import type { FeatureKey } from "./entitlements";
export type FeaturePresentation = { label: string; description: string; trustNote?: string; contexts: ("PERSONAL" | "WORKSPACE")[] };
export const PRO_FEATURE_PRESENTATION: Partial<Record<FeatureKey | "follow_up_intelligence" | "opportunity_intelligence", FeaturePresentation>> = {
  smart_matching: { label: "Akıllı Eşleştirme", description: "Profiliniz ve mevcut eşleşme sinyalleriyle size daha uygun taleplere odaklanmanıza yardımcı olur.", contexts: ["PERSONAL", "WORKSPACE"] },
  hot_opportunities: { label: "Sıcak Fırsatlar", description: "Uygun talepleri eşleşme, aciliyet, tazelik ve güvenilir sinyallere göre önceliklendirir.", contexts: ["PERSONAL", "WORKSPACE"] },
  smart_alerts: { label: "Akıllı Talep Alarmları", description: "Desteklenen kriterlere uygun yeni fırsatları takip etmenize yardımcı olur.", contexts: ["PERSONAL", "WORKSPACE"] },
  saved_searches: { label: "Kayıtlı Aramalar", description: "Sık kullandığınız arama ve filtreleri tekrar oluşturmadan kullanmanızı sağlar.", contexts: ["PERSONAL", "WORKSPACE"] },
  opportunity_intelligence: { label: "Opportunity Intelligence", description: "Fırsatın uygunluk nedenlerini, risklerini, eksik bilgilerini ve sonraki aksiyonunu birlikte değerlendirir.", contexts: ["PERSONAL", "WORKSPACE"] },
  basic_market_insights: { label: "Price Intelligence", description: "Güvenilir fiyat sinyalleriyle piyasa bandını, güven seviyesini, fiyat konumunu ve olağandışı durumları anlamanıza yardımcı olur.", contexts: ["PERSONAL", "WORKSPACE"] },
  ai_offer_assistant: { label: "AI Teklif Copilot", description: "Talep, fırsat, fiyat, risk ve eksik bilgileri değerlendirerek stratejili ve düzenlenebilir bir teklif taslağı oluşturur.", trustNote: "Teklif sizin onayınız olmadan gönderilmez.", contexts: ["PERSONAL", "WORKSPACE"] },
  follow_up_intelligence: { label: "Follow-up Intelligence", description: "Tekliften sonraki sinyallere göre beklemek veya yeniden iletişim kurmak için uygun aksiyonu önerir.", trustNote: "Mesaj sizin onayınız olmadan otomatik gönderilmez.", contexts: ["PERSONAL", "WORKSPACE"] },
  competition_signals: { label: "Rekabet Sinyalleri", description: "Anonim teklif yoğunluğu gibi sinyalleri gösterir; rakip kimliği veya rakip fiyatı göstermez.", contexts: ["PERSONAL", "WORKSPACE"] },
  hidden_inventory: { label: "Gizli Envanter", description: "Workspace şirketinizin herkese açık olmayan stok bilgisini uygun taleplerle eşleştirmesine yardımcı olur.", contexts: ["WORKSPACE"] },
  team_management: { label: "Ekip Yönetimi", description: "Workspace üyelerini ve mevcut rollerini yönetmenize yardımcı olur.", contexts: ["WORKSPACE"] },
  professional_analytics: { label: "Profesyonel Analitik", description: "Mevcut teklif kabul oranı, yanıt süresi ve eşleşme metriklerini izlemenizi sağlar.", contexts: ["PERSONAL", "WORKSPACE"] },
  corporate_intelligence: { label: "Workspace Insights", description: "Mevcut workspace verileri üzerinden talep trendleri ve kategori/şehir dağılımını görmenize yardımcı olur.", contexts: ["WORKSPACE"] },
};
