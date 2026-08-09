import { Building2, Crown, Sparkles, Zap } from "lucide-react";

import type { PlanTierId } from "./plans";

export const PLAN_VISUALS: Record<
  PlanTierId,
  {
    accent: string;
    glow: string;
    badge: string;
    badgeText: string;
    icon: typeof Crown;
    border: string;
    button: string;
    activeBadge: string;
    highlight?: boolean;
    dark: boolean;
  }
> = {
  STANDARD: {
    accent: "from-[#f4f4f0] to-[#e8e8e2]",
    glow: "bg-[#d8d8d0]/40",
    badge: "bg-[#ecece7] text-[#5a5a52]",
    badgeText: "Ücretsiz başlangıç",
    icon: Sparkles,
    border: "border-black/[0.08]",
    button: "bg-[#151515] text-white hover:bg-black",
    activeBadge: "bg-[#5a5a52] text-white",
    dark: false,
  },
  PREMIUM: {
    accent: "from-[#7c5cff] to-[#5b3fd4]",
    glow: "bg-[#9b7bff]/35",
    badge: "bg-white/20 text-white",
    badgeText: "En popüler",
    icon: Crown,
    border: "border-[#7c5cff]/30",
    button:
      "bg-gradient-to-r from-[#7c5cff] to-[#5b3fd4] text-white hover:opacity-90",
    activeBadge: "bg-[#7c5cff] text-white",
    highlight: true,
    dark: true,
  },
  PROFESSIONAL: {
    accent: "from-[#2563eb] to-[#1d4ed8]",
    glow: "bg-[#60a5fa]/30",
    badge: "bg-white/20 text-white",
    badgeText: "Pro",
    icon: Zap,
    border: "border-[#2563eb]/25",
    button:
      "bg-gradient-to-r from-[#2563eb] to-[#1d4ed8] text-white hover:opacity-90",
    activeBadge: "bg-[#2563eb] text-white",
    dark: true,
  },
  CORPORATE: {
    accent: "from-[#0f766e] to-[#115e59]",
    glow: "bg-[#2dd4bf]/25",
    badge: "bg-white/20 text-white",
    badgeText: "Kurumsal",
    icon: Building2,
    border: "border-[#0f766e]/25",
    button:
      "bg-gradient-to-r from-[#0f766e] to-[#115e59] text-white hover:opacity-90",
    activeBadge: "bg-[#0f766e] text-white",
    dark: true,
  },
};

export const PLAN_FEATURES: Record<PlanTierId, string[]> = {
  STANDARD: [
    "Ücretsiz talep oluşturma",
    "Ayda 5 teklif hakkı",
    "Temel AI talep oluşturma",
    "Yeni taleplere 24 saat gecikmeli erişim",
  ],
  PREMIUM: [
    "Sınırsız teklif hakkı",
    "Yeni taleplere anında erişim",
    "AI teklif asistanı",
    "Gelişmiş talep filtreleri",
    "Premium rozet",
  ],
  PROFESSIONAL: [
    "Premium'un tüm avantajları",
    "Acil taleplere öncelikli erişim",
    "Gelişmiş AI fiyat analizi",
    "Detaylı performans istatistikleri",
    "Kategori ve bölge takibi",
  ],
  CORPORATE: [
    "Profesyonel'in tüm avantajları",
    "Otomatik talep bildirimleri",
    "Çoklu kategori/ürün takibi",
    "Kurumsal firma profili",
    "Gizli envanter eşleştirme",
  ],
};

export function getPlanVisual(tier: PlanTierId) {
  return PLAN_VISUALS[tier];
}
