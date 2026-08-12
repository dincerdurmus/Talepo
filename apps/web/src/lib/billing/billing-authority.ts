/**
 * Billing mutation authority — plan entitlement is not sufficient.
 * Company checkout/credits require OWNER or ADMIN membership.
 * Personal (USER subject) billing remains the actor's own subscription.
 */

export const COMPANY_BILLING_ROLES = ["OWNER", "ADMIN"] as const;

export type CompanyBillingRole = (typeof COMPANY_BILLING_ROLES)[number];

export function canMutateCompanyBilling(
  role: string | null | undefined,
): boolean {
  return role === "OWNER" || role === "ADMIN";
}
