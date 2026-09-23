/** Role gate for Corporate lead distribution (no DB). */

import { canManageCompany } from "@/lib/membership/company-permissions";

export function canAssignOpportunities(role: string): boolean {
  return canManageCompany(role);
}
