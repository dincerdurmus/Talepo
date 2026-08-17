import type { LucideIcon } from "lucide-react";
import {
  BellRing,
  Filter,
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

/** Per-feature accent palette — teal / ink neutrals. */
export const FEATURE_VISUALS: Partial<Record<FeatureKey, FeatureVisual>> = {
  instant_request_access: {
    icon: Zap,
    surface: "bg-[#f7faf9]",
    border: "border-teal-900/10",
    glow: "bg-teal-200/25",
    iconWrap: "bg-[#0f766e]",
    iconClass: "text-white",
    linkClass: "text-teal-800 hover:text-teal-950",
    badge: "Aktif",
    badgeClass: "bg-[#e7f7f2] text-teal-800",
    href: "/panel/talepler",
    cta: "Taleplere git →",
  },
  ai_offer_assistant: {
    icon: WandSparkles,
    surface: "bg-white",
    border: "border-teal-900/10",
    glow: "bg-teal-200/20",
    iconWrap: "bg-[#0f1f1d]",
    iconClass: "text-white",
    linkClass: "text-teal-900 hover:text-teal-950",
    href: "/panel/asistan",
    cta: "Asistanı aç →",
  },
  advanced_ai_pricing: {
    icon: LineChart,
    surface: "bg-[#f7faf9]",
    border: "border-teal-900/10",
    glow: "bg-teal-200/20",
    iconWrap: "bg-[#115e59]",
    iconClass: "text-white",
    linkClass: "text-teal-900 hover:text-teal-950",
    href: "/panel/asistan?tab=fiyat",
    cta: "Fiyat analizi →",
  },
  alert_rules: {
    icon: BellRing,
    surface: "bg-white",
    border: "border-teal-900/10",
    glow: "bg-teal-200/15",
    iconWrap: "bg-[#0d9488]",
    iconClass: "text-white",
    linkClass: "text-teal-900 hover:text-teal-950",
    href: "/panel/takiplerim",
    cta: "Kuralları yönet →",
  },
  hidden_inventory: {
    icon: Sparkles,
    surface: "bg-[#eef6f4]",
    border: "border-teal-200/60",
    glow: "bg-teal-300/25",
    iconWrap: "bg-[#0f766e]",
    iconClass: "text-white",
    linkClass: "text-teal-900 hover:text-teal-950",
    href: "/panel/envanter",
    cta: "Envanteri aç →",
  },
  urgent_request_priority: {
    icon: Zap,
    surface: "bg-white",
    border: "border-teal-900/10",
    glow: "bg-teal-200/20",
    iconWrap: "bg-[#134e4a]",
    iconClass: "text-white",
    linkClass: "text-teal-900 hover:text-teal-950",
    badge: "Pro",
    badgeClass: "bg-[#eef6f4] text-teal-800",
    href: "/panel/talepler",
    cta: "Keşfete git →",
  },
  advanced_filters: {
    icon: Filter,
    surface: "bg-[#f7faf9]",
    border: "border-teal-900/10",
    glow: "bg-teal-200/20",
    iconWrap: "bg-[#0f766e]",
    iconClass: "text-white",
    linkClass: "text-teal-900 hover:text-teal-950",
    badge: "Pro",
    badgeClass: "bg-[#eef6f4] text-teal-800",
    href: "/panel/talepler?tab=all",
    cta: "Filtreleri aç →",
  },
};

export function getFeatureVisual(key: FeatureKey): FeatureVisual {
  return (
    FEATURE_VISUALS[key] ?? {
      icon: Sparkles,
      surface: "bg-white",
      border: "border-teal-900/10",
      glow: "bg-teal-200/20",
      iconWrap: "bg-[#0f766e]",
      iconClass: "text-white",
      linkClass: "text-teal-800 hover:text-teal-950",
      cta: "Aç →",
    }
  );
}
