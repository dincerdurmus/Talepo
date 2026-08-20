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
  advanced_filters: {
    label: "Gelişmiş filtreler",
    description:
      "Kategoriye özgü daha ayrıntılı kriterlerle fırsat havuzunu daraltmanızı sağlar.",
    contexts: ["PERSONAL", "WORKSPACE"],
  },
  smart_matching: { label: "Akıllı Eşleştirme", description: "Açık talepleri ilgi alanlarınız ve mevcut kriterlerinizle karşılaştırarak daha uygun fırsatları ayırt etmeye yardımcı olur.", howItWorks: "Talepo mevcut eşleşme sinyallerini yeni fırsatlarla değerlendirir.", resultLocation: "Fırsatlar ekranı", emptyStateDescription: "Şu anda gösterilecek uygun fırsat bulunmuyor.", interactionType: "AUTOMATIC_SIGNAL", status: "LIVE", actionLabel: "Fırsatları gör →", contexts: ["PERSONAL", "WORKSPACE"] },
  hot_opportunities: { label: "Fırsatlar", description: "Kriterlerinize ve ilgi alanlarınıza uygun açık talepleri tek yerde öne çıkarır.", contexts: ["PERSONAL", "WORKSPACE"] },
  smart_alerts: { label: "Anlık bildirimler", description: "Takip kriterlerinize uyan yeni talepler oluştuğunda Talepo içi bildirim almanızı sağlar.", contexts: ["PERSONAL", "WORKSPACE"] },
  saved_searches: { label: "Takiplerim", description: "Kaydettiğiniz kategori ve filtreleri Talepo sizin için izler. Kriterlerinize uygun yeni fırsatları takip etmenizi sağlar.", contexts: ["PERSONAL", "WORKSPACE"] },
  opportunity_intelligence: { label: "Fırsatlar", description: "Kriterlerinize ve ilgi alanlarınıza uygun açık talepleri tek yerde öne çıkarır.", howItWorks: "Kayıtlı takipler ve eşleşme sinyalleri Fırsatlar’da bir araya gelir.", resultLocation: "Fırsatlar", interactionType: "INFORMATIONAL", status: "LIVE", contexts: ["PERSONAL", "WORKSPACE"] },
  basic_market_insights: { label: "Platform talep özeti", description: "Son 30 günde yayınlanan taleplerin anonim sayısını ve ortalama talep bütçesini gösterir.", howItWorks: "Yayınlanmış talep kayıtlarının toplu özetidir. Piyasa fiyatı veya fiyat trendi üretmez.", resultLocation: "Analiz", interactionType: "INFORMATIONAL", status: "LIVE", contexts: ["PERSONAL", "WORKSPACE"] },
  ai_offer_assistant: { label: "Teklif taslağı", description: "Talep metnine göre düzenlenebilir kural tabanlı taslak üretir.", howItWorks: "Kategori ve talep alanlarına göre şablon doldurulur. Harici model veya Price Intelligence kullanılmaz.", resultLocation: "Teklif formu", interactionType: "ASSISTED_ACTION", status: "PARTIAL", trustNote: "Teklif sizin onayınız olmadan gönderilmez.", contexts: ["PERSONAL", "WORKSPACE"] },
  follow_up_intelligence: { label: "Takiplerim", description: "Kaydettiğiniz kategori ve filtreleri Talepo sizin için izler. Kriterlerinize uygun yeni fırsatları takip etmenizi sağlar.", howItWorks: "Takip kriteri ve bildirim birlikte çalışır.", resultLocation: "Takiplerim", interactionType: "ALERT", status: "LIVE", contexts: ["PERSONAL", "WORKSPACE"] },
  competition_signals: { label: "Rekabet Sinyalleri", description: "Bir fırsattaki mevcut rekabet seviyesini gerçek teklif ve fırsat verileri üzerinden daha hızlı değerlendirmenize yardımcı olur.", howItWorks: "Mevcut anonim fırsat ve teklif sinyallerini değerlendirir.", resultLocation: "Fırsat analizi", interactionType: "AUTOMATIC_SIGNAL", status: "LIVE", actionLabel: "Fırsatı gör →", contexts: ["PERSONAL", "WORKSPACE"] },
  hidden_inventory: { label: "Gizli Envanter", description: "Firma çalışma alanına özel ücretli eklenti. Public marketplace listing değildir; Professional üyeliğe otomatik dahil değildir.", contexts: ["WORKSPACE"] },
  team_management: { label: "Ekip Yönetimi", description: "Workspace üyelerini ve mevcut rollerini yönetmenize yardımcı olur.", contexts: ["WORKSPACE"] },
  professional_analytics: { label: "Teklif Zekâsı", description: "Teklif verdiğiniz taleplerde yeterli anonim veri oluştuğunda fiyat dağılımını ve teklifinizin konumunu görmenizi sağlar.", howItWorks: "Kendi teklifiniz gönderildikten ve yeterli anonim örnek oluştuktan sonra min/medyan/ortalama/max gösterilir. Kimlik ve teklif metni yoktur.", resultLocation: "Tekliflerim", emptyStateDescription: "Teklif verdiğiniz bir talepte en az 3 başka uygun teklif oluştuğunda burada fiyat dağılımını ve konumunuzu görebilirsiniz.", interactionType: "INFORMATIONAL", status: "LIVE", contexts: ["PERSONAL", "WORKSPACE"] },
  talepo_radar: { label: "Talepo Radar", description: "Takip alanlarınızın dışında platformda olağan dışı ilgi gören açık talepleri fark etmenizi sağlar.", howItWorks: "Açık taleplerdeki gerçek teklif sayısı ve hızı izlenir. Satış tahmini üretmez.", resultLocation: "Fırsatlar · Talepo Radar", interactionType: "AUTOMATIC_SIGNAL", status: "LIVE", actionLabel: "Radar’ı aç →", contexts: ["PERSONAL", "WORKSPACE"] },
  corporate_intelligence: { label: "Workspace Insights", description: "Mevcut workspace verileri üzerinden talep trendleri ve kategori/şehir dağılımını görmenize yardımcı olur.", contexts: ["WORKSPACE"] },
};
