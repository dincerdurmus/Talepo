"use client";

import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";
import { ArrowLeft } from "lucide-react";

import { ConversationCategoryArt } from "@/components/panel/ConversationCategoryArt";
import { ConversationMessageList } from "@/components/panel/ConversationMessageList";
import { ConversationProcessRail } from "@/components/panel/ConversationProcessRail";
import { DealOutcomePanel } from "@/components/panel/DealOutcomePanel";
import { DealReviewPanel } from "@/components/panel/DealReviewPanel";
import { MessageComposer } from "@/components/panel/MessageComposer";
import { ParticipantProfileDrawer } from "@/components/panel/ParticipantProfileDrawer";
import { TrustSummaryBadge } from "@/components/panel/TrustSummaryBadge";
import type { MessageRow } from "@/lib/message/attachment-group";
import type { ConversationProcessStep } from "@/lib/message/conversation-process";
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
  coverImageUrl?: string | null;
  categorySlug?: string | null;
  offerAccepted: boolean;
  isSupplier: boolean;
  providerTrust: TrustSummary | null;
  messages: MessageRow[];
  processSteps: ConversationProcessStep[];
  amountLabel: string | null;
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
  coverImageUrl,
  categorySlug,
  offerAccepted,
  isSupplier,
  providerTrust,
  messages,
  processSteps,
  amountLabel,
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

  const identityMark = counterpartLabel.trim().charAt(0).toUpperCase() || "T";
  const feedRef = useRef<HTMLDivElement>(null);
  const lastMessageId = messages[messages.length - 1]?.id;

  useEffect(() => {
    const node = feedRef.current;
    if (!node) return;
    node.scrollTop = node.scrollHeight;
  }, [lastMessageId]);

  return (
    <div className="talepo-conversation">
      <header className="talepo-conversation-header">
        <ConversationCategoryArt
          coverImageUrl={coverImageUrl}
          categorySlug={categorySlug}
          className="talepo-conversation-header-art"
        />
        <div className="talepo-conversation-header-body">
          <Link
            href="/panel/mesajlar"
            className="talepo-conversation-header-back"
          >
            <ArrowLeft className="h-3.5 w-3.5" />
            Mesajlar
          </Link>
          <p className="talepo-conversation-header-status">
            {offerAccepted ? "Yazışma açık" : "Salt okunur"}
          </p>
          <div className="talepo-conversation-header-identity">
            <span className="talepo-conversation-header-mark" aria-hidden>
              {identityMark}
            </span>
            <div className="talepo-conversation-header-copy">
              <div className="talepo-conversation-header-name">
                <button
                  ref={profileTriggerRef}
                  type="button"
                  onClick={() => void openProfile(counterpartUserId)}
                  className="talepo-conversation-header-person"
                  aria-label={`${counterpartLabel} profilini görüntüle`}
                >
                  {counterpartLabel}
                </button>
                {providerTrust ? (
                  <span className="talepo-conversation-header-trust">
                    <TrustSummaryBadge summary={providerTrust} />
                  </span>
                ) : null}
              </div>
              <Link href={requestHref} className="talepo-conversation-request">
                {requestTitle}
                {requestCity ? ` · ${requestCity}` : ""}
              </Link>
            </div>
          </div>
        </div>
      </header>

      {processSteps.length > 0 ? (
        <details className="talepo-conversation-process--mobile">
          <summary>Süreç</summary>
          <ConversationProcessRail
            steps={processSteps}
            amountLabel={amountLabel}
            heading={false}
          />
        </details>
      ) : null}

      {!offerAccepted ? (
        <p className="talepo-activity-alert mt-3" role="status">
          Bu yazışma salt okunur. Fiyat pazarlığı karşı teklif turlarıyla
          yapılır; yeni mesaj ancak anlaşmadan sonra gönderilebilir.
        </p>
      ) : null}

      <div className="talepo-conversation-layout">
        <div className="talepo-conversation-main">
          <section className="talepo-conversation-thread">
            <div ref={feedRef} className="talepo-conversation-feed space-y-3">
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

          {dealOutcome && dealRole ? (
            <div className="talepo-conversation-lifecycle">
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
            </div>
          ) : null}
        </div>

        {processSteps.length > 0 ? (
          <div className="talepo-conversation-process--desktop">
            <ConversationProcessRail
              steps={processSteps}
              amountLabel={amountLabel}
            />
          </div>
        ) : null}
      </div>

      <ParticipantProfileDrawer
        open={profileOpen}
        profile={profile}
        conversationId={conversationId}
        loading={profileLoading}
        error={profileError}
        onClose={() => setProfileOpen(false)}
        triggerRef={profileTriggerRef}
      />
    </div>
  );
}
