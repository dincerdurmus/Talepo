import { hasFeature, type FeatureKey } from "@/lib/membership/entitlements";

export const SIGNAL_RAIL_LOCKED_HINT =
  "Bu araçlar Profesyonel planla açılır.";

export type SignalRailProToolId =
  | "firsatlar"
  | "takiplerim"
  | "radar"
  | "teklif-zekasi";

export type SignalRailProToolTone =
  | "opportunities"
  | "follows"
  | "radar"
  | "intelligence";

export type SignalRailProToolDefinition = {
  id: SignalRailProToolId;
  title: string;
  description: string;
  href: string;
  tone: SignalRailProToolTone;
  requireAny: readonly FeatureKey[];
};

/**
 * Personal Signal Rail Pro catalog.
 * Entitlement is decided with hasFeature(), never plan tier or admin role.
 * Basic Analiz is intentionally absent: it is a core panel surface.
 */
export const SIGNAL_RAIL_PRO_TOOLS: readonly SignalRailProToolDefinition[] = [
  {
    id: "firsatlar",
    title: "Fırsatlar",
    description: "Sana uygun açık talepler",
    href: "/panel/firsatlar",
    tone: "opportunities",
    requireAny: ["hot_opportunities"],
  },
  {
    id: "takiplerim",
    title: "Takiplerim",
    description: "Kriterlerinle fırsatları kaçırma",
    href: "/panel/takiplerim",
    tone: "follows",
    requireAny: ["saved_searches", "smart_alerts"],
  },
  {
    id: "radar",
    title: "Talepo Radar",
    description: "Olağan dışı ilgi gören açık talepler",
    href: "/panel/firsatlar?view=radar",
    tone: "radar",
    requireAny: ["talepo_radar"],
  },
  {
    id: "teklif-zekasi",
    title: "Teklif Zekâsı",
    description: "Teklif verdiğin taleplerde anonim fiyat dağılımı",
    href: "/panel/teklifler",
    tone: "intelligence",
    requireAny: ["professional_analytics"],
  },
];

export type ResolvedSignalRailProTool = {
  id: SignalRailProToolId;
  title: string;
  description: string;
  tone: SignalRailProToolTone;
  locked: boolean;
  href: string | null;
  active: boolean;
};

export function isSignalRailProToolEntitled(
  features: Partial<Record<FeatureKey, boolean>> | undefined,
  requireAny: readonly FeatureKey[],
): boolean {
  if (!features) return false;
  const record = features as Record<FeatureKey, boolean>;
  return requireAny.some((key) => hasFeature(record, key));
}

function isProToolActive(
  pathname: string,
  href: string,
  id: SignalRailProToolId,
): boolean {
  if (id === "radar" || id === "teklif-zekasi") return false;
  const path = href.split("?")[0] ?? href;
  return pathname === path || pathname.startsWith(`${path}/`);
}

export function resolveSignalRailProTools(
  features: Partial<Record<FeatureKey, boolean>> | undefined,
  pathname: string,
): ResolvedSignalRailProTool[] {
  return SIGNAL_RAIL_PRO_TOOLS.map((tool) => {
    const entitled = isSignalRailProToolEntitled(features, tool.requireAny);
    return {
      id: tool.id,
      title: tool.title,
      description: tool.description,
      tone: tool.tone,
      locked: !entitled,
      href: entitled ? tool.href : null,
      active: entitled ? isProToolActive(pathname, tool.href, tool.id) : false,
    };
  });
}

export function signalRailHasLockedProTools(
  tools: readonly ResolvedSignalRailProTool[],
): boolean {
  return tools.some((tool) => tool.locked);
}
