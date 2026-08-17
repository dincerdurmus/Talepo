import { PlanDetails } from "@/components/panel/PlanDetails";

export default function PlanPage({
  searchParams,
}: {
  searchParams?: Promise<{ billing?: string }>;
}) {
  return <PlanDetails searchParams={searchParams} showPlanChoices />;
}
