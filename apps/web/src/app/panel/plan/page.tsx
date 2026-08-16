import { PlanDetails } from "@/components/panel/PlanDetails";
import { getCompanyContextOptions } from "@/lib/membership/company-context";
import { resolveEntitlements } from "@/lib/membership/resolve-entitlements";
import { requireUser } from "@/server/auth/require-user";

export default async function PlanPage({
  searchParams,
}: {
  searchParams?: Promise<{ billing?: string }>;
}) {
  const user = await requireUser();
  const entitlements = await resolveEntitlements(
    user.id,
    await getCompanyContextOptions(),
  );

  if (entitlements.effectivePlanTier === "STANDARD") {
    return <PlanDetails searchParams={searchParams} showPlanChoices={false} />;
  }

  return <PlanDetails searchParams={searchParams} />;
}
