/** Company roles are independent of a member's personal subscription. */
export const COMPANY_ROLES = ["OWNER", "MEMBER", "VIEWER"] as const;
export type CompanyRole = (typeof COMPANY_ROLES)[number];
export const COMPANY_WRITE_ROLES = ["OWNER", "MEMBER"] as const;
export const COMPANY_INVITE_ROLES = ["MEMBER", "VIEWER"] as const;
export type CompanyInviteRole = (typeof COMPANY_INVITE_ROLES)[number];

/** Read compatibility for existing company records; never platform roles. */
export const COMPANY_STORED_WRITE_ROLES = [...COMPANY_WRITE_ROLES, "ADMIN", "MANAGER"] as const;

export function normalizeCompanyRole(role: unknown): CompanyRole | null {
  if (role === "ADMIN" || role === "MANAGER") return "MEMBER";
  return COMPANY_ROLES.find((allowed) => allowed === role) ?? null;
}

export function canManageCompany(role: string | null | undefined): boolean {
  return role === "OWNER";
}

/** VIEWER is the stored role for the included, read-only analysis seat. */
export const ANALYSIS_SEAT_ROLE = "VIEWER";
export const ANALYSIS_SEAT_LABEL = "Analist";
export const COMPANY_READ_ONLY_MESSAGE =
  "Analist koltuğu yalnızca görüntüleme içindir. Firma adına talep, teklif veya mesaj gönderemezsiniz.";

export function canMutateCompanyWorkspace(role: string | null | undefined): boolean {
  const canonicalRole = normalizeCompanyRole(role);
  return COMPANY_WRITE_ROLES.some((allowed) => allowed === canonicalRole);
}

export function isCompanyInviteRole(role: unknown): role is CompanyInviteRole {
  return COMPANY_INVITE_ROLES.some((allowed) => allowed === role);
}

export function canInviteCompanyRole(actorRole: string, invitedRole: CompanyInviteRole): boolean {
  return canManageCompany(actorRole) && isCompanyInviteRole(invitedRole);
}

export function canViewTeamOffers(role: string | null | undefined): boolean {
  return canManageCompany(role) || role === ANALYSIS_SEAT_ROLE;
}
