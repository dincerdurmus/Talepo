import Link from "next/link";
import { redirect } from "next/navigation";
import { ArrowRight, GitCompareArrows } from "lucide-react";

import {
  IncomingOfferCompareGroup,
  type IncomingRequestSummaryData,
} from "@/components/panel/IncomingOfferCompareGroup";
import {
  type IncomingOfferCardData,
} from "@/components/panel/IncomingOfferCard";
import {
  IncomingOfferInboxEmpty,
  IncomingOfferInboxFilters,
} from "@/components/panel/IncomingOfferInboxFilters";
import { MarkAllOfferInboxReadButton } from "@/components/panel/MarkAllOfferInboxReadButton";
import { OfferCompareToggle } from "@/components/panel/OfferCompareToggle";
import { EmptyIllustration } from "@/components/visuals/EmptyIllustration";
import { formatRequestQuantity } from "@/lib/offer/budget-offer-compare";
import {
  buildIncomingOffersPath,
  classifyIncomingOfferInbox,
  countIncomingOfferInbox,
  isBuyerActionableIncomingOffer,
  offerMatchesIncomingInboxFilter,
  parseIncomingOfferInboxDurum,
  resolveIncomingOfferInboxFilter,
} from "@/lib/offer/incoming-offer-inbox";
import { listUnreadIncomingOfferIds } from "@/lib/offer/offer-event-unread";
import {
  filterOffersByArchiveView,
  parseOfferArchiveView,
} from "@/lib/offer/offer-archive";
import { compareOffersByCompleteness } from "@/lib/offer/offer-completeness";
import {
  offerNegotiationListInclude,
  toOfferNegotiationDtos,
  type OfferNegotiationDto,
} from "@/lib/offer/offer-negotiation";
import { prisma } from "@/lib/prisma";
import { formatListingBudget } from "@/lib/visuals/category-visuals";
import { requireUser } from "@/server/auth/require-user";
import { listArchivedOfferIds } from "@/server/offer/offer-archive-service";
import {
  loadProviderTrustSummaries,
  trustForOfferProvider,
} from "@/server/offer/trust-summary";

type OfferRow = {
  id: string;
  amount: unknown;
  currency: string;
  deliveryDays: number | null;
  title: string | null;
  description: string;
  validUntil: Date | null;
  status: string;
  createdAt: Date;
  request: {
    id: string;
    title: string;
    city: string | null;
    status: string;
    coverImageUrl: string | null;
    budgetMin: unknown;
    budgetMax: unknown;
    currency: string;
    category: { name: string; slug: string };
    fieldValues: Array<{
      textValue: string | null;
      numberValue: unknown;
    }>;
  };
  company: { id: string; name: string; isVerified: boolean } | null;
  submittedBy: { id: string; name: string | null };
  conversation: { id: string } | null;
  media: { id: string }[];
  negotiations: Array<{
    id: string;
    amount: unknown;
    currency: string;
    proposedBySide: OfferNegotiationDto["proposedBySide"];
    status: OfferNegotiationDto["status"];
    createdAt: Date;
    respondedAt?: Date | null;
  }>;
};

function toNumber(value: unknown): number | null {
  if (value == null || value === "") return null;
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
}

function toCardData(offer: OfferRow): IncomingOfferCardData {
  return {
    id: offer.id,
    amount: Number(offer.amount),
    currency: offer.currency,
    deliveryDays: offer.deliveryDays,
    title: offer.title,
    description: offer.description,
    status: offer.status,
    companyName: offer.company?.name ?? null,
    companyVerified: Boolean(offer.company?.isVerified),
    submittedByName: offer.submittedBy.name,
    conversationId: offer.conversation?.id ?? null,
    mediaIds: offer.media.map((item) => item.id),
    negotiations: toOfferNegotiationDtos(offer.negotiations),
    createdAt: offer.createdAt.toISOString(),
  };
}

function toRequestSummary(request: OfferRow["request"]): IncomingRequestSummaryData {
  const quantity = request.fieldValues[0];
  const budgetMin = toNumber(request.budgetMin);
  const budgetMax = toNumber(request.budgetMax);
  return {
    id: request.id,
    title: request.title,
    city: request.city,
    status: request.status,
    coverImageUrl: request.coverImageUrl,
    categorySlug: request.category.slug,
    categoryName: request.category.name,
    quantityLabel: formatRequestQuantity({
      textValue: quantity?.textValue ?? null,
      numberValue: toNumber(quantity?.numberValue),
    }),
    budgetMin,
    budgetMax,
    currency: request.currency,
    budgetLabel: formatListingBudget(budgetMin, budgetMax, request.currency),
  };
}

export default async function IncomingOffersPage({
  searchParams,
}: {
  searchParams: Promise<{ teklif?: string; tur?: string; durum?: string; gorunum?: string }>;
}) {
  const user = await requireUser();
  const { teklif, tur, durum, gorunum } = await searchParams;
  const archiveView = parseOfferArchiveView(gorunum) === "archive";
  const highlightOfferId = teklif?.trim() || null;
  const highlightNegotiationId = tur?.trim() || null;
  const parsedDurum = parseIncomingOfferInboxDurum(durum);

  const offers = (await prisma.offer.findMany({
    where: {
      request: {
        createdById: user.id,
        deletedAt: null,
      },
      status: { not: "DRAFT" },
      NOT: { submittedById: user.id, companyId: null },
    },
    orderBy: { createdAt: "desc" },
    include: {
      request: {
        select: {
          id: true,
          title: true,
          city: true,
          status: true,
          coverImageUrl: true,
          budgetMin: true,
          budgetMax: true,
          currency: true,
          category: { select: { name: true, slug: true } },
          fieldValues: {
            where: { field: { key: { in: ["quantity", "commonQuantity"] } } },
            take: 1,
            select: { textValue: true, numberValue: true },
          },
        },
      },
      company: { select: { id: true, name: true, isVerified: true } },
      submittedBy: { select: { id: true, name: true } },
      conversation: { select: { id: true } },
      media: {
        orderBy: { sortOrder: "asc" },
        select: { id: true },
      },
      negotiations: offerNegotiationListInclude,
    },
  })) as OfferRow[];

  const archivedOfferIds = await listArchivedOfferIds({
    userId: user.id,
    companyId: null,
  });

  const highlightOffer = highlightOfferId
    ? (offers.find((row) => row.id === highlightOfferId) ?? null)
    : null;

  if (
    highlightOffer &&
    archivedOfferIds.has(highlightOffer.id) &&
    !archiveView
  ) {
    redirect(
      buildIncomingOffersPath({
        filter: parsedDurum.filter,
        teklif: highlightOfferId,
        tur: highlightNegotiationId,
        archiveView: true,
      }),
    );
  }

  const visibleOffers = filterOffersByArchiveView(
    offers,
    archivedOfferIds,
    archiveView ? "archive" : "active",
  );

  const highlightOfferResolved = highlightOfferId
    ? (visibleOffers.find((row) => row.id === highlightOfferId) ?? null)
    : null;
  const resolvedFilter = resolveIncomingOfferInboxFilter({
    requested: parsedDurum.filter,
    explicit: parsedDurum.explicit,
    highlightBucket: highlightOfferResolved
      ? classifyIncomingOfferInbox(highlightOfferResolved)
      : null,
  });
  if (resolvedFilter.redirect) {
    redirect(
      buildIncomingOffersPath({
        filter: resolvedFilter.filter,
        teklif: highlightOfferId,
        tur: highlightNegotiationId,
        archiveView,
      }),
    );
  }

  const unreadOfferIds = await listUnreadIncomingOfferIds(user.id);
  const activeFilter = resolvedFilter.filter;
  const inboxCounts = countIncomingOfferInbox(
    filterOffersByArchiveView(offers, archivedOfferIds, "active"),
    unreadOfferIds,
  );
  const actionRequiredCount = visibleOffers.filter(isBuyerActionableIncomingOffer)
    .length;
  const listed = visibleOffers.filter((offer) =>
    offerMatchesIncomingInboxFilter(
      classifyIncomingOfferInbox(offer),
      activeFilter,
      { offerId: offer.id, unreadOfferIds },
    ),
  );

  const trustSummaries = await loadProviderTrustSummaries({
    personalUserIds: offers
      .filter((offer) => !offer.company)
      .map((offer) => offer.submittedBy.id),
    companyIds: offers
      .map((offer) => offer.company?.id)
      .filter((id): id is string => Boolean(id)),
  });

  const byRequest = new Map<
    string,
    {
      request: OfferRow["request"];
      pending: OfferRow[];
      others: OfferRow[];
    }
  >();

  for (const offer of listed) {
    const key = offer.request.id;
    const bucket = byRequest.get(key) ?? {
      request: offer.request,
      pending: [],
      others: [],
    };
    if (["SUBMITTED", "VIEWED"].includes(offer.status)) {
      bucket.pending.push(offer);
    } else {
      bucket.others.push(offer);
    }
    byRequest.set(key, bucket);
  }

  const groups = [...byRequest.values()].sort((a, b) => {
    if (b.pending.length !== a.pending.length) {
      return b.pending.length - a.pending.length;
    }
    const aLatest = Math.max(
      0,
      ...[...a.pending, ...a.others].map((o) => o.createdAt.getTime()),
    );
    const bLatest = Math.max(
      0,
      ...[...b.pending, ...b.others].map((o) => o.createdAt.getTime()),
    );
    return bLatest - aLatest;
  });

  return (
    <>
      <section className="py-4 sm:py-6">
        <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-teal-950/35">
          ALICI
        </p>
        <h1 className="mt-2 text-3xl font-semibold tracking-[-0.04em] text-[#0f1f1d] sm:text-4xl">
          Taleplerime gelen teklifler
        </h1>
        <p className="mt-2 max-w-xl text-sm leading-6 text-black/45">
          Taleplerinize gelen teklifleri karşılaştırın, pazarlık yapın ve
          sonuçları takip edin.
        </p>
      </section>

      {offers.length === 0 ? (
        <section className="talepo-card px-6 py-14 text-center">
          <EmptyIllustration variant="inbox" />
          <h2 className="mt-5 text-xl font-semibold tracking-tight">
            Henüz gelen teklif yok
          </h2>
          <p className="mx-auto mt-2 max-w-md text-sm leading-6 text-black/45">
            Bir talep yayınladığınızda firmalar teklif gönderir; hepsi burada
            taleplerinize göre listelenir.
          </p>
          <Link
            href="/panel/taleplerim"
            className="mt-6 inline-flex items-center gap-2 rounded-xl bg-[#0f1f1d] px-5 py-3 text-sm font-semibold text-white"
          >
            Taleplerime git
            <ArrowRight className="h-4 w-4" />
          </Link>
        </section>
      ) : (
        <>
          <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
            <IncomingOfferInboxFilters
              active={activeFilter}
              counts={{
                all: inboxCounts.all,
                unread: inboxCounts.unread,
                new: inboxCounts.new,
                negotiating: inboxCounts.negotiating,
                accepted: inboxCounts.accepted,
                rejected: inboxCounts.rejected,
              }}
              teklif={highlightOfferId}
              tur={highlightNegotiationId}
              archiveView={archiveView}
              archiveCount={archivedOfferIds.size}
            />
            <MarkAllOfferInboxReadButton
              unreadCount={unreadOfferIds.size}
              role="buyer"
            />
          </div>
          {actionRequiredCount > 0 ? (
            <p className="mb-4 text-sm text-black/45">
              {actionRequiredCount} teklifte yanıtınız bekleniyor
              {unreadOfferIds.size > 0
                ? ` · ${unreadOfferIds.size} okunmamış teklif`
                : ""}
            </p>
          ) : unreadOfferIds.size > 0 ? (
            <p className="mb-4 text-sm text-black/45">
              {unreadOfferIds.size} okunmamış teklif
            </p>
          ) : null}
          {listed.length === 0 ? (
            <IncomingOfferInboxEmpty filter={activeFilter} archiveView={archiveView} />
          ) : (
            <div className="space-y-6">
              {groups.map((group) => {
                const rankedPending = compareOffersByCompleteness(
                  group.pending.map((offer) => ({
                    ...offer,
                    companyVerified: Boolean(offer.company?.isVerified),
                  })),
                );

                return (
                  <IncomingOfferCompareGroup
                    key={group.request.id}
                    request={toRequestSummary(group.request)}
                    highlightOfferId={highlightOfferId}
                    highlightNegotiationId={highlightNegotiationId}
                    unreadOfferIds={unreadOfferIds}
                    archivedOfferIds={archivedOfferIds}
                    archiveView={archiveView}
                    compareSlot={
                      group.pending.length >= 2 ? (
                        <div className="space-y-2 bg-white px-4 py-3">
                          <p className="flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-[0.12em] text-teal-950/40">
                            <GitCompareArrows className="h-3.5 w-3.5" />
                            Doluluğa göre sıralı
                          </p>
                          <OfferCompareToggle
                            offers={rankedPending.map((offer) => ({
                              id: offer.id,
                              firmName:
                                offer.company?.name ||
                                offer.submittedBy.name ||
                                "Firma",
                              amount: Number(offer.amount),
                              deliveryDays: offer.deliveryDays,
                              completeness: offer.completeness,
                              verified: Boolean(offer.company?.isVerified),
                            }))}
                          />
                        </div>
                      ) : null
                    }
                    pending={rankedPending.map((offer, index) => ({
                      offer: toCardData(offer),
                      completeness: offer.completeness,
                      trust: trustForOfferProvider(trustSummaries, offer),
                      rank: group.pending.length >= 2 ? index + 1 : undefined,
                    }))}
                    others={group.others.map((offer) => ({
                      offer: toCardData(offer),
                      trust: trustForOfferProvider(trustSummaries, offer),
                    }))}
                  />
                );
              })}
            </div>
          )}
        </>
      )}
    </>
  );
}
