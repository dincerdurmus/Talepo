import { isPaidPlan, planTierRank } from "./plans";
import type { EntitlementContext } from "./types";
import type { EntitlementDTO } from "./serialize";

type PlanMismatchInput = Pick<
  EntitlementContext,
  "subject" | "personalPlan" | "effectivePlanTier" | "planLabel"
> | EntitlementDTO;

/**
 * Üyelik kuralları (ürün özeti)
 *
 * 1. Firma bağlamı aktifken tedarikçi/ekip özellikleri yalnızca Company.planTier'dan gelir.
 * 2. User.planTier kişisel modda geçerlidir; firma aboneliği personal planı yükseltmez.
 * 3. Kişisel Premium + Standart firma → firma bağlamında Standart haklar (uyarı göster).
 * 4. Firma planı (Premium/Profesyonel/Kurumsal) yalnız seçili firma workspace'inde geçerlidir.
 * 5. Kişisel ve firma bonus/kota havuzları birleştirilmez.
 * 6. Corporate company membership ≠ USER planTier mutation.
 * 7. PLAN entitlement ≠ ROLE permission — ikisi de gerekli.
 */

export const PERSONAL_PREMIUM_MISMATCH_TITLE =
  "Kişisel Premium ekibe yansımaz";

export const PERSONAL_PREMIUM_MISMATCH_BODY =
  "Kişisel hesabınızdaki Premium, firma çalışma alanında geçerli değildir. Ekip için firma planı (Kurumsal veya ücretli firma planı) gerekir.";

export const TEAM_PLAN_SCOPE_NOTE =
  "Firma planı tüm ekip üyelerine firma bağlamında uygulanır. Kişisel plan yalnızca kişisel modda geçerlidir.";

/**
 * Kişisel plan firma planından yüksekse (ör. User Premium + Company Standart).
 * Yalnızca firma bağlamında anlamlıdır.
 */
export function hasPersonalPlanMismatch(ctx: PlanMismatchInput): boolean {
  if (ctx.subject.type !== "company" || !ctx.personalPlan) {
    return false;
  }

  if (!isPaidPlan(ctx.personalPlan.effectivePlanTier)) {
    return false;
  }

  return (
    planTierRank(ctx.personalPlan.effectivePlanTier) >
    planTierRank(ctx.effectivePlanTier)
  );
}

export function formatPersonalPlanMismatchDetail(ctx: PlanMismatchInput): string {
  if (!ctx.personalPlan) return PERSONAL_PREMIUM_MISMATCH_BODY;

  const personal = ctx.personalPlan.planLabel;
  const company = ctx.planLabel;

  return `Kişisel planınız ${personal}; firma planı ${company}. Ekip özellikleri firma planına göre açılır.`;
}
