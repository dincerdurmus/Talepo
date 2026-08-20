import Link from "next/link";
import { notFound, redirect } from "next/navigation";

import {
  IncomingOfferInboxEmpty,
  IncomingOfferInboxFilters,
} from "@/components/panel/IncomingOfferInboxFilters";
import { IncomingRequestInboxCard } from "@/components/panel/IncomingRequestInboxCard";
import { MarkAllOfferInboxReadButton } from "@/components/panel/MarkAllOfferInboxReadButton";
import { OfferInboxShell } from "@/components/panel/offer-inbox/OfferInboxShell";
import { OfferInboxToolbar } from "@/components/panel/offer-inbox/OfferInboxToolbar";
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
  const actionRequiredCount = inboxCounts.action_required;
  const unreadCount = unreadOfferIds.size;
  const emptyInbox = offers.length === 0;
  const summary = emptyInbox
    ? "Talepleriniz yayıma çıktıkça teklifler burada toplanır."
    : actionRequiredCount > 0
      ? `${actionRequiredCount} talepte yanıtınız bekleniyor.`
      : unreadCount > 0
        ? `${unreadCount} yeni teklif var.`
        : `${totalRequests} talep · ${totalOffers} teklif`;

  return (
    <OfferInboxShell
      tone="incoming"
      eyebrow="ALICI"
      title="Gelen teklifler"
      description="Taleplerinize kim teklif verdi ve şimdi ne yapmanız gerekiyor? Karşılaştırma ve karar teklif çalışma alanında yapılır."
      summary={summary}
      cta={
        emptyInbox
          ? { href: "/panel/taleplerim", label: "Taleplerim" }
          : null
      }
      toolbar={
        emptyInbox ? null : (
          <OfferInboxToolbar
            filters={
              <IncomingOfferInboxFilters
                active={activeFilter}
                counts={inboxCounts}
                archiveView={archiveView}
                archiveCount={archiveCount}
              />
            }
            action={
              unreadCount > 0 ? (
                <MarkAllOfferInboxReadButton
                  unreadCount={unreadCount}
                  role="buyer"
                />
              ) : null
            }
          />
        )
      }
    >
      {emptyInbox ? (
        <section className="rounded-[1.35rem] border border-[#0f1f1d]/8 bg-white px-6 py-12 text-center sm:px-10 sm:py-14">
          <EmptyIllustration variant="inbox" />
          <h2 className="mt-6 text-xl font-semibold tracking-tight text-[#0f1f1d]">
            Henüz gelen teklif yok
          </h2>
          <p className="mx-auto mt-2 max-w-md text-sm leading-6 text-[#0f1f1d]/55">
            Bir talep yayınladığınızda firmalar teklif gönderir; talepleriniz
            burada gruplanır.
          </p>
          <Link
            href="/panel/taleplerim"
            className="mt-6 inline-flex min-h-11 items-center justify-center rounded-xl bg-[#0f766e] px-5 text-sm font-semibold text-white transition hover:bg-[#115e59] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#0f766e]/40"
          >
            Taleplerim
          </Link>
        </section>
      ) : filteredGroups.length === 0 ? (
        <IncomingOfferInboxEmpty filter={activeFilter} archiveView={archiveView} />
      ) : (
        <section className="grid gap-3" aria-label="Gelen teklif talepleri">
          {filteredGroups.map((group) => (
            <IncomingRequestInboxCard
              key={group.request.id}
              group={group}
              filter={activeFilter}
              archiveView={archiveView}
            />
          ))}
        </section>
      )}
    </OfferInboxShell>
  );
}
