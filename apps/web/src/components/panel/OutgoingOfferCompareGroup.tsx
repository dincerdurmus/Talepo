import type { IncomingRequestSummaryData } from "@/components/panel/IncomingOfferCompareGroup";
import { RequestCompareSummary } from "@/components/panel/IncomingOfferCompareGroup";
import { OfferDeepLinkTarget } from "@/components/panel/OfferDeepLinkTarget";
import {
  OutgoingOfferCard,
  type OutgoingBudgetContext,
  type OutgoingOfferCardData,
} from "@/components/panel/OutgoingOfferCard";
import type { OfferCompleteness } from "@/lib/offer/offer-completeness";

export function OutgoingOfferCompareGroup({
  request,
  offer,
  completeness,
  canMutate,
  highlight,
  highlightNegotiationId,
}: {
  request: IncomingRequestSummaryData;
  offer: OutgoingOfferCardData;
  completeness?: OfferCompleteness;
  canMutate: boolean;
  highlight?: boolean;
  highlightNegotiationId?: string | null;
}) {
  const budget: OutgoingBudgetContext = {
    budgetMin: request.budgetMin,
    budgetMax: request.budgetMax,
    currency: request.currency,
  };

  return (
    <OfferDeepLinkTarget offerId={offer.id} active={Boolean(highlight)}>
      <section className="talepo-card overflow-hidden">
        <header className="flex flex-wrap items-end justify-between gap-3 border-b border-teal-900/[0.06] px-4 py-3.5 sm:px-5">
          <div className="min-w-0">
            <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-teal-900/45">
              Talep ve teklif karşılaştırması
            </p>
            <h2 className="mt-1 text-lg font-semibold tracking-tight text-[#0f1f1d]">
              {request.title}
            </h2>
          </div>
        </header>

        <div className="lg:grid lg:grid-cols-[17.5rem_minmax(0,1fr)]">
          <RequestCompareSummary
            request={request}
            sticky={false}
            eyebrow="Müşterinin talebi"
            detailHref={`/panel/talepler/${request.id}`}
            detailLabel="Talebi aç"
          />
          <OutgoingOfferCard
            offer={offer}
            budget={budget}
            completeness={completeness}
            canMutate={canMutate}
            highlightNegotiationId={highlight ? highlightNegotiationId : null}
          />
        </div>
      </section>
    </OfferDeepLinkTarget>
  );
}
