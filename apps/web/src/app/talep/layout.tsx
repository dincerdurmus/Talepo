import Link from "next/link";
import type { ReactNode } from "react";
import { CompanyReadOnlyNotice } from "@/components/panel/CompanyWriteScope";
import { getCompanyContextOptions } from "@/lib/membership/company-context";
import { canMutateCompanyWorkspace } from "@/lib/membership/company-permissions";
import { assertCompanyMembership } from "@/lib/panel/company-workspace";
import { AuthenticationError, requireUser } from "@/server/auth/require-user";

/** Explain the role before a company analyst spends time composing a request. */
export default async function RequestCreationLayout({ children }: { children: ReactNode }) {
  const options = await getCompanyContextOptions();
  if (!options.companyId || options.preferUserSubject) return children;
  let user;
  try {
    user = await requireUser();
  } catch (error) {
    if (error instanceof AuthenticationError) return children;
    throw error;
  }
  const membership = await assertCompanyMembership(user.id, options.companyId);
  if (membership && !canMutateCompanyWorkspace(membership.role)) {
    return (
      <main className="mx-auto max-w-2xl px-5 py-16">
        <CompanyReadOnlyNotice />
        <Link href="/panel/analiz" className="mt-5 inline-block font-semibold text-teal-800">
          Firma analizlerine dön
        </Link>
      </main>
    );
  }
  return children;
}
