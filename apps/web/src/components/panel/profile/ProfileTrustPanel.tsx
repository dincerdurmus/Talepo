import {
  DEAL_REVIEW_BLIND_HINT,
  formatAverageRating,
  formatReviewCount,
} from "@/lib/offer/deal-review";
import {
  hasVisibleTrustReviews,
  type ProfileTrustAuthority,
} from "@/lib/profile/trust-surface";
import type { TrustSummaryWithComments } from "@/server/offer/trust-summary";
import type { RatingDistribution } from "@/server/profile/self-profile-trust";
import { Star } from "lucide-react";

import { SignalSection } from "./ProfileSignal";
import {
  ProfileTrustCompactEmptyState,
} from "./ProfileTrustSurface";
import { StarRatingDistribution } from "./StarRatingDistribution";

export function ProfileTrustPanel({
  personalTrust,
  companyTrust,
  buyerTrust,
  distributions,
  pendingBlindCount,
}: {
  trustAuthority: ProfileTrustAuthority;
  personalTrust: TrustSummaryWithComments;
  companyTrust: TrustSummaryWithComments | null;
  buyerTrust: TrustSummaryWithComments;
  distributions: {
    providerPersonal: RatingDistribution;
    providerCompany: RatingDistribution;
    buyer: RatingDistribution;
  };
  pendingBlindCount: number;
}) {
  const hasAnyReviews =
    personalTrust.reviewCount > 0 ||
    buyerTrust.reviewCount > 0 ||
    (companyTrust?.reviewCount ?? 0) > 0;

  const primaryTrust = personalTrust.reviewCount > 0 ? personalTrust : buyerTrust;

  const recent = [
    ...personalTrust.recentComments.map((row) => ({
      ...row,
      scope: "Satıcı deneyimi",
    })),
    ...(companyTrust?.recentComments ?? []).map((row) => ({
      ...row,
      scope: "Firma satıcı deneyimi",
    })),
    ...buyerTrust.recentComments.map((row) => ({
      ...row,
      scope: "Alıcı deneyimi",
    })),
  ]
    .sort(
      (a, b) =>
        new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
    )
    .slice(0, 8);

  if (!hasAnyReviews) {
    return (
      <div className="space-y-5">
        <SignalSection
          title="Güven sinyali"
          description="Yalnız görünür hale gelmiş değerlendirmeler trust skorunuza yansır."
        >
          <ProfileTrustCompactEmptyState
            showCompletedSignal={false}
            className="sm:max-h-none"
          />
          {pendingBlindCount > 0 ? (
            <p className="mt-5 rounded-xl border border-teal-900/10 bg-teal-950/[0.02] px-4 py-3 text-sm text-teal-950/70">
              {pendingBlindCount} değerlendirme henüz görünür değil.{" "}
              {DEAL_REVIEW_BLIND_HINT}
            </p>
          ) : null}
        </SignalSection>
      </div>
    );
  }

  return (
    <div className="space-y-5">
      <SignalSection
        title="Güven sinyali"
        description="Yalnız görünür hale gelmiş değerlendirmeler trust skorunuza yansır."
      >
        {hasVisibleTrustReviews(primaryTrust) ? (
          <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_auto] lg:items-center">
            <div className="motion-safe:animate-[signalFadeIn_220ms_ease-out]">
              <div className="flex items-end gap-3">
                <p className="text-4xl font-semibold tabular-nums tracking-tight text-[#0f1f1d] sm:text-5xl">
                  {formatAverageRating(primaryTrust.averageRating)}
                </p>
                <Star
                  className="mb-1.5 h-6 w-6 fill-amber-400 text-amber-400"
                  aria-hidden
                />
              </div>
              <p className="mt-1 text-[13px] text-[#0f1f1d]/52">
                {formatReviewCount(primaryTrust.reviewCount)} ·{" "}
                {primaryTrust.completedTransactions} tamamlanan işlem
              </p>
            </div>
            <div className="grid gap-2 sm:grid-cols-3 lg:grid-cols-1">
              <TrustChannel
                label="Satıcı (kişisel)"
                trust={personalTrust}
                completedLabel="satış"
              />
              {companyTrust ? (
                <TrustChannel
                  label="Satıcı (firma)"
                  trust={companyTrust}
                  completedLabel="işlem"
                />
              ) : null}
              <TrustChannel
                label="Alıcı"
                trust={buyerTrust}
                completedLabel="alım"
              />
            </div>
          </div>
        ) : (
          <ProfileTrustCompactEmptyState showCompletedSignal={false} />
        )}

        {pendingBlindCount > 0 ? (
          <p className="mt-5 rounded-xl border border-teal-900/10 bg-teal-950/[0.02] px-4 py-3 text-sm text-teal-950/70">
            {pendingBlindCount} değerlendirme henüz görünür değil.{" "}
            {DEAL_REVIEW_BLIND_HINT}
          </p>
        ) : null}
      </SignalSection>

      <SignalSection title="Puan dağılımı">
        <div className="grid gap-6 lg:grid-cols-3">
          <DistributionBlock
            label="Satıcı (kişisel)"
            distribution={distributions.providerPersonal}
            total={personalTrust.reviewCount}
          />
          {companyTrust ? (
            <DistributionBlock
              label="Satıcı (firma)"
              distribution={distributions.providerCompany}
              total={companyTrust.reviewCount}
            />
          ) : null}
          <DistributionBlock
            label="Alıcı"
            distribution={distributions.buyer}
            total={buyerTrust.reviewCount}
          />
        </div>
      </SignalSection>

      <SignalSection title="Son görünür değerlendirmeler">
        {recent.length === 0 ? (
          <p className="text-sm text-teal-950/45">
            Görünür yorumlar kısa süre içinde burada listelenecek.
          </p>
        ) : (
          <ul className="space-y-3">
            {recent.map((row, index) => (
              <li
                key={`${row.createdAt}-${index}`}
                className="rounded-xl border border-teal-950/[0.06] bg-white/70 px-4 py-3 transition hover:border-teal-800/15 hover:shadow-[0_0_0_3px_rgba(15,118,110,0.06)]"
              >
                <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-xs font-medium text-teal-950/45">
                  <span>{row.scope}</span>
                  <span aria-hidden>·</span>
                  <span aria-label={`${row.rating} yıldız`}>{row.rating}/5</span>
                  <span aria-hidden>·</span>
                  <time dateTime={row.createdAt}>
                    {formatReviewDate(row.createdAt)}
                  </time>
                </div>
                <p className="mt-1.5 text-sm leading-6 text-teal-950/70">
                  {row.comment}
                </p>
              </li>
            ))}
          </ul>
        )}
      </SignalSection>
    </div>
  );
}

function TrustChannel({
  label,
  trust,
  completedLabel,
}: {
  label: string;
  trust: TrustSummaryWithComments;
  completedLabel: string;
}) {
  return (
    <div className="rounded-[12px] border border-teal-950/[0.07] bg-white/75 px-3.5 py-3">
      <p className="text-[10px] font-semibold uppercase tracking-[0.08em] text-[#0f1f1d]/48">
        {label}
      </p>
      <p className="mt-1 text-[15px] font-semibold tabular-nums text-[#0f1f1d]">
        {trust.averageRating != null
          ? formatAverageRating(trust.averageRating)
          : "—"}
      </p>
      <p className="mt-0.5 text-[11px] text-[#0f1f1d]/52">
        {formatReviewCount(trust.reviewCount)} · {trust.completedTransactions}{" "}
        {completedLabel}
      </p>
    </div>
  );
}

function DistributionBlock({
  label,
  distribution,
  total,
}: {
  label: string;
  distribution: RatingDistribution;
  total: number;
}) {
  return (
    <div>
      <p className="mb-3 text-sm font-medium text-teal-950/50">{label}</p>
      <StarRatingDistribution distribution={distribution} total={total} />
    </div>
  );
}

function formatReviewDate(iso: string) {
  return new Intl.DateTimeFormat("tr-TR", {
    day: "numeric",
    month: "short",
    year: "numeric",
  }).format(new Date(iso));
}
