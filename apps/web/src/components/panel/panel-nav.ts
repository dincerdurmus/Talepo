import type { LucideIcon } from "lucide-react";
import {
  Bell,
  BellRing,
  Boxes,
  Crown,
  FileText,
  Home,
  LayoutDashboard,
  MessageCircle,
  Search,
  UserRound,
  Users,
  WandSparkles,
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
    label: "Özet",
    exact: true,
  },
  {
    href: "/panel/taleplerim",
    icon: FileText,
    label: "Taleplerim",
    workspace: "personal",
  },
  {
    href: "/panel/talepler",
    icon: Search,
    label: "Talepleri keşfet",
    mobileLabel: "Keşfet",
  },
  {
    href: "/panel/teklifler",
    icon: FileText,
    label: "Tekliflerimiz",
    workspace: "corporate",
  },
  {
    href: "/panel/asistan",
    icon: WandSparkles,
    label: "AI asistan",
    mobileLabel: "AI",
    requiresFeature: "ai_offer_assistant",
  },
  {
    href: "/panel/uyarilar",
    icon: BellRing,
    label: "Uyarı kuralları",
    mobileLabel: "Uyarı",
    requiresFeature: "alert_rules",
  },
  {
    href: "/panel/envanter",
    icon: Boxes,
    label: "Gizli envanter",
    mobileLabel: "Envanter",
    // Always visible in corporate; page/API gate with hidden_inventory upsell.
    workspace: "corporate",
  },
  {
    href: "/panel/ekip",
    icon: Users,
    label: "Ekip",
    workspace: "corporate",
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

    // Prefer first matching label per href within a workspace
    const key = `${item.href}:${item.label}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}
