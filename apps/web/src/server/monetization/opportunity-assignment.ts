/** Role gate for Corporate lead distribution (no DB). */

const ASSIGNER_ROLES = new Set(["OWNER", "ADMIN", "MANAGER"]);

export function canAssignOpportunities(role: string): boolean {
  return ASSIGNER_ROLES.has(role);
}
