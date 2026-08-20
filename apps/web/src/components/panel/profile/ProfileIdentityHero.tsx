"use client";

import { useEffect, useRef, useState } from "react";
import { Eye, PencilLine } from "lucide-react";

import {
  formatAverageRating,
  formatReviewCount,
} from "@/lib/offer/deal-review";
import type { ProfileTrustAuthority } from "@/lib/profile/trust-surface";
import { trustMetricSlotsForSurface } from "@/lib/profile/trust-surface";
import type { PublicUserProfileDto } from "@/lib/profile/public-profile";

import {
  ProfileCompletionRing,
  signalIdentityHeroSurface,
} from "./ProfileSignal";
import { PublicProfilePreviewPanel } from "./PublicProfilePreviewPanel";

export function ProfileIdentityHero({
  name,
  image,
  initials,
  accountTypeLabel,
  planLabel,
  locationLabel,
  memberSinceLabel,
  completionPercent,
  trustAuthority,
  avatarSourceNote,
  publicPreview,
  onCompleteProfile,
}: {
  name: string;
  image: string | null;
  initials: string;
  accountTypeLabel: string;
  planLabel?: string | null;
  locationLabel: string | null;
  memberSinceLabel: string;
  completionPercent: number;
  trustAuthority: ProfileTrustAuthority;
  avatarSourceNote: string | null;
  publicPreview: PublicUserProfileDto;
  onCompleteProfile?: () => void;
}) {
  const [previewOpen, setPreviewOpen] = useState(false);
  const previewRef = useRef<HTMLDivElement>(null);
  const heroSlots = trustMetricSlotsForSurface("hero", trustAuthority);
  const ratingLabel =
    trustAuthority.averageRating != null && trustAuthority.reviewCount > 0
      ? formatAverageRating(trustAuthority.averageRating) ?? "—"
      : "—";
  const reviewCountLabel =
    trustAuthority.reviewCount > 0
      ? formatReviewCount(trustAuthority.reviewCount).replace(
          " değerlendirme",
          "",
        )
      : "0";
  const incomplete = completionPercent < 100;
  const showPlanBadge =
    Boolean(planLabel?.trim()) &&
    planLabel !== "Standart" &&
    !accountTypeLabel.includes(planLabel!);

  useEffect(() => {
    if (!previewOpen) return;
    previewRef.current?.scrollIntoView({ behavior: "smooth", block: "nearest" });
  }, [previewOpen]);

  return (
    <div className="space-y-4">
      <div className={`${signalIdentityHeroSurface} p-5 sm:p-6`}>
        <div className="relative flex flex-col gap-5 lg:flex-row lg:items-start lg:justify-between lg:gap-8">
          <div className="flex min-w-0 flex-1 items-start gap-4">
            <ProfileCompletionRing
              percent={completionPercent}
              size={84}
              tone="dark"
            >
              {image ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={image}
                  alt={name}
                  className="h-full w-full object-cover"
                  referrerPolicy="no-referrer"
                />
              ) : (
                <span className="text-[15px] font-semibold text-[#0f1f1d]">
                  {initials}
                </span>
              )}
            </ProfileCompletionRing>

            <div className="min-w-0 flex-1">
              <div className="flex min-w-0 flex-wrap items-center gap-2">
                <h1 className="truncate text-[1.55rem] font-semibold tracking-tight text-[#f5f7f6] sm:text-[1.75rem]">
                  {name}
                </h1>
                {showPlanBadge ? (
                  <span className="inline-flex items-center rounded-full border border-teal-200/25 bg-[#dceee9]/95 px-2 py-0.5 text-[11px] font-semibold text-[#0f3f39]">
                    {planLabel}
                  </span>
                ) : null}
              </div>
              <p className="mt-1 text-[13px] text-[#aebbb7]">
                {accountTypeLabel}
                {locationLabel ? ` · ${locationLabel}` : ""}
              </p>
              <p className="mt-0.5 text-[12px] text-[#aebbb7]/90">
                Üyelik: {memberSinceLabel}
              </p>
              {avatarSourceNote ? (
                <p className="mt-1.5 text-[11px] text-[#aebbb7]/75">
                  {avatarSourceNote}
                </p>
              ) : null}

              <div className="mt-3 max-w-xs">
                <div className="flex items-baseline justify-between gap-3">
                  <p className="text-[11px] font-medium text-[#aebbb7]">
                    Profil tamamlanma
                  </p>
                  <p className="text-[12px] font-semibold tabular-nums text-[#d7ebe6]">
                    %{completionPercent}
                  </p>
                </div>
                <div
                  className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-white/14"
                  role="progressbar"
                  aria-valuenow={completionPercent}
                  aria-valuemin={0}
                  aria-valuemax={100}
                  aria-label={`Profil tamamlanma yüzde ${completionPercent}`}
                >
                  <div
                    className="h-full rounded-full bg-[#0f766e] motion-safe:transition-[width] motion-safe:duration-500"
                    style={{
                      width: `${Math.max(0, Math.min(100, completionPercent))}%`,
                    }}
                  />
                </div>
              </div>
            </div>
          </div>

          <aside
            className="w-full shrink-0 rounded-[14px] border border-white/10 bg-white/[0.06] px-3.5 py-3 sm:max-w-sm lg:w-[15.5rem]"
            aria-label="Güven özeti"
          >
            <p className="text-[10px] font-semibold uppercase tracking-[0.1em] text-[#aebbb7]">
              Güven özeti
            </p>
            <dl className="mt-2.5 space-y-2">
              <TrustRow
                label="Puan"
                value={ratingLabel}
                metric={
                  heroSlots.has("ratingSummary") ? "ratingSummary" : undefined
                }
              />
              <TrustRow label="Değerlendirme" value={reviewCountLabel} />
              <TrustRow
                label="Tamamlanan işlem"
                value={String(trustAuthority.completedTransactions)}
                metric={
                  heroSlots.has("completedTransactions")
                    ? "completedTransactions"
                    : undefined
                }
                trustValue={trustAuthority.completedTransactions}
              />
            </dl>
          </aside>
        </div>

        <div className="relative mt-5 flex flex-col gap-2 sm:flex-row sm:flex-wrap">
          <button
            type="button"
            onClick={onCompleteProfile}
            className="inline-flex min-h-11 w-full items-center justify-center gap-2 rounded-xl bg-[#f5f7f6] px-4 text-sm font-semibold text-[#111716] transition hover:bg-white sm:w-auto"
          >
            <PencilLine className="h-4 w-4" aria-hidden />
            {incomplete ? "Profili tamamla" : "Profili düzenle"}
          </button>
          <button
            type="button"
            onClick={() => setPreviewOpen((v) => !v)}
            className="inline-flex min-h-11 w-full items-center justify-center gap-2 rounded-xl border border-white/16 bg-transparent px-4 text-sm font-semibold text-[#e8eeec] transition hover:border-white/28 hover:bg-white/[0.05] sm:w-auto"
          >
            <Eye className="h-4 w-4" aria-hidden />
            Profili önizle
          </button>
        </div>
      </div>

      {previewOpen ? (
        <div ref={previewRef}>
          <PublicProfilePreviewPanel profile={publicPreview} embedded />
        </div>
      ) : null}
    </div>
  );
}

function TrustRow({
  label,
  value,
  metric,
  trustValue,
}: {
  label: string;
  value: string;
  metric?: string;
  trustValue?: number;
}) {
  return (
    <div
      className="flex items-baseline justify-between gap-3 border-b border-white/[0.07] pb-2 last:border-b-0 last:pb-0"
      {...(metric ? { "data-trust-metric": metric } : {})}
      {...(trustValue != null ? { "data-trust-value": String(trustValue) } : {})}
    >
      <dt className="text-[12px] text-[#aebbb7]">{label}</dt>
      <dd className="text-[13px] font-semibold tabular-nums tracking-tight text-[#f5f7f6]">
        {value}
      </dd>
    </div>
  );
}
