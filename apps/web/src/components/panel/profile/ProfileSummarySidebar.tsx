import Link from "next/link";
import { Bell, Crown } from "lucide-react";

import {
  formatAverageRating,
  formatReviewCount,
} from "@/lib/offer/deal-review";
import type { TrustSummaryWithComments } from "@/server/offer/trust-summary";

export function ProfileSummarySidebar({
  name,
  image,
  initials,
  accountTypeLabel,
  completionPercent,
  personalTrust,
}: {
  name: string;
  image: string | null;
  initials: string;
  accountTypeLabel: string;
  completionPercent: number;
  personalTrust: TrustSummaryWithComments;
}) {
  return (
    <aside className="rounded-[28px] border border-black/[0.06] bg-white p-6 shadow-[0_18px_60px_rgba(0,0,0,0.04)]">
      <div className="flex flex-col items-center text-center">
        {image ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={image}
            alt={name}
            className="h-24 w-24 rounded-full border border-black/10 object-cover"
            referrerPolicy="no-referrer"
          />
        ) : (
          <div className="flex h-24 w-24 items-center justify-center rounded-full bg-[#151515] text-2xl font-semibold text-white">
            {initials}
          </div>
        )}
        <h2 className="mt-5 text-2xl font-semibold tracking-tight">{name}</h2>
        <p className="mt-1 text-sm text-black/40">{accountTypeLabel}</p>
      </div>

      <div className="mt-6 space-y-3 border-t border-black/[0.06] pt-6">
        <Metric label="Profil tamamlanma" value={`%${completionPercent}`} />
        {personalTrust.averageRating != null && personalTrust.reviewCount > 0 ? (
          <Metric
            label="Ortalama puan"
            value={formatAverageRating(personalTrust.averageRating) ?? "—"}
          />
        ) : null}
        {personalTrust.reviewCount > 0 ? (
          <Metric
            label="Değerlendirme"
            value={formatReviewCount(personalTrust.reviewCount)}
          />
        ) : null}
        {personalTrust.completedTransactions > 0 ? (
          <Metric
            label="Tamamlanan işlem"
            value={String(personalTrust.completedTransactions)}
          />
        ) : null}
      </div>

      <div className="mt-6 space-y-2 border-t border-black/[0.06] pt-6">
        <QuickLink href="/panel/plan" icon={Crown} label="Plan ve hesap" />
        <QuickLink href="/panel/bildirimler" icon={Bell} label="Bildirimler" />
      </div>
    </aside>
  );
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between rounded-2xl bg-[#f6f6f2] px-4 py-3">
      <span className="text-sm text-black/45">{label}</span>
      <span className="font-semibold tabular-nums">{value}</span>
    </div>
  );
}

function QuickLink({
  href,
  icon: Icon,
  label,
}: {
  href: string;
  icon: typeof Crown;
  label: string;
}) {
  return (
    <Link
      href={href}
      className="flex min-h-11 items-center gap-2 rounded-xl border border-black/[0.06] px-3 py-2.5 text-sm font-semibold hover:bg-[#fafaf8]"
    >
      <Icon className="h-4 w-4 text-black/40" />
      {label}
    </Link>
  );
}
