"use client";

import { createContext, useContext, type ReactNode } from "react";
import { COMPANY_READ_ONLY_MESSAGE } from "@/lib/membership/company-permissions";

const CompanyWriteContext = createContext(true);

export function CompanyWriteScope({ canWrite, children }: { canWrite: boolean; children: ReactNode }) {
  return <CompanyWriteContext.Provider value={canWrite}>{children}</CompanyWriteContext.Provider>;
}

export function useCompanyCanWrite() {
  return useContext(CompanyWriteContext);
}

export function CompanyReadOnlyNotice() {
  return (
    <div role="note" className="rounded-2xl border border-teal-900/10 bg-teal-50 px-4 py-3 text-sm leading-6 text-teal-950">
      <strong>Analist koltuğu</strong>
      <p>{COMPANY_READ_ONLY_MESSAGE}</p>
    </div>
  );
}
