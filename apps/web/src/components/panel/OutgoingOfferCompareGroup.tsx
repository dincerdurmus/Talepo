import type { IncomingRequestSummaryData } from "@/components/panel/IncomingOfferCompareGroup";
import { RequestCompareSummary } from "@/components/panel/IncomingOfferCompareGroup";
import { CollapsibleOfferGroup } from "@/components/panel/CollapsibleOfferGroup";
import { OfferCollapsedSummary } from "@/components/panel/OfferCollapsedSummary";
import { OfferCompareRail } from "@/components/panel/OfferCompareRail";
import {
  OutgoingOfferCard,
  type OutgoingOfferCardData,
} from "@/components/panel/OutgoingOfferCard";
import {
  isActionRequiredOffer,
} from "@/lib/offer/offer-card-status";
import { canArchiveOffer } from "@/lib/offer/offer-archive";
import type { OfferCompleteness } from "@/lib/offer/offer-completeness";

export function OutgoingOfferCompareGroup({
  request,
  offer,
  completeness,
  canMutate,
  highlight,
  highlightNegotiationId,
  isUnread = false,
  archivedOfferIds,
  archiveView = false,
}: {
  request: IncomingRequestSummaryData;
  offer: OutgoingOfferCardData;
  completeness?: OfferCompleteness;
  canMutate: boolean;
  highlight?: boolean;
  highlightNegotiationId?: string | null;
  isUnread?: boolean;
  archivedOfferIds?: ReadonlySet<string>;
  archiveView?: boolean;
}) {
  const cardInput = {
    status: offer.status,
    negotiations: offer.negotiations,
  };
  const isActionRequired = isActionRequiredOffer("seller", cardInput);
  const archivedSet = archivedOfferIds ?? new Set<string>();
  const isArchived = archivedSet.has(offer.id);
  const canArchive = canArchiveOffer({
    offer: cardInput,
    isUnread,
    isActionRequired,
  });

  return (
    <CollapsibleOfferGroup
      offerId={offer.id}
      viewer="seller"
      offer={cardInput}
      isUnread={isUnread}
      isActionRequired={isActionRequired}
      isDeepLinked={Boolean(highlight)}
      header={
        <OfferCollapsedSummary
          viewer="seller"
          offer={{
            status: offer.status,
            negotiations: offer.negotiations,
            amount: offer.amount,
            currency: offer.currency,
            createdAt: offer.createdAt,
          }}
          title={request.title}
          roleLabel="Alıcı talebi"
          city={request.city}
          isUnread={isUnread}
          photoCount={offer.mediaIds.length}
          thumbnail={{
            coverImageUrl: request.coverImageUrl,
            categorySlug: request.categorySlug,
            categoryName: request.categoryName,
            requestTitle: request.title,
          }}
        />
      }
    >
      <div
        id={`teklif-${offer.id}`}
        className={
          highlight ? "rounded-b-[24px] ring-2 ring-inset ring-amber-300/70" : ""
        }
      >
        <div className="flex flex-col overflow-x-hidden lg:grid lg:grid-cols-[minmax(0,17.5rem)_9.5rem_minmax(0,1fr)]">
          <RequestCompareSummary
            request={request}
            sticky={false}
            eyebrow="Müşterinin talebi"
            detailHref={`/panel/talepler/${request.id}`}
            detailLabel="Talebi aç"
          />
          <OfferCompareRail
            viewer="seller"
            offer={cardInput}
            amount={offer.amount}
            currency={offer.currency}
            budgetMin={request.budgetMin}
            budgetMax={request.budgetMax}
            requestCurrency={request.currency}
          />
          <OutgoingOfferCard
            offer={offer}
            completeness={completeness}
            canMutate={canMutate}
            isUnread={isUnread}
            compareStripLayout
            canArchive={canArchive}
            isArchived={isArchived || archiveView}
            highlightNegotiationId={highlight ? highlightNegotiationId : null}
          />
        </div>
      </div>
    </CollapsibleOfferGroup>
  );
}
