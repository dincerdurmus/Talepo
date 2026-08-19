"use client";

import Link from "next/link";
import { useCallback, useEffect, useId, useRef, useState } from "react";
import {
  ArrowLeft,
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
import { OfferCompareRail } from "@/components/panel/OfferCompareRail";
import { OfferCompareToggle } from "@/components/panel/OfferCompareToggle";
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

  return (
    <div className="space-y-3 pb-[calc(5.5rem+env(safe-area-inset-bottom,0px))] lg:space-y-4 lg:pb-0">
      <section className="talepo-card overflow-hidden">
        <div className="flex items-center gap-3 px-3 py-2.5 sm:px-4 sm:py-3">
          <div className="h-[4.5rem] w-[4.5rem] shrink-0 sm:h-20 sm:w-20">
            <IncomingRequestCover
              coverImageUrl={request.coverImageUrl}
              categorySlug={request.categorySlug}
              categoryName={request.categoryName}
              requestTitle={request.title}
              compact
            />
          </div>
          <div className="min-w-0 flex-1">
            <Link
              href={inboxBackHref}
              className="inline-flex min-h-9 items-center gap-1 text-xs font-medium text-black/45 hover:text-black/70 sm:text-sm"
            >
              <ArrowLeft className="h-3.5 w-3.5 shrink-0" aria-hidden />
              Gelen teklifler
            </Link>
            <div className="mt-0.5 flex min-w-0 flex-wrap items-baseline gap-x-2 gap-y-0.5">
              <h1 className="truncate text-base font-semibold tracking-tight text-[#0f1f1d] sm:text-lg">
                {request.title}
              </h1>
              {request.city ? (
                <span className="inline-flex shrink-0 items-center gap-0.5 text-xs text-black/45">
                  <MapPin className="h-3 w-3" aria-hidden />
                  {request.city}
                </span>
              ) : null}
              {request.budgetLabel ? (
                <span className="inline-flex shrink-0 items-center gap-0.5 text-xs text-black/45">
                  <Wallet className="h-3 w-3" aria-hidden />
                  {request.budgetLabel}
                </span>
              ) : null}
            </div>
            <p className="mt-0.5 line-clamp-1 text-xs text-teal-950/70 sm:text-sm">
              {statsLine}
            </p>
            <Link
              href={`/panel/taleplerim/${request.id}`}
              className="mt-1 inline-flex min-h-9 items-center text-xs font-semibold text-[#0f766e] hover:underline sm:text-sm"
            >
              Talebi aç
            </Link>
          </div>
        </div>
      </section>

      {rankedForCompare.length >= 2 ? (
        <div className="rounded-2xl border border-teal-900/10 bg-white">
          <button
            type="button"
            aria-expanded={compareOpen}
            aria-controls={comparePanelId}
            onClick={() => setCompareOpen((value) => !value)}
            className="flex min-h-11 w-full items-center justify-between gap-3 px-4 py-3 text-left"
          >
            <span className="inline-flex items-center gap-2 text-sm font-semibold text-[#0f1f1d]">
              <GitCompareArrows className="h-4 w-4" aria-hidden />
              Teklifleri karşılaştır
            </span>
            <span className="text-xs text-black/40">
              {compareOpen ? "Gizle" : "Göster"}
            </span>
          </button>
          {compareOpen ? (
            <div
              id={comparePanelId}
              className="border-t border-teal-900/8 px-4 py-3"
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

      <div className="grid min-w-0 gap-3 lg:grid-cols-[minmax(260px,300px)_minmax(0,1fr)] lg:items-start lg:gap-4">
        <section
          className={`min-w-0 space-y-2 lg:max-h-[calc(100dvh-12rem)] lg:overflow-y-auto ${
            mobileView === "detail" ? "hidden lg:block" : ""
          }`}
          aria-label="Teklif listesi"
        >
          <h2 className="px-1 text-[11px] font-semibold uppercase tracking-[0.12em] text-teal-950/40">
            Teklifler
          </h2>
          {offers.map((row) => {
            const firmName =
              row.card.companyName || row.card.submittedByName || "Firma";
            return (
              <div key={row.card.id} id={`workspace-offer-${row.card.id}`}>
                <IncomingOfferWorkspaceListItem
                  offerId={row.card.id}
                  firmName={firmName}
                  amount={row.card.amount}
                  currency={row.card.currency}
                  deliveryDays={row.card.deliveryDays}
                  status={row.card.status}
                  negotiations={row.card.negotiations}
                  createdAt={row.card.createdAt ?? new Date().toISOString()}
                  photoCount={row.card.mediaIds.length}
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
              onClick={() => setMobileView("list")}
              className="mb-2 inline-flex min-h-11 items-center gap-1.5 text-sm font-semibold text-[#0f766e] lg:hidden"
            >
              <ArrowLeft className="h-4 w-4" aria-hidden />
              Tekliflere dön
            </button>
          ) : null}

          {selected ? (
            <div className="talepo-card relative min-w-0 overflow-hidden">
              <h2
                ref={detailHeadingRef}
                tabIndex={-1}
                className="border-b border-teal-900/8 px-4 py-2.5 text-[11px] font-semibold uppercase tracking-[0.12em] text-teal-950/40 outline-none"
              >
                Seçilen teklif
              </h2>
              <div className="flex min-w-0 flex-col overflow-x-hidden lg:grid lg:grid-cols-[5.75rem_minmax(0,1fr)]">
                <OfferCompareRail
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
                <OfferGroupLiveUnreadProvider isUnread={selectedUnread}>
                  <IncomingOfferCard
                    offer={selected.card}
                    actionable={selected.actionable}
                    completeness={selected.completeness}
                    trust={selected.trust}
                    rank={selected.rank}
                    isUnread={selectedUnread}
                    compareStripLayout
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
              </div>
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
            <div className="talepo-card px-5 py-10 text-center text-sm text-black/45">
              Görüntülemek için bir teklif seçin.
            </div>
          )}
        </section>
      </div>
    </div>
  );
}
