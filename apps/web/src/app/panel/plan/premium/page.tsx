import { PlanDetails } from "@/components/panel/PlanDetails";

export default function PremiumPlanPage({
  searchParams,
}: {
  searchParams?: Promise<{ billing?: string }>;
}) {
  return <PlanDetails searchParams={searchParams} />;
}
