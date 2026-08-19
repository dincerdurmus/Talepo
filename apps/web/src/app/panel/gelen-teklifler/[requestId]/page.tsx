import { notFound, redirect } from "next/navigation";

import { IncomingOfferWorkspace } from "@/components/panel/IncomingOfferWorkspace";
import { compareOffersByCompleteness } from "@/lib/offer/offer-completeness";
import {
  buildIncomingOffersInboxPath,
  buildIncomingRequestWorkspacePath,
  classifyIncomingOfferInbox,
  isBuyerActionableIncomingOffer,
  parseIncomingOfferInboxDurum,
  resolveIncomingOfferInboxFilter,
} from "@/lib/offer/incoming-offer-inbox";
import {
  mapIncomingOfferCardData,
  mapIncomingRequestSummary,
} from "@/lib/offer/incoming-offer-mapper";
import { filterOffersByArchiveView, parseOfferArchiveView } from "@/lib/offer/offer-archive";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/server/auth/require-user";
import { listArchivedOfferIds } from "@/server/offer/offer-archive-service";
import {
  loadBuyerIncomingOffers,
} from "@/server/offer/load-buyer-incoming-offers";
import {
  loadProviderTrustSummaries,
  trustForOfferProvider,
} from "@/server/offer/trust-summary";

export default async function IncomingOfferRequestWorkspacePage({
  params,
  searchParams,
}: {
  params: Promise<{ requestId: string }>;
  searchParams: Promise<{ teklif?: string; tur?: string; durum?: string; gorunum?: string }>;
}) {
  const user = await requireUser();
  const { requestId } = await params;
  const { teklif, tur, durum, gorunum } = await searchParams;
  const archiveView = parseOfferArchiveView(gorunum) === "archive";
  const highlightOfferId = teklif?.trim() || null;
  const highlightNegotiationId = tur?.trim() || null;
  const parsedDurum = parseIncomingOfferInboxDurum(durum);

  const request = await prisma.request.findFirst({
    where: {
      id: requestId,
      createdById: user.id,
      deletedAt: null,
    },
    select: { id: true },
  });

  if (!request) notFound();

  const { offers: allOffers, archivedOfferIds, unreadOfferIds } =
    await loadBuyerIncomingOffers(user.id);

  const requestOffers = allOffers.filter((row) => row.request.id === requestId);
  if (requestOffers.length === 0) notFound();

  const visibleOffers = filterOffersByArchiveView(
    requestOffers,
    archivedOfferIds,
    archiveView ? "archive" : "active",
  );

  if (visibleOffers.length === 0) notFound();

  const highlightOffer = highlightOfferId
    ? visibleOffers.find((row) => row.id === highlightOfferId) ?? null
    : null;

  if (highlightOfferId && !highlightOffer) notFound();

  if (
    highlightOffer &&
    archivedOfferIds.has(highlightOffer.id) &&
    !archiveView
  ) {
    redirect(
      buildIncomingRequestWorkspacePath({
        requestId,
        filter: parsedDurum.filter,
        teklif: highlightOfferId,
        tur: highlightNegotiationId,
        archiveView: true,
      }),
    );
  }

  const resolvedFilter = resolveIncomingOfferInboxFilter({
    requested: parsedDurum.filter,
    explicit: parsedDurum.explicit,
    highlightBucket: highlightOffer
      ? classifyIncomingOfferInbox(highlightOffer)
      : null,
  });
  if (resolvedFilter.redirect) {
    redirect(
      buildIncomingRequestWorkspacePath({
        requestId,
        filter: resolvedFilter.filter,
        teklif: highlightOfferId,
        tur: highlightNegotiationId,
        archiveView,
      }),
    );
  }

  const activeFilter = resolvedFilter.filter;
  const inboxBackHref = buildIncomingOffersInboxPath({
    filter: activeFilter,
    archiveView,
  });

  const requestSummary = mapIncomingRequestSummary(visibleOffers[0]!.request);
  const trustSummaries = await loadProviderTrustSummaries({
    personalUserIds: visibleOffers
      .filter((offer) => !offer.company)
      .map((offer) => offer.submittedBy.id),
    companyIds: visibleOffers
      .map((offer) => offer.company?.id)
      .filter((id): id is string => Boolean(id)),
  });

  const pending = visibleOffers.filter((offer) =>
    ["SUBMITTED", "VIEWED"].includes(offer.status),
  );
  const others = visibleOffers.filter(
    (offer) => !["SUBMITTED", "VIEWED"].includes(offer.status),
  );

  const rankedPending = compareOffersByCompleteness(
    pending.map((offer) => ({
      ...offer,
      companyVerified: Boolean(offer.company?.isVerified),
    })),
  );

  const workspaceOffers = [
    ...rankedPending.map((offer, index) => ({
      offer,
      rank: pending.length >= 2 ? index + 1 : undefined,
      actionable: true as const,
    })),
    ...others.map((offer) => ({
      offer,
      rank: undefined as number | undefined,
      actionable: false as const,
    })),
  ].map(({ offer, rank, actionable }) => ({
    card: mapIncomingOfferCardData(offer),
    trust: trustForOfferProvider(trustSummaries, offer),
    completeness: rankedPending.find((row) => row.id === offer.id)?.completeness,
    rank,
    actionable,
  }));

  const unreadList = [...unreadOfferIds];
  const archivedList = [...archivedOfferIds];

  return (
    <IncomingOfferWorkspace
      request={requestSummary}
      offers={workspaceOffers}
      initialOfferId={highlightOfferId ?? workspaceOffers[0]?.card.id ?? null}
      highlightNegotiationId={highlightNegotiationId}
      inboxBackHref={inboxBackHref}
      archiveView={archiveView}
      unreadOfferIds={unreadList}
      archivedOfferIds={archivedList}
      requestStats={{
        totalOffers: visibleOffers.length,
        unreadCount: visibleOffers.filter((row) => unreadOfferIds.has(row.id))
          .length,
        actionRequiredCount: visibleOffers.filter(isBuyerActionableIncomingOffer)
          .length,
      }}
    />
  );
}
