import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { ArrowRight } from "lucide-react";

import {
  IncomingOfferInboxEmpty,
  IncomingOfferInboxFilters,
} from "@/components/panel/IncomingOfferInboxFilters";
import { IncomingRequestInboxCard } from "@/components/panel/IncomingRequestInboxCard";
import { MarkAllOfferInboxReadButton } from "@/components/panel/MarkAllOfferInboxReadButton";
import { EmptyIllustration } from "@/components/visuals/EmptyIllustration";
import {
  buildIncomingOffersInboxPath,
  buildIncomingRequestWorkspacePath,
  parseIncomingOfferInboxDurum,
  resolveIncomingOfferInboxFilter,
} from "@/lib/offer/incoming-offer-inbox";
import {
  aggregateIncomingRequestGroups,
  countArchivedRequestGroups,
  countIncomingRequestInboxFilters,
  requestGroupMatchesInboxFilter,
  sortIncomingRequestGroups,
} from "@/lib/offer/incoming-request-inbox";
import { mapIncomingRequestOfferRow, mapIncomingRequestSummary } from "@/lib/offer/incoming-offer-mapper";
import { filterOffersByArchiveView, parseOfferArchiveView } from "@/lib/offer/offer-archive";
import { requireUser } from "@/server/auth/require-user";
import {
  loadBuyerIncomingOfferById,
  loadBuyerIncomingOffers,
} from "@/server/offer/load-buyer-incoming-offers";

export default async function IncomingOffersInboxPage({
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

  if (highlightOfferId) {
    const resolved = await loadBuyerIncomingOfferById(user.id, highlightOfferId);
    if (!resolved) notFound();
    redirect(
      buildIncomingRequestWorkspacePath({
        requestId: resolved.requestId,
        filter: parsedDurum.filter,
        teklif: highlightOfferId,
        tur: highlightNegotiationId,
        archiveView,
      }),
    );
  }

  const { offers, archivedOfferIds, unreadOfferIds } =
    await loadBuyerIncomingOffers(user.id);

  const visibleOffers = filterOffersByArchiveView(
    offers,
    archivedOfferIds,
    archiveView ? "archive" : "active",
  );

  const resolvedFilter = resolveIncomingOfferInboxFilter({
    requested: parsedDurum.filter,
    explicit: parsedDurum.explicit,
    highlightBucket: null,
  });
  if (resolvedFilter.redirect) {
    redirect(
      buildIncomingOffersInboxPath({
        filter: resolvedFilter.filter,
        archiveView,
      }),
    );
  }

  const activeFilter = resolvedFilter.filter;
  const allGroups = aggregateIncomingRequestGroups({
    offers: visibleOffers.map(mapIncomingRequestOfferRow),
    unreadOfferIds,
    getRequest: (offer) => {
      const source = visibleOffers.find((row) => row.id === offer.id)!;
      const summary = mapIncomingRequestSummary(source.request);
      return {
        id: summary.id,
        title: summary.title,
        city: summary.city,
        status: summary.status,
        coverImageUrl: summary.coverImageUrl,
        categorySlug: summary.categorySlug,
        categoryName: summary.categoryName,
        budgetLabel: summary.budgetLabel,
        budgetMin: summary.budgetMin,
        budgetMax: summary.budgetMax,
        currency: summary.currency,
      };
    },
  });

  const activeGroupsSource = aggregateIncomingRequestGroups({
    offers: filterOffersByArchiveView(offers, archivedOfferIds, "active").map(
      mapIncomingRequestOfferRow,
    ),
    unreadOfferIds,
    getRequest: (offer) => {
      const source = offers.find((row) => row.id === offer.id)!;
      const summary = mapIncomingRequestSummary(source.request);
      return {
        id: summary.id,
        title: summary.title,
        city: summary.city,
        status: summary.status,
        coverImageUrl: summary.coverImageUrl,
        categorySlug: summary.categorySlug,
        categoryName: summary.categoryName,
        budgetLabel: summary.budgetLabel,
        budgetMin: summary.budgetMin,
        budgetMax: summary.budgetMax,
        currency: summary.currency,
      };
    },
  });

  const inboxCounts = countIncomingRequestInboxFilters(
    activeGroupsSource,
    unreadOfferIds,
  );
  const archiveCount = countArchivedRequestGroups(
    offers.map(mapIncomingRequestOfferRow),
    archivedOfferIds,
    (offer) => offers.find((row) => row.id === offer.id)!.request.id,
  );

  const filteredGroups = sortIncomingRequestGroups(
    allGroups.filter((group) =>
      requestGroupMatchesInboxFilter(group, activeFilter, unreadOfferIds),
    ),
  );

  const totalRequests = filteredGroups.length;
  const totalOffers = filteredGroups.reduce(
    (sum, group) => sum + group.totalOffers,
    0,
  );

  return (
    <>
      <section className="py-4 sm:py-6">
        <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-teal-950/35">
          ALICI
        </p>
        <h1 className="mt-2 text-3xl font-semibold tracking-[-0.04em] text-[#0f1f1d] sm:text-4xl">
          Gelen teklifler
        </h1>
        <p className="mt-2 max-w-xl text-sm leading-6 text-black/45">
          Taleplerinize gelen teklifleri önce talep kutusundan seçin; karşılaştırma
          ve karar işlemleri teklif çalışma alanında yapılır.
        </p>
      </section>

      {offers.length === 0 ? (
        <section className="talepo-card px-6 py-14 text-center">
          <EmptyIllustration variant="inbox" />
          <h2 className="mt-5 text-xl font-semibold tracking-tight">
            Henüz gelen teklif yok
          </h2>
          <p className="mx-auto mt-2 max-w-md text-sm leading-6 text-black/45">
            Bir talep yayınladığınızda firmalar teklif gönderir; talepleriniz burada
            gruplanır.
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
              counts={inboxCounts}
              archiveView={archiveView}
              archiveCount={archiveCount}
            />
            <MarkAllOfferInboxReadButton
              unreadCount={unreadOfferIds.size}
              role="buyer"
            />
          </div>

          <p className="mb-4 text-sm font-medium text-teal-950/70">
            {totalRequests} talep · {totalOffers} teklif
          </p>

          {filteredGroups.length === 0 ? (
            <IncomingOfferInboxEmpty filter={activeFilter} archiveView={archiveView} />
          ) : (
            <div className="space-y-3">
              {filteredGroups.map((group) => (
                <IncomingRequestInboxCard
                  key={group.request.id}
                  group={group}
                  filter={activeFilter}
                  archiveView={archiveView}
                />
              ))}
            </div>
          )}
        </>
      )}
    </>
  );
}
