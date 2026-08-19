"use client";

import Link from "next/link";
import { useCallback, useRef, useState } from "react";
import { ArrowLeft, FileText } from "lucide-react";

import { ConversationMessageList } from "@/components/panel/ConversationMessageList";
import { DealOutcomePanel } from "@/components/panel/DealOutcomePanel";
import { DealReviewPanel } from "@/components/panel/DealReviewPanel";
import { MessageComposer } from "@/components/panel/MessageComposer";
import { ParticipantProfileDrawer } from "@/components/panel/ParticipantProfileDrawer";
import { TrustSummaryBadge } from "@/components/panel/TrustSummaryBadge";
import type { MessageRow } from "@/lib/message/attachment-group";
import type { DealReviewDto, TrustSummary } from "@/lib/offer/deal-review";
import type { PublicProfileDto } from "@/lib/profile/public-profile";

type ConversationShellProps = {
  conversationId: string;
  viewerUserId: string;
  counterpartLabel: string;
  counterpartUserId: string;
  requestTitle: string;
  requestCity: string | null;
  requestHref: string;
  offerAccepted: boolean;
  isSupplier: boolean;
  providerTrust: TrustSummary | null;
  messages: MessageRow[];
  dealOutcome: {
    id: string;
    status: string;
    confirmationLevel: string;
    agreedPrice: number | null;
    currency: string;
    buyerConfirmedAt: string | null;
    supplierConfirmedAt: string | null;
    completedAt: string | null;
  } | null;
  dealRole: "buyer" | "supplier" | null;
  dealCompleted: boolean;
  reviewState: {
    ownReview: DealReviewDto | null;
    oppositeReview: DealReviewDto | null;
    canCreateReview: boolean;
    windowExpired: boolean;
    reviewDeadlineLabel: string | null;
  };
};

export function ConversationShell({
  conversationId,
  viewerUserId,
  counterpartLabel,
  counterpartUserId,
  requestTitle,
  requestCity,
  requestHref,
  offerAccepted,
  isSupplier,
  providerTrust,
  messages,
  dealOutcome,
  dealRole,
  dealCompleted,
  reviewState,
}: ConversationShellProps) {
  const profileTriggerRef = useRef<HTMLButtonElement>(null);
  const [profileOpen, setProfileOpen] = useState(false);
  const [profile, setProfile] = useState<PublicProfileDto | null>(null);
  const [profileLoading, setProfileLoading] = useState(false);
  const [profileError, setProfileError] = useState<string | null>(null);

  const openProfile = useCallback(
    async (userId?: string) => {
      setProfileOpen(true);
      setProfileLoading(true);
      setProfileError(null);
      setProfile(null);

      try {
        const params = new URLSearchParams();
        if (userId) params.set("userId", userId);
        const response = await fetch(
          `/api/conversations/${conversationId}/participant-profile?${params}`,
        );
        const data = (await response.json()) as {
          profile?: PublicProfileDto;
          message?: string;
        };
        if (!response.ok || !data.profile) {
          setProfileError(data.message ?? "Profil yüklenemedi.");
          return;
        }
        setProfile(data.profile);
      } catch {
        setProfileError("Bağlantı hatası.");
      } finally {
        setProfileLoading(false);
      }
    },
    [conversationId],
  );

  return (
    <>
      <header className="rounded-2xl border border-teal-900/8 bg-gradient-to-br from-white via-[#f8fcfb] to-[#eef6f8] px-5 py-4 shadow-[0_12px_40px_rgba(15,118,110,0.04)]">
        <div className="flex items-center justify-between gap-3">
          <Link
            href="/panel/mesajlar"
            className="flex items-center gap-2 text-sm font-medium text-slate-500 transition hover:text-teal-900"
          >
            <ArrowLeft className="h-4 w-4" />
            Mesajlar
          </Link>
          <button
            ref={profileTriggerRef}
            type="button"
            onClick={() => void openProfile(counterpartUserId)}
            className="flex min-w-0 items-center gap-2 text-sm font-semibold text-slate-800 underline-offset-2 hover:underline"
            aria-label={`${counterpartLabel} profilini görüntüle`}
          >
            <span className="truncate">{counterpartLabel}</span>
            {providerTrust ? <TrustSummaryBadge summary={providerTrust} /> : null}
          </button>
        </div>

        <Link
          href={requestHref}
          className="mt-3 flex items-start gap-3 rounded-xl border border-teal-800/12 bg-[#f0faf7] px-3.5 py-3 transition hover:border-teal-700/25 hover:bg-[#e7f7f2]"
        >
          <span className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-teal-800/10 text-teal-800">
            <FileText className="h-4 w-4" />
          </span>
          <span className="min-w-0">
            <span className="text-[10px] font-semibold uppercase tracking-[0.12em] text-teal-800/55">
              Talep başlığı
            </span>
            <span className="mt-0.5 block truncate text-sm font-semibold text-teal-950">
              {requestTitle}
            </span>
            {requestCity ? (
              <span className="mt-0.5 block text-xs text-teal-900/50">
                {requestCity}
              </span>
            ) : null}
          </span>
        </Link>

        {dealOutcome && dealRole ? (
          <>
            <DealOutcomePanel
              compact
              dealOutcome={dealOutcome}
              role={dealRole}
            />
            {dealCompleted ? (
              <DealReviewPanel
                compact
                dealOutcomeId={dealOutcome.id}
                existingReview={reviewState.ownReview}
                oppositeReview={reviewState.oppositeReview}
                canCreateReview={reviewState.canCreateReview}
                windowExpired={reviewState.windowExpired}
                reviewDeadlineLabel={reviewState.reviewDeadlineLabel}
              />
            ) : null}
          </>
        ) : null}
      </header>

      {!offerAccepted ? (
        <p className="mt-4 rounded-xl border border-amber-200/80 bg-amber-50 px-4 py-3 text-sm leading-6 text-amber-950/80">
          Bu yazışma salt okunur. Fiyat pazarlığı karşı teklif turlarıyla
          yapılır; yeni mesaj ancak anlaşmadan sonra gönderilebilir.
        </p>
      ) : null}

      <section className="mt-5 flex min-h-[420px] flex-col overflow-hidden rounded-2xl border border-teal-900/8 bg-white shadow-[0_18px_55px_rgba(15,118,110,0.05)]">
        <div className="flex-1 space-y-3.5 overflow-y-auto bg-gradient-to-b from-[#f7fbfa] to-white p-5 sm:p-6">
          <ConversationMessageList
            messages={messages}
            viewerUserId={viewerUserId}
            onOpenProfile={(userId, displayName) => {
              void openProfile(userId);
              if (displayName) {
                /* displayName used for aria only */
              }
            }}
          />
        </div>

        <MessageComposer
          conversationId={conversationId}
          canSend={offerAccepted}
          canSendImages={offerAccepted && isSupplier}
        />
      </section>

      <ParticipantProfileDrawer
        open={profileOpen}
        profile={profile}
        conversationId={conversationId}
        loading={profileLoading}
        error={profileError}
        onClose={() => setProfileOpen(false)}
        triggerRef={profileTriggerRef}
      />
    </>
  );
}
