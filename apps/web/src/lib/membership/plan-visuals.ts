import type { CSSProperties } from "react";
import { Building2, Crown, Sparkles, Zap } from "lucide-react";

import {
  ENABLE_STANDARD_REQUEST_ACCESS_DELAY,
  type PlanTierId,
} from "./plans";

/** CSS custom properties applied to panel chrome for the active plan. */
export type PlanThemeTokens = {
  primary: string;
  primaryHover: string;
  primarySoft: string;
  accent: string;
  ring: string;
  glow: string;
  sidebarGlow: string;
  onPrimary: string;
};

/**
 * Marketplace-tier palette (Armut logic, Sahibinden/Trendyol clarity):
 * - STANDARD: soft gray-green
 * - PREMIUM: warm amber / coral “featured”
 * - PROFESSIONAL: strong blue-teal pro tools
 * - CORPORATE: deep ink/slate with teal accent
 */
export const PLAN_THEME_TOKENS: Record<PlanTierId, PlanThemeTokens> = {
  STANDARD: {
    primary: "#3f5c57",
    primaryHover: "#2f4743",
    primarySoft: "#eef4f3",
    accent: "#5a7a74",
    ring: "rgba(63, 92, 87, 0.28)",
    glow: "rgba(63, 92, 87, 0.14)",
    sidebarGlow: "rgba(90, 122, 116, 0.22)",
    onPrimary: "#ffffff",
  },
  PREMIUM: {
    primary: "#ea580c",
    primaryHover: "#c2410c",
    primarySoft: "#fff7ed",
    accent: "#f59e0b",
    ring: "rgba(234, 88, 12, 0.3)",
    glow: "rgba(245, 158, 11, 0.2)",
    sidebarGlow: "rgba(251, 146, 60, 0.28)",
    onPrimary: "#ffffff",
  },
  PROFESSIONAL: {
    primary: "#0e7490",
    primaryHover: "#155e75",
    primarySoft: "#ecfeff",
    accent: "#0d9488",
    ring: "rgba(14, 116, 144, 0.3)",
    glow: "rgba(14, 116, 144, 0.18)",
    sidebarGlow: "rgba(34, 211, 238, 0.22)",
    onPrimary: "#ffffff",
  },
  CORPORATE: {
    primary: "#1e293b",
    primaryHover: "#0f172a",
    primarySoft: "#f1f5f9",
    accent: "#0d9488",
    ring: "rgba(15, 118, 110, 0.28)",
    glow: "rgba(15, 118, 110, 0.16)",
    sidebarGlow: "rgba(45, 212, 191, 0.2)",
    onPrimary: "#ffffff",
  },
};

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
    /** Panel Özet greeting hero (full card gradient). */
    heroBanner: {
      section: string;
      glowPrimary: string;
      glowSecondary: string;
      glowTertiary: string;
      eyebrow: string;
      subtitle: string;
    };
  }
> = {
  STANDARD: {
    accent: "from-[#e7f0ee] to-[#d8e6e3]",
    surface: "bg-gradient-to-br from-[#f7faf9] to-[#eef4f3] text-[#0f1f1d]",
    glow: "bg-[#b8cdc7]/40",
    badge: "bg-[#eef4f3] text-[#3f5c57]",
    badgeText: "Ücretsiz başlangıç",
    icon: Sparkles,
    iconClass: "text-[#0f1f1d]",
    border: "border-[#3f5c57]/12",
    button: "bg-[#3f5c57] text-white hover:bg-[#2f4743]",
    activeBadge: "bg-[#3f5c57] text-white",
    dark: false,
    heroBanner: {
      section:
        "relative overflow-hidden rounded-2xl border border-[#3f5c57]/15 bg-gradient-to-br from-[#5a7a74] via-[#3f5c57] to-[#2f4743] text-white shadow-[0_20px_60px_rgba(63,92,87,0.18)]",
      glowPrimary:
        "pointer-events-none absolute -right-20 -top-24 h-72 w-72 rounded-full bg-[#b8cdc7]/25 blur-[80px]",
      glowSecondary:
        "pointer-events-none absolute -bottom-28 left-1/4 h-64 w-64 rounded-full bg-emerald-200/12 blur-[80px]",
      glowTertiary:
        "pointer-events-none absolute right-1/3 top-1/2 h-40 w-40 rounded-full bg-white/5 blur-[60px]",
      eyebrow:
        "inline-flex items-center rounded-full border border-white/15 bg-white/10 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.16em] text-white/90",
      subtitle: "text-white/75",
    },
  },
  PREMIUM: {
    accent: "from-[#f59e0b] to-[#ea580c]",
    surface: "bg-gradient-to-br from-[#fff8ed] to-[#ffedd5] text-[#1c1917]",
    glow: "bg-[#fb923c]/35",
    badge: "bg-[#ffedd5] text-[#9a3412]",
    badgeText: "En popüler",
    icon: Crown,
    iconClass: "text-white",
    border: "border-[#f59e0b]/30",
    button:
      "bg-gradient-to-r from-[#f59e0b] to-[#ea580c] text-white hover:opacity-95",
    activeBadge: "bg-[#ea580c] text-white",
    highlight: true,
    highlightClass:
      "shadow-[0_24px_80px_rgba(245,158,11,0.18)] ring-1 ring-[#f59e0b]/20",
    dark: false,
    heroBanner: {
      section:
        "relative overflow-hidden rounded-2xl border border-[#ea580c]/25 bg-gradient-to-br from-[#f59e0b] via-[#ea580c] to-[#9a3412] text-white shadow-[0_20px_60px_rgba(234,88,12,0.24)]",
      glowPrimary:
        "pointer-events-none absolute -right-20 -top-24 h-72 w-72 rounded-full bg-[#fbbf24]/30 blur-[80px]",
      glowSecondary:
        "pointer-events-none absolute -bottom-28 left-1/4 h-64 w-64 rounded-full bg-[#fb7185]/18 blur-[80px]",
      glowTertiary:
        "pointer-events-none absolute right-1/3 top-1/2 h-40 w-40 rounded-full bg-white/10 blur-[60px]",
      eyebrow:
        "inline-flex items-center rounded-full border border-white/25 bg-white/15 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.16em] text-white/95",
      subtitle: "text-white/85",
    },
  },
  PROFESSIONAL: {
    accent: "from-[#14b8a6] to-[#0284c7]",
    surface: "bg-gradient-to-br from-[#ecfeff] to-[#e0f2fe] text-[#0f172a]",
    glow: "bg-[#67e8f9]/40",
    badge: "bg-[#cffafe] text-[#155e75]",
    badgeText: "Pro",
    icon: Zap,
    iconClass: "text-white",
    border: "border-[#0e7490]/25",
    button:
      "bg-gradient-to-r from-[#0d9488] to-[#0284c7] text-white hover:opacity-95",
    activeBadge: "bg-[#0e7490] text-white",
    dark: false,
    heroBanner: {
      section:
        "relative overflow-hidden rounded-2xl border border-[#0e7490]/25 bg-gradient-to-br from-[#0d9488] via-[#0e7490] to-[#075985] text-white shadow-[0_20px_60px_rgba(14,116,144,0.24)]",
      glowPrimary:
        "pointer-events-none absolute -right-20 -top-24 h-72 w-72 rounded-full bg-[#67e8f9]/28 blur-[80px]",
      glowSecondary:
        "pointer-events-none absolute -bottom-28 left-1/4 h-64 w-64 rounded-full bg-[#38bdf8]/18 blur-[80px]",
      glowTertiary:
        "pointer-events-none absolute right-1/3 top-1/2 h-40 w-40 rounded-full bg-white/8 blur-[60px]",
      eyebrow:
        "inline-flex items-center rounded-full border border-white/20 bg-white/12 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.16em] text-white/90",
      subtitle: "text-white/80",
    },
  },
  CORPORATE: {
    accent: "from-[#1e293b] to-[#0f766e]",
    surface: "bg-gradient-to-br from-[#f8fafc] to-[#e2e8f0] text-[#0f172a]",
    glow: "bg-[#94a3b8]/35",
    badge: "bg-[#e2e8f0] text-[#0f172a]",
    badgeText: "Kurumsal",
    icon: Building2,
    iconClass: "text-white",
    border: "border-[#1e293b]/18",
    button:
      "bg-gradient-to-r from-[#1e293b] to-[#0f766e] text-white hover:opacity-95",
    activeBadge: "bg-[#1e293b] text-white",
    dark: false,
    heroBanner: {
      section:
        "relative overflow-hidden rounded-2xl border border-[#1e293b]/25 bg-gradient-to-br from-[#1e293b] via-[#134e4a] to-[#0f766e] text-white shadow-[0_20px_60px_rgba(15,23,42,0.28)]",
      glowPrimary:
        "pointer-events-none absolute -right-20 -top-24 h-72 w-72 rounded-full bg-[#2dd4bf]/20 blur-[80px]",
      glowSecondary:
        "pointer-events-none absolute -bottom-28 left-1/4 h-64 w-64 rounded-full bg-[#64748b]/25 blur-[80px]",
      glowTertiary:
        "pointer-events-none absolute right-1/3 top-1/2 h-40 w-40 rounded-full bg-white/6 blur-[60px]",
      eyebrow:
        "inline-flex items-center rounded-full border border-white/20 bg-white/10 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.16em] text-white/90",
      subtitle: "text-white/80",
    },
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

export function getPlanHeroBanner(tier: PlanTierId) {
  return PLAN_VISUALS[tier].heroBanner;
}

export function getPlanThemeTokens(tier: PlanTierId) {
  return PLAN_THEME_TOKENS[tier];
}

/** Inline style map for `--plan-*` CSS variables on panel shell. */
export function getPlanThemeStyle(tier: PlanTierId): CSSProperties {
  const t = PLAN_THEME_TOKENS[tier];
  return {
    "--plan-primary": t.primary,
    "--plan-primary-hover": t.primaryHover,
    "--plan-primary-soft": t.primarySoft,
    "--plan-accent": t.accent,
    "--plan-ring": t.ring,
    "--plan-glow": t.glow,
    "--plan-sidebar-glow": t.sidebarGlow,
    "--plan-on-primary": t.onPrimary,
  } as CSSProperties;
}
