import { redirect } from "next/navigation";

/** Legacy Premium marketing route — product is Profesyonel. */
export default function PremiumPlanPage() {
  redirect("/panel/plan");
}
