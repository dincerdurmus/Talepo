"use client";

import Link from "next/link";
import { useCallback, useEffect, useId, useRef, useState } from "react";
import {
  ArrowLeft,
  ArrowRight,
  GitCompareArrows,
  MapPin,
  Wallet,
} from "lucide-react";

import {
  IncomingOfferCard,
  type IncomingOfferCardData,
} from "@/components/panel/IncomingOfferCard";
import { IncomingOfferWorkspaceListItem } from "@/components/panel/IncomingOfferWorkspaceListItem";
import { IncomingRequestCover } from "@/components/panel/IncomingRequestCover";
import { OfferCardSeenMarker } from "@/components/panel/OfferCardSeenMarker";
import { OfferCompareToggle } from "@/components/panel/OfferCompareToggle";
import { OfferDecisionStrip } from "@/components/panel/OfferDecisionStrip";
import { OfferGroupLiveUnreadProvider } from "@/components/panel/OfferGroupLiveUnreadContext";
import type { IncomingRequestSummaryData } from "@/components/panel/IncomingOfferCompareGroup";
import { compareOffersByCompleteness } from "@/lib/offer/offer-completeness";
import { canArchiveOffer } from "@/lib/offer/offer-archive";
import { isActionRequiredOffer } from "@/lib/offer/offer-card-status";
import { buildIncomingRequestWorkspacePath } from "@/lib/offer/incoming-offer-inbox";
import type { TrustSummary } from "@/lib/offer/deal-review";

type WorkspaceOffer = {
  card: IncomingOfferCardData;
  trust?: TrustSummary;
  completeness?: ReturnType<typeof compareOffersByCompleteness>[number]["completeness"];
  rank?: number;
  actionable: boolean;
};

export function IncomingOfferWorkspace({
  request,
  offers,
  initialOfferId,
  highlightNegotiationId,
  inboxBackHref,
  archiveView = false,
  unreadOfferIds,
  archivedOfferIds,
  requestStats,
}: {
  request: IncomingRequestSummaryData;
  offers: WorkspaceOffer[];
  initialOfferId: string | null;
  highlightNegotiationId?: string | null;
  inboxBackHref: string;
  archiveView?: boolean;
  unreadOfferIds: string[];
  archivedOfferIds: string[];
  requestStats: {
    totalOffers: number;
    unreadCount: number;
    actionRequiredCount: number;
  };
}) {
  const unreadSet = new Set(unreadOfferIds);
  const archivedSet = new Set(archivedOfferIds);
  const detailHeadingRef = useRef<HTMLHeadingElement>(null);
  const listHeadingRef = useRef<HTMLHeadingElement>(null);
  const comparePanelId = useId();

  const defaultOfferId =
    initialOfferId && offers.some((row) => row.card.id === initialOfferId)
      ? initialOfferId
      : offers[0]?.card.id ?? null;

  const [selectedOfferId, setSelectedOfferId] = useState(defaultOfferId);
  const [mobileView, setMobileView] = useState<"list" | "detail">(
    initialOfferId ? "detail" : "list",
  );
  const [compareOpen, setCompareOpen] = useState(false);
  const [seenGeneration, setSeenGeneration] = useState<string | null>(null);

  const selected = offers.find((row) => row.card.id === selectedOfferId) ?? null;

  const selectOffer = useCallback(
    (offerId: string) => {
      setSelectedOfferId(offerId);
      setMobileView("detail");
      const url = buildIncomingRequestWorkspacePath({
        requestId: request.id,
        teklif: offerId,
        tur: highlightNegotiationId,
        archiveView,
      });
      window.history.replaceState(null, "", url);
    },
    [archiveView, highlightNegotiationId, request.id],
  );

  const returnToOfferList = useCallback(() => {
    setMobileView("list");
    window.requestAnimationFrame(() => {
      const selectedButton = selectedOfferId
        ? document.querySelector<HTMLElement>(
            `#workspace-offer-${selectedOfferId} button`,
          )
        : null;
      if (selectedButton) {
        selectedButton.focus();
        return;
      }
      listHeadingRef.current?.focus();
    });
  }, [selectedOfferId]);

  useEffect(() => {
    if (mobileView !== "detail" || !selected) return;
    detailHeadingRef.current?.focus();
  }, [mobileView, selected?.card.id]);

  useEffect(() => {
    if (!initialOfferId) return;
    const node = document.getElementById(`workspace-offer-${initialOfferId}`);
    node?.scrollIntoView({ block: "nearest", behavior: "smooth" });
  }, [initialOfferId]);

  const rankedForCompare = compareOffersByCompleteness(
    offers
      .filter((row) => ["SUBMITTED", "VIEWED"].includes(row.card.status))
      .map((row) => ({
        id: row.card.id,
        amount: row.card.amount,
        currency: row.card.currency,
        deliveryDays: row.card.deliveryDays,
        description: row.card.description,
        mediaCount: row.card.mediaIds.length,
        companyVerified: row.card.companyVerified,
      })),
  );

  const selectedUnread = selected ? unreadSet.has(selected.card.id) : false;

  const statsLine = [
    `${requestStats.totalOffers} teklif`,
    requestStats.unreadCount > 0 ? `${requestStats.unreadCount} yeni` : null,
    requestStats.actionRequiredCount > 0
      ? `${requestStats.actionRequiredCount} yanıtınız bekleniyor`
      : null,
  ]
    .filter(Boolean)
    .join(" · ");

  const metaLine = [
    request.city,
    request.budgetLabel,
  ]
    .filter(Boolean)
    .join(" · ");

  return (
    <div className="space-y-3 pb-[calc(5.5rem+env(safe-area-inset-bottom,0px))] lg:space-y-3.5 lg:pb-0">
      <Link
        href={inboxBackHref}
        className="inline-flex min-h-10 items-center gap-2 rounded-full px-2.5 py-1.5 text-sm font-medium text-teal-950/65 transition hover:bg-black/[0.03] hover:text-teal-950 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal-700/35 focus-visible:ring-offset-2"
      >
        <ArrowLeft className="h-4 w-4 shrink-0" aria-hidden />
        Gelen tekliflere dön
      </Link>

      <section className="overflow-hidden rounded-[18px] border border-teal-900/8 bg-[linear-gradient(135deg,#FAFCFB_0%,#F5F8F7_100%)] px-3 py-2.5 sm:px-4 sm:py-3">
        <div className="flex items-center gap-3">
          <div className="h-14 w-14 shrink-0 sm:h-16 sm:w-16">
            <IncomingRequestCover
              coverImageUrl={request.coverImageUrl}
              categorySlug={request.categorySlug}
              categoryName={request.categoryName}
              requestTitle={request.title}
              compact
            />
          </div>
          <div className="min-w-0 flex-1">
            <h1 className="truncate text-[15px] font-semibold tracking-tight text-[#0f1f1d] sm:text-base">
              {request.title}
            </h1>
            {metaLine ? (
              <p className="mt-0.5 flex min-w-0 flex-wrap items-center gap-x-2 gap-y-0.5 text-[12px] text-black/45">
                {request.city ? (
                  <span className="inline-flex items-center gap-0.5">
                    <MapPin className="h-3 w-3" aria-hidden />
                    {request.city}
                  </span>
                ) : null}
                {request.budgetLabel ? (
                  <span className="inline-flex items-center gap-0.5">
                    <Wallet className="h-3 w-3" aria-hidden />
                    {request.budgetLabel}
                  </span>
                ) : null}
              </p>
            ) : null}
            <p className="mt-0.5 line-clamp-1 text-[12px] text-teal-950/65">
              {statsLine}
            </p>
          </div>
          <Link
            href={`/panel/taleplerim/${request.id}`}
            className="inline-flex min-h-10 shrink-0 items-center gap-1 rounded-xl border border-teal-900/10 bg-white/80 px-3 text-[12px] font-semibold text-teal-900/80 transition hover:bg-white"
          >
            Talebi aç
            <ArrowRight className="h-3.5 w-3.5" aria-hidden />
          </Link>
        </div>
      </section>

      {rankedForCompare.length >= 2 ? (
        <div className="overflow-hidden rounded-[16px] border border-teal-900/8 bg-[linear-gradient(135deg,#FAFCFB_0%,#F4F7F6_100%)]">
          <button
            type="button"
            aria-expanded={compareOpen}
            aria-controls={comparePanelId}
            onClick={() => setCompareOpen((value) => !value)}
            className="flex min-h-12 w-full items-center gap-3 px-3.5 py-2.5 text-left transition hover:bg-white/50 sm:px-4"
          >
            <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-[12px] bg-[#f4efe6] text-[#8a6a3d] ring-1 ring-amber-900/5">
              <GitCompareArrows className="h-4 w-4" aria-hidden />
            </span>
            <span className="min-w-0 flex-1">
              <span className="block text-sm font-semibold text-[#0f1f1d]">
                Teklifleri karşılaştır
              </span>
              <span className="mt-0.5 block text-[12px] text-black/40">
                {rankedForCompare.length} teklifi yan yana inceleyin
              </span>
            </span>
            <span className="shrink-0 rounded-full border border-teal-900/10 bg-white px-2.5 py-1 text-[11px] font-semibold text-teal-950/65">
              {compareOpen ? "Gizle" : "Göster"}
            </span>
          </button>
          {compareOpen ? (
            <div
              id={comparePanelId}
              className="border-t border-teal-900/8 bg-white/70 px-3.5 py-3 sm:px-4"
            >
              <OfferCompareToggle
                offers={rankedForCompare.map((row) => {
                  const source = offers.find((item) => item.card.id === row.id);
                  const card = source?.card;
                  return {
                    id: row.id,
                    firmName:
                      card?.companyName || card?.submittedByName || "Firma",
                    amount: row.amount,
                    deliveryDays: row.deliveryDays,
                    completeness: row.completeness,
                    verified: card?.companyVerified ?? false,
                  };
                })}
              />
            </div>
          ) : null}
        </div>
      ) : null}

      <div className="grid min-w-0 gap-3 lg:grid-cols-[minmax(260px,30%)_minmax(0,1fr)] lg:items-start lg:gap-4">
        <section
          className={`min-w-0 space-y-2 lg:sticky lg:top-4 lg:max-h-[calc(100dvh-8rem)] lg:overflow-y-auto lg:pr-0.5 ${
            mobileView === "detail" ? "hidden lg:block" : ""
          }`}
          aria-label="Teklif listesi"
        >
          <h2
            ref={listHeadingRef}
            tabIndex={-1}
            className="px-1 text-[11px] font-semibold uppercase tracking-[0.12em] text-teal-950/40 outline-none"
          >
            Teklifler
          </h2>
          {offers.map((row) => {
            const firmName =
              row.card.companyName || row.card.submittedByName || "Firma";
            return (
              <div key={row.card.id} id={`workspace-offer-${row.card.id}`}>
                <IncomingOfferWorkspaceListItem
                  firmName={firmName}
                  amount={row.card.amount}
                  currency={row.card.currency}
                  deliveryDays={row.card.deliveryDays}
                  status={row.card.status}
                  negotiations={row.card.negotiations}
                  description={row.card.description}
                  createdAt={row.card.createdAt ?? new Date().toISOString()}
                  updatedAt={row.card.updatedAt ?? undefined}
                  photoCount={row.card.mediaIds.length}
                  budgetMin={request.budgetMin}
                  budgetMax={request.budgetMax}
                  requestCurrency={request.currency}
                  trust={row.trust}
                  isSelected={selectedOfferId === row.card.id}
                  isUnread={unreadSet.has(row.card.id)}
                  onSelect={() => selectOffer(row.card.id)}
                />
              </div>
            );
          })}
        </section>

        <section
          className={`min-w-0 ${mobileView === "list" ? "hidden lg:block" : ""}`}
          aria-label="Seçilen teklif"
        >
          {mobileView === "detail" ? (
            <button
              type="button"
              onClick={returnToOfferList}
              className="mb-2 inline-flex min-h-10 items-center gap-2 rounded-full px-2.5 py-1.5 text-sm font-medium text-teal-950/65 transition hover:bg-black/[0.03] lg:hidden"
            >
              <ArrowLeft className="h-4 w-4 shrink-0" aria-hidden />
              Teklif listesine dön
            </button>
          ) : null}

          {selected ? (
            <div className="relative min-w-0 overflow-hidden rounded-[20px] border border-teal-900/10 bg-white shadow-[0_10px_36px_rgba(15,31,29,0.04)]">
              <h2
                ref={detailHeadingRef}
                tabIndex={-1}
                className="border-b border-teal-900/8 px-4 py-2 text-[11px] font-semibold uppercase tracking-[0.12em] text-teal-950/40 outline-none sm:px-5"
              >
                Seçilen teklif
              </h2>
              <div className="px-4 pt-2.5 sm:px-5">
                <OfferDecisionStrip
                  viewer="buyer"
                  offer={{
                    status: selected.card.status,
                    negotiations: selected.card.negotiations,
                  }}
                  amount={selected.card.amount}
                  currency={selected.card.currency}
                  budgetMin={request.budgetMin}
                  budgetMax={request.budgetMax}
                  requestCurrency={request.currency}
                />
              </div>
              <OfferGroupLiveUnreadProvider isUnread={selectedUnread}>
                <IncomingOfferCard
                  offer={selected.card}
                  actionable={selected.actionable}
                  completeness={selected.completeness}
                  trust={selected.trust}
                  rank={selected.rank}
                  isUnread={selectedUnread}
                  compareStripLayout
                  decisionDesk
                  canArchive={canArchiveOffer({
                    offer: {
                      status: selected.card.status,
                      negotiations: selected.card.negotiations,
                    },
                    isUnread: selectedUnread,
                    isActionRequired: isActionRequiredOffer("buyer", {
                      status: selected.card.status,
                      negotiations: selected.card.negotiations,
                    }),
                  })}
                  isArchived={
                    archivedSet.has(selected.card.id) || archiveView
                  }
                  highlightNegotiationId={
                    selectedOfferId === initialOfferId
                      ? highlightNegotiationId
                      : null
                  }
                />
              </OfferGroupLiveUnreadProvider>
              {selectedUnread ? (
                <OfferCardSeenMarker
                  offerId={selected.card.id}
                  role="buyer"
                  active
                  enabled={seenGeneration !== selected.card.id}
                  onSeen={() => setSeenGeneration(selected.card.id)}
                />
              ) : null}
            </div>
          ) : (
            <div className="rounded-[20px] border border-teal-900/8 bg-white px-5 py-10 text-center text-sm text-black/45">
              Görüntülemek için bir teklif seçin.
            </div>
          )}
        </section>
      </div>
    </div>
  );
}
