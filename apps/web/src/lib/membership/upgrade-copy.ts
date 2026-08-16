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
      "Yeni talepler yayınlandığında haberdar olun. Kategori, bölge ve bütçeye göre kurallar tanımlayın.",
    bullets: [
      "Yeni talep yayınlandığında otomatik eşleşme",
      "Birden fazla alarm kuralı",
      "Aktif/pasif yönetimi",
    ],
    cta: "Profesyonel'e geç",
  },
  saved_searches: {
    title: "Kayıtlı aramalar",
    description:
      "Keşif filtrelerinizi kaydedin, tek tıkla tekrar çalıştırın. Kişisel veya firma çalışma alanında ayrı tutulur.",
    bullets: ["Filtre setlerini isimlendirme", "Tek tıkla keşfe dön", "Aktif arama yönetimi"],
    cta: "Profesyonel'e geç",
  },
  smart_matching: {
    title: "Akıllı eşleştirme",
    description:
      "Size en uygun talepleri öne çıkarın. Kategori, bölge ve uzmanlık sinyallerine göre skor.",
    cta: "Profesyonel'e geç",
  },
  advanced_filters: {
    title: "Gelişmiş filtreler",
    description: "Bütçe, aciliyet, yayın tarihi ve kategoriye özel alanlarla doğru taleplere odaklanın.",
    cta: "Profesyonel'e geç",
  },
  hot_opportunities: {
    title: "Fırsatlar merkezi",
    description:
      "Doğru fırsatlara odaklanın. Sıcak talepler ve takip listesi Profesyonel keşif yüzeyinde.",
    bullets: [
      "Sıcak fırsat görünürlüğü",
      "Takip listesi",
      "Keşif workspace",
    ],
    cta: "Profesyonel'e geç",
  },
  professional_analytics: {
    title: "Profesyonel analiz",
    description:
      "Firma çalışma alanında teklif ve eşleşme metriklerini görün. (Kişisel panelde ince yüzey.)",
    cta: "Profesyonel'e geç",
  },
  watchlist: {
    title: "Takip listesi",
    description:
      "İlgilendiğiniz talepleri izleyin. Takip kayıtları firma çalışma alanında tutulur.",
    cta: "Profesyonel'e geç",
  },
  talepo_insights: {
    title: "Talepo Insights",
    description:
      "Anonim piyasa sinyalleri. Tam analitik yüzey firma/Pro bağlamında açılır.",
    cta: "Profesyonel'e geç",
  },
};
