import type { TrustSummary } from "@/lib/offer/deal-review";
import type { PublicVisibleReview } from "@/lib/profile/public-profile";

/** Semantic trust metrics used across profile surfaces (DTO-safe subset). */
export type TrustDisplayMetrics = Pick<
  TrustSummary,
  "completedTransactions" | "reviewCount" | "averageRating"
>;

/**
 * Profile passport authority: provider-personal completed transactions.
 * Matches `getUserTrustSummary` / public user profile DTO `trust`.
 * Do not merge buyer or company counts into this aggregate.
 */
export const PROFILE_TRUST_AUTHORITY_SCOPE = {
  providerPersonal: "provider-personal",
} as const;

export type ProfileTrustAuthorityScope =
  (typeof PROFILE_TRUST_AUTHORITY_SCOPE)[keyof typeof PROFILE_TRUST_AUTHORITY_SCOPE];

export type ProfileTrustAuthority = TrustDisplayMetrics & {
  scope: ProfileTrustAuthorityScope;
};

/** Build the single authority used by self hero, public preview, drawer, and full profile. */
export function buildPersonalProviderTrustAuthority(
  trust: TrustDisplayMetrics,
): ProfileTrustAuthority {
  return {
    scope: PROFILE_TRUST_AUTHORITY_SCOPE.providerPersonal,
    completedTransactions: trust.completedTransactions,
    reviewCount: trust.reviewCount,
    averageRating: trust.averageRating,
  };
}

export function profileTrustAuthoritiesAligned(
  authority: ProfileTrustAuthority,
  publicTrust: TrustDisplayMetrics,
): boolean {
  return (
    authority.scope === PROFILE_TRUST_AUTHORITY_SCOPE.providerPersonal &&
    authority.completedTransactions === publicTrust.completedTransactions &&
    authority.reviewCount === publicTrust.reviewCount &&
    authority.averageRating === publicTrust.averageRating
  );
}

export function hasVisibleTrustReviews(metrics: TrustDisplayMetrics): boolean {
  return metrics.reviewCount > 0 && metrics.averageRating != null;
}

export function hasVisibleTrustReviewRows(
  metrics: TrustDisplayMetrics,
  recentVisibleReviews: ReadonlyArray<PublicVisibleReview> = [],
): boolean {
  return hasVisibleTrustReviews(metrics) || recentVisibleReviews.length > 0;
}

/**
 * Hero is the sole slot for aggregate completed-transaction and rating-summary chips.
 * Secondary sections must not repeat these keys.
 */
export type TrustMetricSlot = "completedTransactions" | "ratingSummary";

export function trustMetricSlotsForSurface(
  surface: "hero" | "secondary",
  metrics: TrustDisplayMetrics,
): ReadonlySet<TrustMetricSlot> {
  if (surface === "hero") {
    const slots = new Set<TrustMetricSlot>();
    if (metrics.completedTransactions > 0) {
      slots.add("completedTransactions");
    }
    if (hasVisibleTrustReviews(metrics)) {
      slots.add("ratingSummary");
    }
    return slots;
  }
  return new Set();
}

export function shouldShowTrustCompactEmpty(
  metrics: TrustDisplayMetrics,
  recentVisibleReviews: ReadonlyArray<PublicVisibleReview> = [],
): boolean {
  return !hasVisibleTrustReviewRows(metrics, recentVisibleReviews);
}
