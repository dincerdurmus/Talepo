import { getCompanyContextOptions } from "@/lib/membership/company-context";
import { resolveEntitlements } from "@/lib/membership/resolve-entitlements";
import type { BillingSubjectRef } from "@/lib/billing/types";

export async function resolveBillingSubjectForUser(
  userId: string,
): Promise<BillingSubjectRef> {
  const entitlements = await resolveEntitlements(
    userId,
    await getCompanyContextOptions(),
  );
  if (entitlements.subject.type === "company") {
    return { type: "COMPANY", id: entitlements.subject.id };
  }
  return { type: "USER", id: userId };
}
