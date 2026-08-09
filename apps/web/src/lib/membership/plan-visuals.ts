import { Building2, Crown, Sparkles, Zap } from "lucide-react";

import {
  ENABLE_STANDARD_REQUEST_ACCESS_DELAY,
  type PlanTierId,
} from "./plans";

export const PLAN_VISUALS: Record<
  PlanTierId,
  {
    accent: string;
    surface: string;
    glow: string;
    badge: string;
    badgeText: string;
    icon: typeof Crown;
    iconClass: string;
    border: string;
    button: string;
    activeBadge: string;
    highlight?: boolean;
    highlightClass?: string;
    /** When true, card uses light text on a dark surface. */
    dark: boolean;
  }
> = {
  STANDARD: {
    accent: "from-[#f0ebe3] to-[#e4dfd4]",
    surface: "bg-gradient-to-br from-[#faf8f4] to-[#f0ebe3] text-[#1c1917]",
    glow: "bg-[#d6d0c4]/50",
    badge: "bg-[#ebe6dc] text-[#57534e]",
    badgeText: "Ücretsiz başlangıç",
    icon: Sparkles,
    iconClass: "text-[#1c1917]",
    border: "border-[#d6d0c4]/70",
    button: "bg-[#1c1917] text-white hover:bg-black",
    activeBadge: "bg-[#57534e] text-white",
    dark: false,
  },
  PREMIUM: {
    accent: "from-[#f59e0b] to-[#e11d48]",
    surface: "bg-gradient-to-br from-[#fff6ed] to-[#ffe8ef] text-[#1c1917]",
    glow: "bg-[#fb923c]/35",
    badge: "bg-[#ffedd5] text-[#9a3412]",
    badgeText: "En popüler",
    icon: Crown,
    iconClass: "text-white",
    border: "border-[#f59e0b]/30",
    button:
      "bg-gradient-to-r from-[#f59e0b] to-[#e11d48] text-white hover:opacity-90",
    activeBadge: "bg-[#ea580c] text-white",
    highlight: true,
    highlightClass:
      "shadow-[0_24px_80px_rgba(245,158,11,0.18)] ring-1 ring-[#f59e0b]/20",
    dark: false,
  },
  PROFESSIONAL: {
    accent: "from-[#38bdf8] to-[#2563eb]",
    surface: "bg-gradient-to-br from-[#eef8ff] to-[#e0f0ff] text-[#1c1917]",
    glow: "bg-[#7dd3fc]/40",
    badge: "bg-[#dbeafe] text-[#1e40af]",
    badgeText: "Pro",
    icon: Zap,
    iconClass: "text-white",
    border: "border-[#38bdf8]/35",
    button:
      "bg-gradient-to-r from-[#0ea5e9] to-[#2563eb] text-white hover:opacity-90",
    activeBadge: "bg-[#2563eb] text-white",
    dark: false,
  },
  CORPORATE: {
    accent: "from-[#2dd4bf] to-[#0f766e]",
    surface: "bg-gradient-to-br from-[#eefaf7] to-[#ddf5ef] text-[#1c1917]",
    glow: "bg-[#5eead4]/35",
    badge: "bg-[#ccfbf1] text-[#115e59]",
    badgeText: "Kurumsal",
    icon: Building2,
    iconClass: "text-white",
    border: "border-[#14b8a6]/30",
    button:
      "bg-gradient-to-r from-[#14b8a6] to-[#0f766e] text-white hover:opacity-90",
    activeBadge: "bg-[#0f766e] text-white",
    dark: false,
  },
};

export const PLAN_FEATURES: Record<PlanTierId, string[]> = {
  STANDARD: [
    "Ücretsiz talep oluşturma",
    "Ayda 5 teklif hakkı",
    "Temel AI talep oluşturma",
    ENABLE_STANDARD_REQUEST_ACCESS_DELAY
      ? "Yeni taleplere 24 saat gecikmeli erişim"
      : "Yeni taleplere anında erişim (test)",
  ],
  PREMIUM: [
    "Kişisel / tek kullanıcı planı",
    "Sınırsız teklif hakkı",
    "Yeni taleplere anında erişim",
    "AI teklif asistanı",
    "Gelişmiş AI fiyat analizi",
    "Talep bildirim kuralları",
  ],
  PROFESSIONAL: [
    "Firma planı — ekip paylaşımlı",
    "Premium'un tüm avantajları",
    "Acil taleplere öncelikli erişim",
    "Gelişmiş talep filtreleri",
    "Kategori ve bölge takibi",
  ],
  CORPORATE: [
    "Ekip paylaşımlı Kurumsal plan",
    "Profesyonel'in tüm avantajları",
    "Otomatik talep bildirimleri",
    "Kurumsal firma profili",
    "Gizli envanter eşleştirme",
  ],
};

export function getPlanVisual(tier: PlanTierId) {
  return PLAN_VISUALS[tier];
}
