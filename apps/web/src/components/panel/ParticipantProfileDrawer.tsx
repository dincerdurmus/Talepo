"use client";

import Link from "next/link";
import { useEffect, useRef } from "react";
import {
  Building2,
  CheckCircle2,
  MapPin,
  Star,
  UserRound,
  X,
} from "lucide-react";

import { TrustSummaryBadge } from "@/components/panel/TrustSummaryBadge";
import {
  formatAverageRating,
  formatReviewCount,
} from "@/lib/offer/deal-review";
import type { PublicProfileDto } from "@/lib/profile/public-profile";

type ParticipantProfileDrawerProps = {
  open: boolean;
  profile: PublicProfileDto | null;
  conversationId: string;
  loading?: boolean;
  error?: string | null;
  onClose: () => void;
  triggerRef?: React.RefObject<HTMLElement | null>;
};

function ProfileAvatar({ profile }: { profile: PublicProfileDto }) {
  const label = profile.displayName;
  if (profile.avatarUrl) {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src={profile.avatarUrl}
        alt={label}
        className="h-16 w-16 rounded-full border border-teal-900/10 object-cover"
        referrerPolicy="no-referrer"
      />
    );
  }

  const initials = label
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() ?? "")
    .join("");

  return (
    <div className="flex h-16 w-16 items-center justify-center rounded-full bg-[#0f766e] text-lg font-semibold text-white">
      {initials || "?"}
    </div>
  );
}

export function ParticipantProfileDrawer({
  open,
  profile,
  conversationId,
  loading = false,
  error = null,
  onClose,
  triggerRef,
}: ParticipantProfileDrawerProps) {
  const panelRef = useRef<HTMLDivElement>(null);
  const closeRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (!open) return;
    const previous = document.activeElement as HTMLElement | null;
    closeRef.current?.focus();

    function onKey(event: KeyboardEvent) {
      if (event.key === "Escape") {
        event.preventDefault();
        onClose();
      }
      if (event.key === "Tab" && panelRef.current) {
        const focusable = [
          ...panelRef.current.querySelectorAll<HTMLElement>(
            'button:not([disabled]), a[href], input, select, textarea, [tabindex]:not([tabindex="-1"])',
          ),
        ].filter((node) => !node.hasAttribute("disabled"));
        if (focusable.length === 0) return;
        const first = focusable[0];
        const last = focusable[focusable.length - 1];
        if (event.shiftKey && document.activeElement === first) {
          event.preventDefault();
          last.focus();
        } else if (!event.shiftKey && document.activeElement === last) {
          event.preventDefault();
          first.focus();
        }
      }
    }

    window.addEventListener("keydown", onKey);
    return () => {
      window.removeEventListener("keydown", onKey);
      if (triggerRef?.current) {
        triggerRef.current.focus();
      } else {
        previous?.focus?.();
      }
    };
  }, [onClose, open, triggerRef]);

  if (!open) return null;

  const profileHref =
    profile?.kind === "company"
      ? `/panel/firma-profil/${profile.id}?conversation=${conversationId}`
      : `/panel/profil/${profile?.id}?conversation=${conversationId}`;

  return (
    <div className="fixed inset-0 z-[60] flex items-end justify-center bg-[#0f1f1d]/45 p-0 sm:items-stretch sm:justify-end sm:bg-transparent sm:p-0">
      <button
        type="button"
        aria-label="Profil panelini kapat"
        className="absolute inset-0 sm:bg-[#0f1f1d]/35"
        onClick={onClose}
      />
      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-label="Katılımcı profili"
        className="relative z-[61] max-h-[88dvh] w-full overflow-y-auto rounded-t-[24px] border border-teal-900/10 bg-white p-5 shadow-[0_-20px_60px_rgba(15,31,29,0.18)] motion-reduce:transition-none sm:fixed sm:inset-y-0 sm:right-0 sm:max-h-none sm:w-[min(100%,420px)] sm:rounded-none sm:rounded-l-[24px] sm:border-l sm:p-6"
      >
        <div className="mx-auto mb-4 h-1 w-10 rounded-full bg-teal-900/10 sm:hidden" />
        <div className="flex items-start justify-between gap-3">
          <p className="text-sm font-semibold text-teal-950">Profil</p>
          <button
            ref={closeRef}
            type="button"
            onClick={onClose}
            className="rounded-lg p-1.5 text-teal-900/45 hover:bg-teal-900/5"
            aria-label="Kapat"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {loading ? (
          <p className="mt-8 text-sm text-black/45">Profil yükleniyor…</p>
        ) : error ? (
          <p className="mt-8 text-sm text-rose-700">{error}</p>
        ) : profile ? (
          <div className="mt-5">
            <div className="flex items-start gap-4">
              <ProfileAvatar profile={profile} />
              <div className="min-w-0 flex-1">
                <h2 className="truncate text-xl font-semibold text-[#0f1f1d]">
                  {profile.displayName}
                </h2>
                <p className="mt-1 inline-flex items-center gap-1.5 text-xs font-medium text-teal-900/55">
                  {profile.accountType === "company" ? (
                    <>
                      <Building2 className="h-3.5 w-3.5" />
                      Firma hesabı
                    </>
                  ) : (
                    <>
                      <UserRound className="h-3.5 w-3.5" />
                      Kişisel hesap
                    </>
                  )}
                </p>
                {profile.kind === "company" && profile.representativeName ? (
                  <p className="mt-1 text-xs text-black/45">
                    Temsilci: {profile.representativeName}
                  </p>
                ) : null}
                <div className="mt-2">
                  <TrustSummaryBadge summary={profile.trust} />
                </div>
              </div>
            </div>

            {profile.locationLabel ? (
              <p className="mt-4 inline-flex items-center gap-2 text-sm text-black/55">
                <MapPin className="h-4 w-4 shrink-0" />
                {profile.locationLabel}
              </p>
            ) : null}

            <p className="mt-3 text-xs text-black/40">
              Üyelik: {profile.memberSinceLabel}
            </p>

            {profile.expertiseCategories.length > 0 ? (
              <div className="mt-4">
                <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-black/35">
                  Uzmanlık / kategoriler
                </p>
                <div className="mt-2 flex flex-wrap gap-1.5">
                  {profile.expertiseCategories.map((category) => (
                    <span
                      key={category}
                      className="rounded-full bg-[#eef6f4] px-2.5 py-1 text-xs font-medium text-teal-900/70"
                    >
                      {category}
                    </span>
                  ))}
                </div>
              </div>
            ) : null}

            {profile.trust.reviewCount > 0 &&
            profile.trust.averageRating != null ? (
              <div className="mt-4 rounded-xl bg-[#f7fbfa] px-3.5 py-3">
                <p className="inline-flex items-center gap-1.5 text-sm font-semibold text-teal-950">
                  <Star className="h-4 w-4 fill-amber-400 text-amber-400" />
                  {formatAverageRating(profile.trust.averageRating)} ·{" "}
                  {formatReviewCount(profile.trust.reviewCount)}
                </p>
                <p className="mt-1 text-xs text-black/45">
                  {profile.trust.completedTransactions} tamamlanan işlem
                </p>
              </div>
            ) : profile.trust.completedTransactions > 0 ? (
              <p className="mt-4 text-sm text-black/55">
                {profile.trust.completedTransactions} tamamlanan işlem
              </p>
            ) : null}

            {profile.verifiedIndicators.length > 0 ? (
              <ul className="mt-4 space-y-1">
                {profile.verifiedIndicators.map((item) => (
                  <li
                    key={item}
                    className="inline-flex items-center gap-1.5 text-xs font-medium text-teal-800"
                  >
                    <CheckCircle2 className="h-3.5 w-3.5" />
                    {item}
                  </li>
                ))}
              </ul>
            ) : null}

            {profile.biography ? (
              <p className="mt-4 text-sm leading-6 text-black/65">
                {profile.biography}
              </p>
            ) : null}

            <Link
              href={profileHref}
              className="mt-6 inline-flex min-h-11 w-full items-center justify-center rounded-xl bg-[#0f1f1d] px-4 text-sm font-semibold text-white"
            >
              Profili görüntüle
            </Link>
          </div>
        ) : null}
      </div>
    </div>
  );
}

export function PublicProfileCard({ profile }: { profile: PublicProfileDto }) {
  return (
    <div className="rounded-[28px] border border-black/[0.06] bg-white p-6 shadow-[0_18px_60px_rgba(0,0,0,0.04)]">
      <div className="flex items-start gap-4">
        <ProfileAvatar profile={profile} />
        <div>
          <h1 className="text-3xl font-semibold tracking-tight">
            {profile.displayName}
          </h1>
          <p className="mt-1 text-sm text-black/45">
            {profile.accountType === "company" ? "Firma profili" : "Kişisel profil"}
          </p>
          {profile.kind === "company" && profile.representativeName ? (
            <p className="mt-1 text-sm text-black/45">
              Temsilci: {profile.representativeName}
            </p>
          ) : null}
          <div className="mt-2">
            <TrustSummaryBadge summary={profile.trust} />
          </div>
        </div>
      </div>

      {profile.locationLabel ? (
        <p className="mt-5 inline-flex items-center gap-2 text-sm text-black/55">
          <MapPin className="h-4 w-4" />
          {profile.locationLabel}
        </p>
      ) : null}

      <p className="mt-2 text-xs text-black/40">
        Üyelik: {profile.memberSinceLabel}
      </p>

      {profile.expertiseCategories.length > 0 ? (
        <div className="mt-5 flex flex-wrap gap-1.5">
          {profile.expertiseCategories.map((category) => (
            <span
              key={category}
              className="rounded-full bg-[#eef6f4] px-2.5 py-1 text-xs font-medium text-teal-900/70"
            >
              {category}
            </span>
          ))}
        </div>
      ) : null}

      {profile.biography ? (
        <p className="mt-5 text-sm leading-7 text-black/65">{profile.biography}</p>
      ) : null}
    </div>
  );
}
