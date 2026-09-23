import { getCompanyContextOptions } from "@/lib/membership/company-context";
import {
  canMutateCompanyWorkspace,
  COMPANY_READ_ONLY_MESSAGE,
} from "@/lib/membership/company-permissions";
import { EntitlementError } from "@/lib/membership/types";
import { assertCompanyMembership } from "@/lib/panel/company-workspace";

/** Check the resource's company too, so switching workspace cannot bypass a role. */
export async function assertCompanyWriteAccess(userId: string, companyId: string | null | undefined) {
  if (!companyId) return;
  const membership = await assertCompanyMembership(userId, companyId);
  if (!membership) {
    throw new EntitlementError("COMPANY_ACCESS_DENIED", "Firma üyeliğiniz aktif değil.", 403);
  }
  if (!canMutateCompanyWorkspace(membership.role)) {
    throw new EntitlementError("COMPANY_READ_ONLY", COMPANY_READ_ONLY_MESSAGE, 403);
  }
}

/** Personal activity remains personal; an analysis workspace cannot perform writes. */
export async function assertSelectedCompanyWriteAccess(userId: string): Promise<string | null> {
  const options = await getCompanyContextOptions();
  const companyId = options.preferUserSubject ? null : options.companyId ?? null;
  await assertCompanyWriteAccess(userId, companyId);
  return companyId;
}
