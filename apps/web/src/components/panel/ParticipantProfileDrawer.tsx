"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import {
  Building2,
  CheckCircle2,
  MapPin,
  MessageSquare,
  UserRound,
  X,
} from "lucide-react";

import {
  SignalOrbitDecor,
  signalHeroSurface,
  signalSurface,
} from "@/components/panel/profile/ProfileSignal";
import {
  ProfileTrustDrawerFollowUp,
  ProfileTrustHeroMetrics,
  ProfileTrustPublicSections,
} from "@/components/panel/profile/ProfileTrustSurface";
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

function ProfileAvatar({
  profile,
  size = "md",
}: {
  profile: PublicProfileDto;
  size?: "md" | "lg";
}) {
  const label = profile.displayName;
  const dim = size === "lg" ? "h-20 w-20 text-xl" : "h-16 w-16 text-lg";
  if (profile.avatarUrl) {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src={profile.avatarUrl}
        alt={label}
        className={`${dim} rounded-full border border-teal-900/10 object-cover shadow-[0_0_0_3px_rgba(15,118,110,0.08)]`}
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
    <div
      className={`flex ${dim} items-center justify-center rounded-full bg-[#0f766e] font-semibold text-white shadow-[0_0_0_3px_rgba(15,118,110,0.12)]`}
    >
      {initials || "?"}
    </div>
  );
}

function DrawerSkeleton() {
  return (
    <div
      className="mt-5 space-y-4 motion-reduce:animate-none"
      aria-busy="true"
      aria-label="Profil yükleniyor"
    >
      <div className="flex gap-4">
        <div className="h-16 w-16 shrink-0 rounded-full bg-gradient-to-r from-teal-950/[0.06] via-teal-950/[0.1] to-teal-950/[0.06] bg-[length:200%_100%] motion-safe:animate-[signalShimmer_1.4s_ease-in-out_infinite]" />
        <div className="flex-1 space-y-2 pt-1">
          <div className="h-5 w-36 rounded bg-teal-950/[0.08]" />
          <div className="h-3 w-24 rounded bg-teal-950/[0.05]" />
          <div className="h-3 w-28 rounded bg-teal-950/[0.05]" />
        </div>
      </div>
      <div className="h-16 rounded-xl bg-teal-950/[0.04]" />
      <div className="h-24 rounded-xl bg-teal-950/[0.04]" />
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
    <div className="fixed inset-0 z-[60] flex items-end justify-center bg-[#0f1f1d]/45 p-0 motion-reduce:transition-none sm:items-stretch sm:justify-end sm:bg-transparent">
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
        className="relative z-[61] max-h-[88dvh] w-full overflow-y-auto rounded-t-[24px] border border-teal-900/10 bg-[#fafdfc] p-5 shadow-[0_-20px_60px_rgba(15,31,29,0.18)] motion-safe:transition-transform motion-safe:duration-300 motion-safe:ease-out motion-reduce:transition-none sm:fixed sm:inset-y-0 sm:right-0 sm:max-h-none sm:w-[min(100%,420px)] sm:rounded-none sm:rounded-l-[24px] sm:border-l sm:p-6"
      >
        <div className="mx-auto mb-4 h-1 w-10 rounded-full bg-teal-900/10 sm:hidden" />
        <div className="flex items-start justify-between gap-3">
          <p className="text-sm font-semibold text-teal-950">Profil</p>
          <button
            ref={closeRef}
            type="button"
            onClick={onClose}
            className="min-h-11 min-w-11 rounded-lg p-1.5 text-teal-900/45 hover:bg-teal-900/5"
            aria-label="Kapat"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {loading ? (
          <DrawerSkeleton />
        ) : error ? (
          <p className="mt-8 text-sm text-rose-700">{error}</p>
        ) : profile ? (
          <div className="mt-5 space-y-4">
            <div className={`${signalHeroSurface} p-4`}>
              <SignalOrbitDecor />
              <div className="relative flex items-start gap-4">
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
                        Kişisel profil
                      </>
                    )}
                  </p>
                  {profile.kind === "company" && profile.representativeName ? (
                    <p className="mt-1 text-xs text-teal-950/45">
                      Temsilci: {profile.representativeName}
                    </p>
                  ) : null}
                </div>
              </div>

              {profile.locationLabel ? (
                <p className="relative mt-3 inline-flex items-center gap-2 text-sm text-teal-950/55">
                  <MapPin className="h-4 w-4 shrink-0" />
                  {profile.locationLabel}
                </p>
              ) : null}

              <p className="relative mt-1 text-xs text-teal-950/40">
                Üyelik: {profile.memberSinceLabel}
              </p>

              <div className="relative mt-3">
                <ProfileTrustHeroMetrics trust={profile.trust} />
              </div>

              {profile.verifiedIndicators.length > 0 ? (
                <ul className="relative mt-3 flex flex-wrap gap-1.5">
                  {profile.verifiedIndicators.map((item) => (
                    <li
                      key={item}
                      className="inline-flex items-center gap-1 rounded-full border border-teal-900/10 bg-white/70 px-2 py-0.5 text-[11px] font-medium text-teal-800"
                    >
                      <CheckCircle2 className="h-3 w-3" />
                      {item}
                    </li>
                  ))}
                </ul>
              ) : null}
            </div>

            {profile.expertiseCategories.length > 0 ? (
              <div className={`${signalSurface} p-4`}>
                <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-teal-950/40">
                  Uzmanlık alanları
                </p>
                <div className="mt-2 flex flex-wrap gap-1.5">
                  {profile.expertiseCategories.map((category) => (
                    <span
                      key={category}
                      className="rounded-full bg-teal-950/[0.04] px-2.5 py-1 text-xs font-medium text-teal-900/70"
                    >
                      {category}
                    </span>
                  ))}
                </div>
              </div>
            ) : null}

            <ProfileTrustDrawerFollowUp trust={profile.trust} />

            {profile.biography ? (
              <p className="text-sm leading-6 text-teal-950/65">{profile.biography}</p>
            ) : null}

            <Link
              href={profileHref}
              className="inline-flex min-h-11 w-full items-center justify-center rounded-xl bg-[#0f1f1d] px-4 text-sm font-semibold text-white transition hover:bg-black"
            >
              Tam profili görüntüle
            </Link>
          </div>
        ) : null}
      </div>
    </div>
  );
}

export function PublicProfileCard({
  profile,
  conversationBackHref,
  backLabel = "Mesajlaşmaya dön",
  previewMode = false,
}: {
  profile: PublicProfileDto;
  conversationBackHref?: string;
  backLabel?: string;
  previewMode?: boolean;
}) {
  const [bioExpanded, setBioExpanded] = useState(false);
  const bio = profile.biography?.trim() ?? "";
  const bioPreview =
    bio.length > 280 && !bioExpanded ? `${bio.slice(0, 280).trim()}…` : bio;

  return (
    <div className="mx-auto w-full max-w-4xl space-y-5">
      <div className={`${signalHeroSurface} p-5 sm:p-6`}>
        <SignalOrbitDecor />
        <div className="relative flex flex-col gap-5 lg:flex-row lg:items-start lg:justify-between">
          <div className="flex min-w-0 items-start gap-4">
            <ProfileAvatar profile={profile} size="lg" />
            <div className="min-w-0">
              <h1 className="text-3xl font-semibold tracking-tight text-[#0f1f1d] sm:text-4xl">
                {profile.displayName}
              </h1>
              <p className="mt-1 text-sm text-teal-950/50">
                {profile.accountType === "company" ? "Firma profili" : "Kişisel profil"}
              </p>
              {profile.kind === "company" && profile.representativeName ? (
                <p className="mt-1 text-sm text-teal-950/45">
                  Temsilci: {profile.representativeName}
                </p>
              ) : null}
              {profile.locationLabel ? (
                <p className="mt-3 inline-flex items-center gap-2 text-sm text-teal-950/55">
                  <MapPin className="h-4 w-4 shrink-0" />
                  {profile.locationLabel} · {profile.memberSinceLabel}
                </p>
              ) : (
                <p className="mt-3 text-sm text-teal-950/45">
                  {profile.memberSinceLabel}
                </p>
              )}
              <div className="mt-3 flex flex-wrap items-center gap-2">
                <ProfileTrustHeroMetrics trust={profile.trust} />
              </div>
              {profile.verifiedIndicators.length > 0 ? (
                <ul className="mt-3 flex flex-wrap gap-1.5">
                  {profile.verifiedIndicators.map((item) => (
                    <li
                      key={item}
                      className="inline-flex items-center gap-1 rounded-full border border-teal-900/10 bg-white/70 px-2.5 py-1 text-xs font-medium text-teal-900/75"
                    >
                      <CheckCircle2 className="h-3.5 w-3.5" />
                      {item}
                    </li>
                  ))}
                </ul>
              ) : null}
            </div>
          </div>

          {!previewMode && conversationBackHref ? (
            <div className="hidden shrink-0 lg:block">
              <Link
                href={conversationBackHref}
                className="inline-flex min-h-11 items-center gap-2 rounded-full border border-teal-900/12 bg-white/70 px-5 py-2.5 text-sm font-semibold text-teal-950 transition hover:border-teal-800/25 hover:shadow-[0_0_0_3px_rgba(15,118,110,0.08)]"
              >
                <MessageSquare className="h-4 w-4" />
                {backLabel}
              </Link>
              <p className="mt-2 max-w-[220px] text-[11px] leading-5 text-teal-950/40">
                Doğrudan telefon veya e-posta paylaşımı yapılmaz.
              </p>
            </div>
          ) : null}
        </div>

        {!previewMode && conversationBackHref ? (
          <div className="relative mt-5 lg:hidden">
            <Link
              href={conversationBackHref}
              className="inline-flex min-h-11 w-full items-center justify-center gap-2 rounded-xl bg-[#0f1f1d] px-4 text-sm font-semibold text-white"
            >
              <MessageSquare className="h-4 w-4" />
              {backLabel}
            </Link>
            <p className="mt-2 text-center text-[11px] leading-5 text-teal-950/40">
              Doğrudan telefon veya e-posta paylaşımı yapılmaz.
            </p>
          </div>
        ) : null}
      </div>

      {bio ? (
        <div className={`${signalSurface} p-5 sm:p-6`}>
          <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-teal-950/40">
            Hakkında
          </p>
          <p className="mt-2 text-sm leading-7 text-teal-950/65">{bioPreview}</p>
          {bio.length > 280 ? (
            <button
              type="button"
              onClick={() => setBioExpanded((value) => !value)}
              className="mt-2 text-sm font-semibold text-teal-800"
            >
              {bioExpanded ? "Daha az göster" : "Devamını oku"}
            </button>
          ) : null}
        </div>
      ) : null}

      {profile.expertiseCategories.length > 0 ? (
        <div className={`${signalSurface} p-5 sm:p-6`}>
          <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-teal-950/40">
            Uzmanlık alanları
          </p>
          <div className="mt-2 flex flex-wrap gap-1.5">
            {profile.expertiseCategories.map((category) => (
              <span
                key={category}
                className="rounded-full bg-teal-950/[0.04] px-2.5 py-1 text-xs font-medium text-teal-900/70"
              >
                {category}
              </span>
            ))}
          </div>
        </div>
      ) : null}

      <ProfileTrustPublicSections profile={profile} />
    </div>
  );
}
