import type { LucideIcon } from "lucide-react";
import {
  BellRing,
  LineChart,
  Sparkles,
  WandSparkles,
  Zap,
} from "lucide-react";

import type { FeatureKey } from "./entitlements";

export type FeatureVisual = {
  icon: LucideIcon;
  surface: string;
  border: string;
  glow: string;
  iconWrap: string;
  iconClass: string;
  linkClass: string;
  badge?: string;
  badgeClass?: string;
  /** Override default surface from feature-meta */
  href?: string;
  cta?: string;
};

/** Per-feature accent palette (teal / amber / sky — no purple). */
export const FEATURE_VISUALS: Partial<Record<FeatureKey, FeatureVisual>> = {
  instant_request_access: {
    icon: Zap,
    surface: "bg-gradient-to-br from-[#ecfdf5] via-[#f0fdf4] to-[#e0f2fe]",
    border: "border-emerald-200/70",
    glow: "bg-emerald-300/35",
    iconWrap: "bg-gradient-to-br from-emerald-500 to-teal-600",
    iconClass: "text-white",
    linkClass: "text-emerald-800 hover:text-emerald-950",
    badge: "Aktif",
    badgeClass: "bg-emerald-100 text-emerald-800",
    href: "/panel/talepler",
    cta: "Taleplere git →",
  },
  ai_offer_assistant: {
    icon: WandSparkles,
    surface: "bg-gradient-to-br from-[#fffbeb] via-[#fff7ed] to-[#fef3c7]",
    border: "border-amber-200/70",
    glow: "bg-amber-300/30",
    iconWrap: "bg-gradient-to-br from-amber-500 to-orange-600",
    iconClass: "text-white",
    linkClass: "text-amber-900 hover:text-amber-950",
    href: "/panel/asistan",
    cta: "Asistanı aç →",
  },
  advanced_ai_pricing: {
    icon: LineChart,
    surface: "bg-gradient-to-br from-[#e0f2fe] via-[#f0f9ff] to-[#ecfeff]",
    border: "border-sky-200/70",
    glow: "bg-sky-300/35",
    iconWrap: "bg-gradient-to-br from-sky-500 to-cyan-600",
    iconClass: "text-white",
    linkClass: "text-sky-900 hover:text-sky-950",
    href: "/panel/asistan?tab=fiyat",
    cta: "Fiyat analizi →",
  },
  alert_rules: {
    icon: BellRing,
    surface: "bg-gradient-to-br from-[#fef3c7] via-[#fff7ed] to-[#fce7f3]",
    border: "border-amber-200/60",
    glow: "bg-orange-200/35",
    iconWrap: "bg-gradient-to-br from-orange-500 to-rose-500",
    iconClass: "text-white",
    linkClass: "text-orange-900 hover:text-orange-950",
    href: "/panel/uyarilar",
    cta: "Kuralları yönet →",
  },
  hidden_inventory: {
    icon: Sparkles,
    surface: "bg-gradient-to-br from-[#eefaf7] to-[#ddf5ef]",
    border: "border-teal-200/60",
    glow: "bg-teal-300/30",
    iconWrap: "bg-gradient-to-br from-teal-500 to-emerald-700",
    iconClass: "text-white",
    linkClass: "text-teal-900 hover:text-teal-950",
    href: "/panel/envanter",
    cta: "Envanteri aç →",
  },
};

export function getFeatureVisual(key: FeatureKey): FeatureVisual {
  return (
    FEATURE_VISUALS[key] ?? {
      icon: Sparkles,
      surface: "bg-gradient-to-br from-[#f0f9ff] to-[#fafaf8]",
      border: "border-black/[0.06]",
      glow: "bg-teal-200/25",
      iconWrap: "bg-gradient-to-br from-teal-600 to-teal-800",
      iconClass: "text-white",
      linkClass: "text-teal-800 hover:text-teal-950",
      cta: "Aç →",
    }
  );
}
