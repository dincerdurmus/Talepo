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
 * 1. Firma bağlamı: Company.planTier storage + Professional owner inheritance.
 * 2. User.planTier kişisel modda geçerlidir; Company.planTier'a yazılmaz.
 * 3. Professional owner'ın workspace'i Professional capability kullanır.
 * 4. Hidden Inventory ayrı company add-on'dur; PlanTier değildir.
 * 5. Kişisel ve firma bonus/kota havuzları birleştirilmez.
 * 6. Legacy Corporate/Premium stored → effective Professional.
 * 7. PLAN entitlement ≠ ROLE permission — ikisi de gerekli.
 */

export const PERSONAL_PREMIUM_MISMATCH_TITLE =
  "Kişisel Profesyonel üyelik ekibe yansımaz";

export const PERSONAL_PREMIUM_MISMATCH_BODY =
  "Kişisel Profesyonel üyeliğiniz, sahip olduğunuz firma çalışma alanında geçerlidir. Sahip olmadığınız ekiplerde firma planı geçerlidir.";

export const TEAM_PLAN_SCOPE_NOTE =
  "Firma çalışma alanında Profesyonel sahip üyeliği ekibe yansır. Gizli Envanter ve ekstra koltuklar ayrı ücretli eklentilerdir.";

/**
 * Kişisel plan firma planından yüksekse (ör. User Profesyonel + Company Standart
 * ve inheritance yok). Yalnızca firma bağlamında anlamlıdır.
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

  return `Kişisel planınız ${personal}; firma çalışma alanı ${company}. Sahip olduğunuz firmada Profesyonel haklar korunur.`;
}
