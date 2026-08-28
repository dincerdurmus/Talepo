"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useState } from "react";
import { MessageCircle } from "lucide-react";

import { IncomingOfferGallery } from "@/components/panel/IncomingOfferGallery";
import { NegotiationHistory } from "@/components/panel/NegotiationHistory";
import { OfferActions } from "@/components/panel/OfferActions";
import { OfferMessageBlock } from "@/components/panel/OfferMessageBlock";
import { OfferArchiveActions } from "@/components/panel/OfferArchiveActions";
import { OfferNegotiationPanel } from "@/components/panel/OfferNegotiationPanel";
import { OfferWaitingFooter } from "@/components/panel/OfferWaitingFooter";
import { useOfferGroupLiveUnread } from "@/components/panel/OfferGroupLiveUnreadContext";
import { formatOfferMoney } from "@/lib/offer/budget-offer-compare";
import { resolveOfferCommercialAmount } from "@/lib/offer/commercial-amount";
import {
  isActionRequiredOffer,
  resolveOfferCardStatusHeader,
  resolveOfferPriceCaption,
} from "@/lib/offer/offer-card-status";
import type { OfferCompleteness } from "@/lib/offer/offer-completeness";
import type { OfferNegotiationDto } from "@/lib/offer/offer-negotiation";
import { currentPendingNegotiation } from "@/lib/offer/outgoing-offer-inbox";

export type OutgoingOfferCardData = {
  id: string;
  requestId: string;
  amount: number;
  currency: string;
  deliveryDays: number | null;
  title: string | null;
  description: string;
  status: string;
  createdAt?: string | null;
  conversationId: string | null;
  mediaIds: string[];
  negotiations: OfferNegotiationDto[];
};

export function OutgoingOfferCard({
  offer,
  completeness,
  canMutate,
  highlightNegotiationId,
  isUnread: isUnreadProp = false,
  compareStripLayout = false,
  canArchive = false,
  isArchived = false,
}: {
  offer: OutgoingOfferCardData;
  completeness?: OfferCompleteness;
  canMutate: boolean;
  highlightNegotiationId?: string | null;
  isUnread?: boolean;
  compareStripLayout?: boolean;
  canArchive?: boolean;
  isArchived?: boolean;
}) {
  const router = useRouter();
  const isUnread = useOfferGroupLiveUnread(isUnreadProp);
  const [composerOpen, setComposerOpen] = useState(false);
  const [panelBusy, setPanelBusy] = useState<string | null>(null);
  const [negotiationSent, setNegotiationSent] = useState(false);

  const amount = offer.amount;
  const pendingNegotiation = currentPendingNegotiation(offer.negotiations);
  const acceptedNegotiation = offer.negotiations.find(
    (row) => row.status === "ACCEPTED",
  );
  const commercialAmount = resolveOfferCommercialAmount({
    offerAmount: amount,
    acceptedNegotiationAmount: acceptedNegotiation?.amount ?? null,
  });
  const awaiting = ["SUBMITTED", "VIEWED"].includes(offer.status);
  const myPending =
    Boolean(pendingNegotiation) &&
    pendingNegotiation?.proposedBySide === "PROVIDER";
  const canRespond = Boolean(
    canMutate && awaiting && pendingNegotiation && !myPending,
  );
  const canPropose = Boolean(
    canMutate && awaiting && pendingNegotiation && !myPending,
  );
  const showActions = canMutate && awaiting && !myPending && Boolean(pendingNegotiation);
  const busy = Boolean(panelBusy);
  const originalLabel = formatOfferMoney(amount, offer.currency);
  const pendingLabel = pendingNegotiation
    ? formatOfferMoney(pendingNegotiation.amount, offer.currency)
    : null;
  const cardInput = {
    status: offer.status,
    negotiations: offer.negotiations,
  };
  const actionRequired = isActionRequiredOffer("seller", cardInput);
  const statusHeader = resolveOfferCardStatusHeader("seller", cardInput, {
    isUnread,
  });
  const showWaitingFooter =
    awaiting &&
    !showActions &&
    !composerOpen &&
    !negotiationSent &&
    (myPending ||
      statusHeader === "Satıcının yanıtı bekleniyor" ||
      statusHeader === "Alıcının yanıtı bekleniyor");
  const waitingHint = myPending
    ? "Alıcı yanıt verdiğinde bildirim alırsınız."
    : "Teklifiniz alıcıda; yanıt gelince burada görürsünüz.";

  const displayAmount = pendingNegotiation
    ? pendingNegotiation.amount
    : offer.status === "ACCEPTED"
      ? commercialAmount
      : amount;
  const decisionAmountLabel = Number.isFinite(displayAmount)
    ? formatOfferMoney(displayAmount, offer.currency)
    : undefined;

  const sectionOrder = compareStripLayout ? "order-2" : "";
  const noteOrder = compareStripLayout ? "order-3" : "";
  const galleryOrder = compareStripLayout ? "order-4" : "";
  const historyOrder = compareStripLayout ? "order-5" : "";
  const panelOrder = compareStripLayout ? "order-6" : "";
  const footerOrder = compareStripLayout ? "order-9" : "";
  const terminalOrder = compareStripLayout ? "order-10" : "";
  const archiveOrder = compareStripLayout ? "order-11" : "";

  const postPending = useCallback(
    async (action: "accept" | "reject"): Promise<void> => {
      if (panelBusy) {
        throw new Error("İşlem devam ediyor.");
      }
      const response = await fetch(`/api/offers/${offer.id}/negotiations`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action }),
      });
      const result = (await response.json()) as {
        message?: string;
        redirectTo?: string;
      };
      if (!response.ok) {
        throw new Error(result.message || "İşlem tamamlanamadı.");
      }
      if (result.redirectTo) {
        router.push(result.redirectTo);
      }
    },
    [offer.id, panelBusy, router],
  );

  return (
    <article
      className={`min-w-0 bg-[#f4faf9] px-4 py-4 sm:px-5 ${
        compareStripLayout ? "flex flex-col" : ""
      }`}
    >
      <div className={`flex flex-wrap items-center gap-2 ${compareStripLayout ? "order-1" : ""}`}>
        {isUnread ? (
          <span className="rounded-full bg-[#0f766e] px-2 py-0.5 text-[11px] font-semibold text-white">
            Yeni
          </span>
        ) : null}
      </div>

      {isUnread ? (
        <p className={`sr-only ${compareStripLayout ? "order-1" : ""}`}>Okunmadı</p>
      ) : null}

      <div className={compareStripLayout ? "order-1" : ""}>
        <p
          className={`mt-2 text-sm font-semibold ${
            actionRequired
              ? "text-amber-950"
              : statusHeader === "Kabul edildi"
                ? "text-teal-900"
                : statusHeader === "Reddedildi"
                  ? "text-[#6b7280]"
                  : "text-[#0f1f1d]"
          }`}
        >
          {statusHeader}
        </p>

        {!compareStripLayout ? (
          <>
            <p
              className={`mt-3 text-[1.85rem] font-semibold leading-none tracking-tight tabular-nums ${
                pendingNegotiation ? "text-amber-950" : "text-[#0f1f1d]"
              }`}
            >
              {Number.isFinite(displayAmount)
                ? formatOfferMoney(displayAmount, offer.currency)
                : "—"}
            </p>
            <p className="mt-1.5 text-[11px] font-medium text-black/40">
              {resolveOfferPriceCaption("seller", {
                status: offer.status,
                amount,
                currency: offer.currency,
                negotiations: offer.negotiations,
              })}
            </p>
          </>
        ) : (
          <p
            className={`mt-3 text-xl font-semibold leading-none tracking-tight tabular-nums lg:sr-only ${
              pendingNegotiation ? "text-amber-950" : "text-[#0f1f1d]"
            }`}
          >
            {Number.isFinite(displayAmount)
              ? formatOfferMoney(displayAmount, offer.currency)
              : "—"}
          </p>
        )}
      </div>

      <div className={sectionOrder}>
        <OfferMessageBlock
          label="Teklif mesajınız"
          message={offer.description}
          emptyLabel="Bu teklife henüz açıklama eklemediniz."
        />
      </div>

      {canMutate ? (
        <Link
          href={`/panel/talepler/${offer.requestId}/teklif`}
          className={`${noteOrder} mt-3 inline-flex min-h-11 items-center text-sm font-semibold text-teal-900/80 hover:underline`}
        >
          Notu güncelle
        </Link>
      ) : null}

      <div className={galleryOrder}>
        <IncomingOfferGallery
          offerId={offer.id}
          mediaIds={offer.mediaIds}
          sellerName="Teklifiniz"
        />
      </div>

      <div className={historyOrder}>
        <NegotiationHistory
          viewer="seller"
          originalAmount={amount}
          currency={offer.currency}
          offerStatus={offer.status}
          offerCreatedAt={offer.createdAt}
          negotiations={offer.negotiations}
          highlightNegotiationId={highlightNegotiationId}
          deliveryDays={offer.deliveryDays}
          completeness={completeness}
        />
      </div>

      {canMutate || composerOpen ? (
        <div className={panelOrder}>
          <OfferNegotiationPanel
            offerId={offer.id}
            originalAmount={amount}
            currency={offer.currency}
            offerStatus={offer.status}
            viewer="provider"
            negotiations={offer.negotiations}
            canMutate={canMutate}
            hideTriggers
            composerOpen={composerOpen}
            onComposerOpenChange={setComposerOpen}
            onBusyChange={setPanelBusy}
            onProposeSuccess={() => setNegotiationSent(true)}
            bargainCopy
          />
        </div>
      ) : null}

      {showActions ? (
        <div className={footerOrder}>
          <OfferActions
            offerId={offer.id}
            hasPendingNegotiation={Boolean(pendingNegotiation)}
            originalAmountLabel={originalLabel}
            acceptAmountLabel={decisionAmountLabel}
            showBargain={canPropose}
            onBargain={() => setComposerOpen(true)}
            bargainDisabled={busy || composerOpen}
            locked={Boolean(panelBusy)}
            layout="footer"
            composerOpen={composerOpen}
            negotiationSent={negotiationSent}
            negotiationSubmitting={panelBusy === "propose"}
            waitingMessage="Alıcının yanıtı bekleniyor"
            waitingHint="Alıcı yanıt verdiğinde bildirim alırsınız."
            pendingCounter={
              canRespond && pendingNegotiation
                ? {
                    amountLabel: pendingLabel ?? originalLabel,
                    acceptLabel: `${pendingLabel} teklifini kabul et`,
                    rejectLabel: "Pazarlık teklifini reddet",
                    hideOfferLifecycle: true,
                    onAccept: () => postPending("accept"),
                    onReject: () => postPending("reject"),
                  }
                : undefined
            }
          />
        </div>
      ) : null}

      {showWaitingFooter ? (
        <div className={footerOrder}>
          <OfferWaitingFooter message={statusHeader} hint={waitingHint} />
        </div>
      ) : null}

      {offer.status === "ACCEPTED" && offer.conversationId ? (
        <Link
          href={`/panel/mesajlar/${offer.conversationId}`}
          prefetch={false}
          className={`${terminalOrder} mt-4 inline-flex min-h-11 w-full items-center justify-center gap-2 rounded-xl bg-[#0f1f1d] px-4 text-sm font-semibold text-white`}
        >
          <MessageCircle className="h-3.5 w-3.5" />
          Mesajlara git
        </Link>
      ) : null}

      <div className={archiveOrder}>
        <OfferArchiveActions
          offerId={offer.id}
          role="seller"
          canArchive={canArchive}
          isArchived={isArchived}
        />
      </div>
    </article>
  );
}
