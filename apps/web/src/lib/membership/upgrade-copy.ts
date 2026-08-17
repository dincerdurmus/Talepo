import type { FeatureKey } from "./entitlements";

export type UpgradeCopy = {
  title: string;
  description: string;
  bullets?: string[];
  cta?: string;
};

export const UPGRADE_COPY: Partial<Record<FeatureKey, UpgradeCopy>> = {
  smart_alerts: {
    title: "Takiplerim",
    description:
      "İlgilendiğiniz talepleri kaydedin. Yeni eşleşmede bildirim alın.",
    bullets: [
      "Takip kriteri (kategori, bölge, bütçe)",
      "Bildirim aç/kapa",
      "Kişisel veya firma çalışma alanı",
    ],
    cta: "Profesyonel'e geç",
  },
  saved_searches: {
    title: "Takiplerim",
    description:
      "İlgilendiğiniz talepleri kaydedin. Yeni eşleşmede bildirim alın.",
    bullets: [
      "Takip kriteri (kategori, bölge, bütçe)",
      "Bildirim aç/kapa",
      "Kişisel veya firma çalışma alanı",
    ],
    cta: "Profesyonel'e geç",
  },
  smart_matching: {
    title: "Fırsatlar",
    description: "Sana uygun açık talepleri yakala.",
    cta: "Profesyonel'e geç",
  },
  advanced_filters: {
    title: "Fırsatlar",
    description: "Doğru taleplere odaklanmak için keşif filtreleri.",
    cta: "Profesyonel'e geç",
  },
  hot_opportunities: {
    title: "Fırsatlar",
    description:
      "Takiplerinize uyan talepleri, Talepo Radar’daki hareketlenen fırsatları ve ticari fırsat havuzunu tek yerde görün.",
    bullets: [
      "Önerilen: Takiplerim kriterlerinizle eşleşen talepler",
      "Talepo Radar: platformda olağan dışı teklif hareketi",
      "Fırsat Havuzu: diğer açık ticari fırsatlar",
    ],
    cta: "Professional ile aç",
  },
  professional_analytics: {
    title: "Teklif Zekâsı",
    description:
      "Teklif verdikten sonra, yeterli anonim veri oluştuğunda aynı talebe gelen tekliflerin fiyat dağılımını gör. Kazanma tahmini yoktur.",
    bullets: [
      "Kendi teklifiniz gönderildikten sonra açılır",
      "En az 3 diğer anonim teklif gerekir",
      "Kimlik, mesaj ve teklif listesi gösterilmez",
    ],
    cta: "Profesyonel ile aç",
  },
  talepo_radar: {
    title: "Talepo Radar",
    description:
      "Platformda olağan dışı ilgi gören talepleri takip alanlarınızın dışında bile keşfedin. Satış tahmini yoktur.",
    bullets: [
      "10 ve üzeri gerçek teklif alan açık talepler",
      "Takiplerinizle sınırlı değildir",
      "Fırsatlar içinde Talepo Radar sekmesi",
    ],
    cta: "Profesyonel'e geç",
  },
  hidden_inventory: {
    title: "Gizli Envanter",
    description:
      "Firma kendi stok kayıtlarını Talepo'ya özel olarak ekler. Public listing değildir. Professional üyeliğe veya çalışma alanı açmaya otomatik dahil değildir.",
    bullets: [
      "Yalnız firma çalışma alanında",
      "Ücretli eklenti olarak açılır",
      "Self-serve satın alma henüz yok",
    ],
    cta: "Firma çalışma alanına git",
  },
  watchlist: {
    title: "Fırsatlar",
    description: "İlgilendiğiniz talepleri izleyin.",
    cta: "Profesyonel'e geç",
  },
  talepo_insights: {
    title: "Platform özeti",
    description:
      "Yayınlanan taleplerin anonim sayısı ve ortalama talep bütçesi Analiz’de açılır.",
    cta: "Profesyonel'e geç",
  },
};
