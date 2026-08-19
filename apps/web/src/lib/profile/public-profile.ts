import type { TrustSummary } from "@/lib/offer/deal-review";

export type PublicRatingDistribution = Record<1 | 2 | 3 | 4 | 5, number>;

export type PublicVisibleReview = {
  rating: number;
  comment: string;
  reviewerSide: "BUYER" | "PROVIDER";
  createdAt: string;
};

/** Whitelist fields safe to expose in conversation / public profile surfaces. */
export type PublicUserProfileDto = {
  kind: "user";
  id: string;
  displayName: string;
  avatarUrl: string | null;
  accountType: "personal";
  biography: string | null;
  locationLabel: string | null;
  memberSinceLabel: string;
  expertiseCategories: string[];
  trust: TrustSummary;
  verifiedIndicators: string[];
  ratingDistribution: PublicRatingDistribution;
  recentVisibleReviews: PublicVisibleReview[];
};

export type PublicCompanyProfileDto = {
  kind: "company";
  id: string;
  displayName: string;
  avatarUrl: string | null;
  accountType: "company";
  companyName: string;
  representativeName: string | null;
  representativeAvatarUrl: string | null;
  biography: string | null;
  locationLabel: string | null;
  memberSinceLabel: string;
  expertiseCategories: string[];
  trust: TrustSummary;
  verifiedIndicators: string[];
  ratingDistribution: PublicRatingDistribution;
  recentVisibleReviews: PublicVisibleReview[];
};

export type PublicProfileDto = PublicUserProfileDto | PublicCompanyProfileDto;

export const PUBLIC_PROFILE_BIO_MAX = 1000;
export const PUBLIC_PROFILE_NAME_MAX = 120;

export function formatPublicLocation(
  city: string | null | undefined,
  district: string | null | undefined,
  country: string | null | undefined,
): string | null {
  const parts = [district, city, country].filter(Boolean);
  return parts.length > 0 ? parts.join(", ") : null;
}

/** Participant-facing location: city + country only (district stays private). */
export function formatParticipantLocation(
  city: string | null | undefined,
  country: string | null | undefined,
): string | null {
  const parts = [city, country].filter(Boolean);
  return parts.length > 0 ? parts.join(", ") : null;
}

export function formatMemberSince(date: Date): string {
  return new Intl.DateTimeFormat("tr-TR", {
    month: "long",
    year: "numeric",
  }).format(date);
}
