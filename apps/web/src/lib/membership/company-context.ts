import { cookies } from "next/headers";

import type { ResolveEntitlementsOptions } from "./types";

/** Cookie used by the company switcher. */
export const COMPANY_CONTEXT_COOKIE = "talepo_company_id";

/** Sentinel value: force personal (user) subject even if company memberships exist. */
export const PERSONAL_CONTEXT_VALUE = "__personal__";

/**
 * Build resolveEntitlements options from the company-context cookie.
 * - missing cookie → default company-first (legacy)
 * - company id → that company
 * - __personal__ → force user subject
 */
export async function getCompanyContextOptions(): Promise<ResolveEntitlementsOptions> {
  const jar = await cookies();
  const value = jar.get(COMPANY_CONTEXT_COOKIE)?.value?.trim();

  if (!value) return {};
  if (value === PERSONAL_CONTEXT_VALUE) return { preferUserSubject: true };
  return { companyId: value };
}

/** @deprecated Prefer getCompanyContextOptions(). */
export async function getRequestedCompanyId(): Promise<string | undefined> {
  const options = await getCompanyContextOptions();
  return options.companyId;
}
