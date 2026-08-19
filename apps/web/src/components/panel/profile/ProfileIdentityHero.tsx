"use client";

import { useEffect, useRef, useState } from "react";
import { Eye, Sparkles } from "lucide-react";

import {
  formatAverageRating,
  formatReviewCount,
} from "@/lib/offer/deal-review";
import type { ProfileTrustAuthority } from "@/lib/profile/trust-surface";
import type { PublicUserProfileDto } from "@/lib/profile/public-profile";

import {
  ProfileCompletionRing,
  signalHeroSurface,
  SignalOrbitDecor,
} from "./ProfileSignal";
import { PublicProfilePreviewPanel } from "./PublicProfilePreviewPanel";

export function ProfileIdentityHero({
  name,
  image,
  initials,
  accountTypeLabel,
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
  const ratingLabel =
    trustAuthority.averageRating != null && trustAuthority.reviewCount > 0
      ? formatAverageRating(trustAuthority.averageRating) ?? "—"
      : "—";
  const reviewLabel =
    trustAuthority.reviewCount > 0
      ? formatReviewCount(trustAuthority.reviewCount)
      : "0 değerlendirme";

  useEffect(() => {
    if (!previewOpen) return;
    previewRef.current?.scrollIntoView({ behavior: "smooth", block: "nearest" });
  }, [previewOpen]);

  return (
    <div className="space-y-4">
      <div className={`${signalHeroSurface} p-5 sm:p-6`}>
        <SignalOrbitDecor />
        <div className="relative flex flex-col gap-5 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex min-w-0 items-start gap-4 sm:items-center">
            <ProfileCompletionRing percent={completionPercent}>
              {image ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={image}
                  alt={name}
                  className="h-full w-full object-cover"
                  referrerPolicy="no-referrer"
                />
              ) : (
                <span className="text-lg font-semibold text-[#0f1f1d]">{initials}</span>
              )}
            </ProfileCompletionRing>

            <div className="min-w-0 flex-1">
              <h1 className="truncate text-2xl font-semibold tracking-tight text-[#0f1f1d] sm:text-3xl">
                {name}
              </h1>
              <p className="mt-1 text-sm text-teal-950/55">
                {accountTypeLabel}
                {locationLabel ? ` · ${locationLabel}` : ""}
              </p>
              <p className="mt-0.5 text-xs text-teal-950/40">
                Üyelik: {memberSinceLabel}
              </p>
              {avatarSourceNote ? (
                <p className="mt-2 text-xs text-teal-950/40">{avatarSourceNote}</p>
              ) : null}
              <p className="mt-2 text-xs font-medium text-teal-800/70">
                %{completionPercent} profil tamamlandı
              </p>
            </div>
          </div>

          <div className="grid shrink-0 grid-cols-3 gap-2 sm:gap-3">
            <Metric label="Puan" value={ratingLabel} />
            <Metric label="Değerlendirme" value={reviewLabel.replace(" değerlendirme", "")} sub={reviewLabel.includes("0") ? "değerlendirme" : undefined} />
            <Metric
              label="İşlem"
              value={String(trustAuthority.completedTransactions)}
              sub="tamamlanan"
              trustMetric="completedTransactions"
              trustValue={trustAuthority.completedTransactions}
            />
          </div>
        </div>

        <div className="relative mt-5 flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() => setPreviewOpen((v) => !v)}
            className="inline-flex min-h-11 items-center gap-2 rounded-full border border-teal-900/12 bg-white/70 px-4 py-2 text-sm font-semibold text-teal-950 transition hover:border-teal-800/25 hover:shadow-[0_0_0_3px_rgba(15,118,110,0.08)]"
          >
            <Eye className="h-4 w-4" />
            Profili önizle
          </button>
          {completionPercent < 100 ? (
            <button
              type="button"
              onClick={onCompleteProfile}
              className="inline-flex min-h-11 items-center gap-2 rounded-full bg-[#0f1f1d] px-4 py-2 text-sm font-semibold text-white transition hover:bg-black"
            >
              <Sparkles className="h-4 w-4" />
              Profil bilgilerini tamamla
            </button>
          ) : null}
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

function Metric({
  label,
  value,
  sub,
  trustMetric,
  trustValue,
}: {
  label: string;
  value: string;
  sub?: string;
  trustMetric?: string;
  trustValue?: number;
}) {
  return (
    <div
      className="rounded-xl border border-teal-950/[0.06] bg-white/60 px-3 py-2.5 text-center backdrop-blur-sm"
      {...(trustMetric ? { "data-trust-metric": trustMetric } : {})}
      {...(trustValue != null ? { "data-trust-value": String(trustValue) } : {})}
    >
      <p className="text-[10px] font-semibold uppercase tracking-[0.08em] text-teal-950/40">
        {label}
      </p>
      <p className="mt-0.5 text-lg font-semibold tabular-nums text-[#0f1f1d]">{value}</p>
      {sub ? <p className="text-[10px] text-teal-950/40">{sub}</p> : null}
    </div>
  );
}
