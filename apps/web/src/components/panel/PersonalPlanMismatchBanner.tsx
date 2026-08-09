import Link from "next/link";
import { AlertTriangle, ArrowRight } from "lucide-react";

import {
  PERSONAL_PREMIUM_MISMATCH_BODY,
  PERSONAL_PREMIUM_MISMATCH_TITLE,
} from "@/lib/membership/membership-rules";

type PersonalPlanMismatchBannerProps = {
  detail?: string;
  /** Compact layout for headers / sidebars. */
  compact?: boolean;
};

export function PersonalPlanMismatchBanner({
  detail,
  compact = false,
}: PersonalPlanMismatchBannerProps) {
  if (compact) {
    return (
      <div className="rounded-xl border border-amber-300/60 bg-[#fffbeb] px-4 py-3">
        <p className="flex items-start gap-2 text-sm font-semibold text-[#92400e]">
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
          {PERSONAL_PREMIUM_MISMATCH_TITLE}
        </p>
        <p className="mt-1 pl-6 text-xs leading-5 text-[#b45309]/90">
          {detail ?? PERSONAL_PREMIUM_MISMATCH_BODY}
        </p>
        <Link
          href="/panel/plan"
          className="mt-2 inline-flex items-center gap-1 pl-6 text-xs font-semibold text-[#b45309] hover:text-[#92400e]"
        >
          Firma planını incele
          <ArrowRight className="h-3 w-3" />
        </Link>
      </div>
    );
  }

  return (
    <section className="rounded-2xl border border-amber-300/50 bg-gradient-to-br from-[#fffbeb] via-[#fef3c7]/40 to-[#fff7ed] px-5 py-4 sm:px-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="flex items-start gap-3">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-amber-100 text-amber-700">
            <AlertTriangle className="h-5 w-5" />
          </div>
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.14em] text-amber-800/70">
              Plan uyarısı
            </p>
            <h2 className="mt-1 text-lg font-semibold text-[#92400e]">
              {PERSONAL_PREMIUM_MISMATCH_TITLE}
            </h2>
            <p className="mt-2 max-w-2xl text-sm leading-6 text-[#b45309]/90">
              {detail ?? PERSONAL_PREMIUM_MISMATCH_BODY}
            </p>
          </div>
        </div>
        <Link
          href="/panel/plan"
          className="inline-flex items-center gap-2 rounded-full bg-amber-700 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-amber-800"
        >
          Firma planını yükselt
          <ArrowRight className="h-4 w-4" />
        </Link>
      </div>
    </section>
  );
}
