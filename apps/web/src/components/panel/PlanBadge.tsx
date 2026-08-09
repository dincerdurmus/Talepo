import Link from "next/link";

import { getPlanVisual } from "@/lib/membership/plan-visuals";
import { getPlanDefinition, isPaidPlan, type PlanTierId } from "@/lib/membership/plans";

type PlanBadgeProps = {
  planTier: PlanTierId;
  planLabel?: string;
  size?: "sm" | "md";
  /** `chip` for light surfaces; `hero` for dark greeting cards. */
  variant?: "chip" | "hero";
  /** When true, STANDARD shows a subtle label instead of hiding. */
  showStandard?: boolean;
  /** When true, badge links to /panel/plan. */
  linked?: boolean;
  className?: string;
};

const SIZE_CLASSES = {
  sm: "px-2.5 py-1 text-[11px] gap-1",
  md: "px-3 py-1.5 text-xs gap-1.5",
} as const;

const ICON_SIZE = {
  sm: "h-3 w-3",
  md: "h-3.5 w-3.5",
} as const;

export function PlanBadge({
  planTier,
  planLabel,
  size = "sm",
  variant = "chip",
  showStandard = false,
  linked = false,
  className = "",
}: PlanBadgeProps) {
  const paid = isPaidPlan(planTier);
  if (!paid && !showStandard) return null;

  const visual = getPlanVisual(planTier);
  const Icon = visual.icon;
  const label = planLabel ?? getPlanDefinition(planTier).label;

  const styleClasses =
    variant === "hero"
      ? paid
        ? `${visual.activeBadge} shadow-sm ring-1 ring-white/25`
        : "border border-white/15 bg-white/12 text-white/85"
      : visual.badge;

  const badge = (
    <span
      className={`inline-flex items-center rounded-full font-semibold tracking-tight ${styleClasses} ${SIZE_CLASSES[size]} ${className}`}
    >
      {paid ? <Icon className={ICON_SIZE[size]} aria-hidden /> : null}
      {label}
    </span>
  );

  if (linked) {
    return (
      <Link
        href="/panel/plan"
        className="transition hover:opacity-85"
        title="Plan detayları"
      >
        {badge}
      </Link>
    );
  }

  return badge;
}
