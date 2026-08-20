import { Orbit } from "lucide-react";

import { CompletedTransactionBadge } from "@/components/panel/CompletedTransactionBadge";
import { TrustSummaryBadge } from "@/components/panel/TrustSummaryBadge";
import { type TrustSummary } from "@/lib/offer/deal-review";
import type { PublicProfileDto, PublicVisibleReview } from "@/lib/profile/public-profile";
import {
  shouldShowTrustCompactEmpty,
} from "@/lib/profile/trust-surface";

import { signalSurface } from "./ProfileSignal";
import { StarRatingDistribution } from "./StarRatingDistribution";

const COMPACT_EMPTY_COPY =
  "Tamamlanan ve görünür hale gelen ilk değerlendirmenizden sonra puan ve yorumlar burada gösterilecek.";

/** Sole hero authority: one completedTransactions chip + one rating summary at most. */
export function ProfileTrustHeroMetrics({ trust }: { trust: TrustSummary }) {
  return <TrustSummaryBadge summary={trust} />;
}

export function ProfileTrustCompactEmptyState({
  completedTransactions = 0,
  description = COMPACT_EMPTY_COPY,
  showCompletedSignal = true,
  className = "",
}: {
  completedTransactions?: number;
  description?: string;
  showCompletedSignal?: boolean;
  className?: string;
}) {
  return (
    <div
      className={`rounded-[14px] border border-teal-900/[0.08] bg-[#f7faf9] px-3.5 py-3.5 ${className}`}
    >
      <div className="flex items-start gap-3">
        <span className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-[10px] border border-teal-800/10 bg-white text-teal-800/50">
          <Orbit className="h-3.5 w-3.5" aria-hidden />
        </span>
        <div className="min-w-0 flex-1">
          <p className="text-[13px] font-semibold text-[#0f1f1d]">
            Güven profili oluşuyor
          </p>
          <p className="mt-1 text-[12px] leading-5 text-[#0f1f1d]/55">
            {description}
          </p>
          {showCompletedSignal && completedTransactions > 0 ? (
            <div className="mt-2">
              <CompletedTransactionBadge count={completedTransactions} />
            </div>
          ) : null}
        </div>
      </div>
    </div>
  );
}

export function ProfileTrustPublicSections({
  profile,
}: {
  profile: PublicProfileDto;
}) {
  if (shouldShowTrustCompactEmpty(profile.trust, profile.recentVisibleReviews)) {
    if (profile.trust.completedTransactions > 0) {
      return null;
    }

    return (
      <ProfileTrustCompactEmptyState
        completedTransactions={profile.trust.completedTransactions}
        className="sm:max-h-none"
      />
    );
  }

  return (
    <div className="grid gap-5 md:grid-cols-2">
      <div className={`${signalSurface} p-5 sm:p-6`}>
        <h2 className="text-base font-semibold tracking-tight text-[#0f1f1d]">
          Puan dağılımı
        </h2>
        <div className="mt-4">
          <StarRatingDistribution
            distribution={profile.ratingDistribution}
            total={profile.trust.reviewCount}
          />
        </div>
      </div>

      <div className={`${signalSurface} p-5 sm:p-6`}>
        <h2 className="text-base font-semibold tracking-tight text-[#0f1f1d]">
          Son değerlendirmeler
        </h2>
        {profile.recentVisibleReviews.length === 0 ? (
          <p className="mt-4 text-sm text-teal-950/45">
            Görünür yorumlar kısa süre içinde burada listelenecek.
          </p>
        ) : (
          <ul className="mt-4 space-y-3">
            {profile.recentVisibleReviews.map((row, index) => (
              <PublicReviewRow key={`${row.createdAt}-${index}`} row={row} />
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}

export function ProfileTrustDrawerFollowUp({
  trust,
}: {
  trust: TrustSummary;
}) {
  if (!shouldShowTrustCompactEmpty(trust) || trust.completedTransactions > 0) {
    return null;
  }

  return (
    <ProfileTrustCompactEmptyState
      completedTransactions={trust.completedTransactions}
      description="Tamamlanan işlemlerden sonra değerlendirme sinyalleri burada görünür."
      className="max-h-[240px]"
    />
  );
}

function PublicReviewRow({ row }: { row: PublicVisibleReview }) {
  return (
    <li className="rounded-xl border border-teal-950/[0.06] bg-white/70 px-4 py-3">
      <p className="text-xs font-medium text-teal-950/45">
        {row.reviewerSide === "BUYER" ? "Alıcı deneyimi" : "Satıcı deneyimi"} ·{" "}
        <span aria-label={`${row.rating} yıldız`}>{row.rating}/5</span> ·{" "}
        {formatReviewDate(row.createdAt)}
      </p>
      <p className="mt-1 text-sm leading-6 text-teal-950/70">{row.comment}</p>
    </li>
  );
}

function formatReviewDate(iso: string) {
  return new Intl.DateTimeFormat("tr-TR", {
    day: "numeric",
    month: "short",
    year: "numeric",
  }).format(new Date(iso));
}
