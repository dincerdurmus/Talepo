import type { LucideIcon } from "lucide-react";
import {
  BarChart3,
  Bell,
  Bookmark,
  Boxes,
  Crown,
  FileText,
  Flame,
  Home,
  Inbox,
  LayoutDashboard,
  MessageCircle,
  Search,
  UserRound,
  Users,
} from "lucide-react";

import type { FeatureKey } from "@/lib/membership/entitlements";

export type PanelNavItem = {
  href: string;
  icon: LucideIcon;
  label: string;
  mobileLabel?: string;
  exact?: boolean;
  /** If set, item is shown only when the feature entitlement is true. */
  requiresFeature?: FeatureKey;
  /** If set, item is shown when any listed feature is entitled. */
  requiresAnyFeature?: FeatureKey[];
  /** Hide when this feature is entitled (plan differentiation). */
  hideIfFeature?: FeatureKey;
  /** Restrict item to a workspace mode. Default: both. */
  workspace?: "personal" | "corporate" | "both";
};

export const PANEL_NAV_ITEMS: PanelNavItem[] = [
  {
    href: "/",
    icon: Home,
    label: "Ana sayfa",
    exact: true,
  },
  {
    href: "/panel",
    icon: LayoutDashboard,
    label: "Sayfam",
    exact: true,
  },
  {
    href: "/panel/taleplerim",
    icon: FileText,
    label: "Taleplerim",
    workspace: "personal",
  },
  {
    href: "/panel/gelen-teklifler",
    icon: Inbox,
    label: "Gelen teklifler",
    mobileLabel: "Gelen",
    workspace: "personal",
  },
  {
    href: "/panel/talepler",
    icon: Search,
    label: "Talepleri keşfet",
    mobileLabel: "Talepler",
  },
  {
    href: "/panel/teklifler",
    icon: FileText,
    label: "Tekliflerim",
    mobileLabel: "Teklifler",
    requiresFeature: "submit_offer",
  },
  // Teklif taslağı remains a contextual capability (offer form / deep-link
  // /panel/asistan). It is not a primary sidebar destination.
  {
    href: "/panel/takiplerim",
    icon: Bookmark,
    label: "Takiplerim",
    mobileLabel: "Takip",
    requiresAnyFeature: ["saved_searches", "smart_alerts"],
  },
  {
    href: "/panel/firsatlar?view=ops",
    icon: Flame,
    label: "Opportunity Center",
    mobileLabel: "Ops",
    workspace: "corporate",
    requiresFeature: "lead_distribution",
  },
  {
    href: "/panel/firsatlar",
    icon: Flame,
    label: "Fırsatlar",
    requiresFeature: "hot_opportunities",
    // Corporate sees Opportunity Center instead of duplicate Fırsatlar entry.
    hideIfFeature: "lead_distribution",
  },
  {
    href: "/panel/analiz",
    icon: BarChart3,
    label: "Analiz",
  },
  {
    href: "/panel/envanter",
    icon: Boxes,
    label: "Gizli envanter",
    mobileLabel: "Envanter",
    // Always visible in company workspace; page/API gate as paid add-on.
    workspace: "corporate",
  },
  {
    href: "/panel/ekip",
    icon: Users,
    label: "Ekip",
    workspace: "corporate",
    requiresFeature: "team_management",
  },
  { href: "/panel/plan", icon: Crown, label: "Plan" },
  { href: "/panel/mesajlar", icon: MessageCircle, label: "Mesajlar" },
  {
    href: "/panel/profil",
    icon: UserRound,
    label: "Profil",
    workspace: "personal",
  },
];

export const PANEL_NOTIFICATIONS_HREF = "/panel/bildirimler";
export { Bell };

export function filterPanelNavItems(
  items: PanelNavItem[],
  features?: Partial<Record<FeatureKey, boolean>>,
  workspace: "personal" | "corporate" = "personal",
) {
  const seen = new Set<string>();

  return items.filter((item) => {
    const scope = item.workspace ?? "both";
    if (scope !== "both" && scope !== workspace) return false;
    if (item.requiresFeature && features?.[item.requiresFeature] !== true) {
      return false;
    }
    if (item.requiresAnyFeature && item.requiresAnyFeature.length > 0) {
      const any = item.requiresAnyFeature.some(
        (key) => features?.[key] === true,
      );
      if (!any) return false;
    }
    if (item.hideIfFeature && features?.[item.hideIfFeature] === true) {
      return false;
    }

    // Prefer first matching label per href within a workspace
    const key = `${item.href}:${item.label}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}
