import type { FeatureKey } from "./entitlements";

export type UpgradeCopy = {
  title: string;
  description: string;
  bullets?: string[];
  cta?: string;
};

export const UPGRADE_COPY: Partial<Record<FeatureKey, UpgradeCopy>> = {
  smart_alerts: {
    title: "Akıllı talep alarmları",
    description:
      "Yeni alıcıları aramak yerine Talepo sizi haberdar etsin. Kategori, bölge ve bütçeye göre kurallar tanımlayın.",
    bullets: [
      "Yeni talep yayınlandığında otomatik eşleşme",
      "Birden fazla alarm kuralı",
      "Aktif/pasif yönetimi",
    ],
    cta: "Premium'a geç",
  },
  saved_searches: {
    title: "Kayıtlı aramalar",
    description: "Sürekli aynı filtreleri kurmayın. Keşif filtrelerinizi kaydedin, tek tıkla tekrar çalıştırın.",
    bullets: ["Filtre setlerini isimlendirme", "Tek tıkla keşfe dön", "Aktif arama yönetimi"],
    cta: "Premium'a geç",
  },
  smart_matching: {
    title: "Akıllı eşleştirme",
    description:
      "Firmanıza en uygun talepleri öne çıkarın. Kategori, bölge ve uzmanlık sinyallerine göre skor.",
    cta: "Premium'a geç",
  },
  advanced_filters: {
    title: "Gelişmiş filtreler",
    description: "Bütçe, aciliyet, yayın tarihi ve kategoriye özel alanlarla doğru taleplere odaklanın.",
    cta: "Premium'a geç",
  },
  hot_opportunities: {
    title: "Fırsatlar merkezi",
    description:
      "Her fırsata değil, doğru fırsata teklif verin. Sıcak talepler, rekabet sinyalleri ve takip listesi tek ekranda.",
    bullets: [
      "Sıcak fırsat skoru",
      "Rekabet analizi (anonim)",
      "Takip listesi ve değişiklik uyarıları",
    ],
    cta: "Profesyonel'e geç",
  },
  professional_analytics: {
    title: "Profesyonel analiz",
    description:
      "Teklif performansınızı ölçün: kabul oranı, yanıt süresi ve eşleşme metrikleri.",
    cta: "Profesyonel'e geç",
  },
  watchlist: {
    title: "Takip listesi",
    description: "İlgilendiğiniz talepleri izleyin; bütçe ve acil durum değişikliklerinden haberdar olun.",
    cta: "Profesyonel'e geç",
  },
  talepo_insights: {
    title: "Talepo Insights",
    description: "Anonim piyasa verisiyle kategori ve bölge trendlerini görün.",
    cta: "Profesyonel'e geç",
  },
};
