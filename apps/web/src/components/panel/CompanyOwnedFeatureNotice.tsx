import Link from "next/link";
import { Building2 } from "lucide-react";

type CompanyOwnedFeatureNoticeProps = {
  title: string;
  description: string;
};

/**
 * Shown when the user is plan-entitled personally but the resource table
 * is still company-scoped (saved searches / alerts) — no fake upgrade CTA.
 */
export function CompanyOwnedFeatureNotice({
  title,
  description,
}: CompanyOwnedFeatureNoticeProps) {
  return (
    <section className="rounded-[28px] border border-teal-900/10 bg-white px-6 py-10 sm:px-10">
      <div className="mx-auto flex max-w-xl flex-col items-start text-left">
        <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-teal-900/8 text-teal-800">
          <Building2 className="h-6 w-6" />
        </div>
        <h2 className="mt-5 text-2xl font-semibold tracking-[-0.03em] text-teal-950">
          {title}
        </h2>
        <p className="mt-3 text-[15px] leading-7 text-teal-950/60">{description}</p>
        <Link
          href="/panel/plan"
          className="mt-6 text-sm font-medium text-teal-800 underline-offset-4 hover:underline"
        >
          Plan ve çalışma alanı
        </Link>
      </div>
    </section>
  );
}
