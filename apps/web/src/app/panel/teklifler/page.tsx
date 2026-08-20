import Link from "next/link";
import { redirect } from "next/navigation";
import { CheckCircle2 } from "lucide-react";

import type { IncomingRequestSummaryData } from "@/components/panel/IncomingOfferCompareGroup";
import {
  OfferIntelligenceHub,
  type OfferIntelligenceReadyItem,
} from "@/components/panel/OfferIntelligenceHub";
import {
  OutgoingOfferInboxEmpty,
  OutgoingOfferInboxFilters,
} from "@/components/panel/OutgoingOfferInboxFilters";
import { MarkAllOfferInboxReadButton } from "@/components/panel/MarkAllOfferInboxReadButton";
import { OutgoingOfferCompareGroup } from "@/components/panel/OutgoingOfferCompareGroup";
import type { OutgoingOfferCardData } from "@/components/panel/OutgoingOfferCard";
import { OfferInboxToolbar } from "@/components/panel/offer-inbox/OfferInboxToolbar";
import { OfferInboxShell } from "@/components/panel/offer-inbox/OfferInboxShell";
import { EmptyIllustration } from "@/components/visuals/EmptyIllustration";
import { getCompanyContextOptions } from "@/lib/membership/company-context";
import { hasFeature } from "@/lib/membership/entitlements";
import { resolveEntitlements } from "@/lib/membership/resolve-entitlements";
import { OFFER_INTELLIGENCE_FEATURE } from "@/lib/monetization/offer-intelligence";
import { formatRequestQuantity } from "@/lib/offer/budget-offer-compare";
import { scoreOfferCompleteness } from "@/lib/offer/offer-completeness";
import {
  offerNegotiationListInclude,
  toOfferNegotiationDtos,
} from "@/lib/offer/offer-negotiation";
import { listUnreadOutgoingOfferIds } from "@/lib/offer/offer-event-unread";
import {
  filterOffersByArchiveView,
  parseOfferArchiveView,
} from "@/lib/offer/offer-archive";
import {
  isSellerActionableOutgoingOffer,
  OUTGOING_OFFER_INBOX_EMPTY,
  buildOutgoingOffersPath,
  classifyOutgoingOfferInbox,
  countOutgoingOfferInbox,
  offerMatchesOutgoingInboxFilter,
  parseOutgoingOfferInboxDurum,
  resolveOutgoingOfferInboxFilter,
} from "@/lib/offer/outgoing-offer-inbox";
import { getCompanyWorkspace } from "@/lib/panel/company-workspace";
import { prisma } from "@/lib/prisma";
import { formatListingBudget } from "@/lib/visuals/category-visuals";
import { requireUser } from "@/server/auth/require-user";
import { listArchivedOfferIds } from "@/server/offer/offer-archive-service";
import {
  getRequestOfferIntelligence,
  OfferIntelligenceLookupError,
} from "@/server/monetization/offer-intelligence";

function toNumber(value: unknown): number | null {
  if (value == null || value === "") return null;
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
}

export default async function OffersPage({
  searchParams,
}: {
  searchParams: Promise<{
    gonderildi?: string;
    guncellendi?: string;
    teklif?: string;
    tur?: string;
    durum?: string;
    gorunum?: string;
  }>;
}) {
  const user = await requireUser();
  const workspace = await getCompanyWorkspace(user.id);
  const { gonderildi, guncellendi, teklif, tur, durum, gorunum } =
    await searchParams;
  const archiveView = parseOfferArchiveView(gorunum) === "archive";
  const justSubmitted = gonderildi === "1";
  const justUpdated = guncellendi === "1";
  const highlightOfferId = teklif?.trim() || null;
  const highlightNegotiationId = tur?.trim() || null;
  const parsedDurum = parseOutgoingOfferInboxDurum(durum);

  const offers = await prisma.offer.findMany({
    where: workspace
      ? {
          companyId: workspace.companyId,
          status: { not: "DRAFT" },
        }
      : {
          submittedById: user.id,
          companyId: null,
          status: { not: "DRAFT" },
        },
    orderBy: [{ submittedAt: "desc" }, { createdAt: "desc" }],
    include: {
      request: {
        select: {
          id: true,
          title: true,
          city: true,
          status: true,
          isUrgent: true,
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
      conversation: { select: { id: true } },
      media: {
        orderBy: { sortOrder: "asc" },
        select: { id: true },
      },
      negotiations: offerNegotiationListInclude,
    },
    take: 50,
  });

  const archivedOfferIds = await listArchivedOfferIds({
    userId: user.id,
    companyId: workspace?.companyId ?? null,
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
      buildOutgoingOffersPath({
        filter: parsedDurum.filter,
        teklif: highlightOfferId,
        tur: highlightNegotiationId,
        gonderildi: justSubmitted ? "1" : null,
        guncellendi: justUpdated ? "1" : null,
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

  const resolvedFilter = resolveOutgoingOfferInboxFilter({
    requested: parsedDurum.filter,
    explicit: parsedDurum.explicit,
    highlightBucket: highlightOfferResolved
      ? classifyOutgoingOfferInbox(highlightOfferResolved)
      : null,
  });
  if (resolvedFilter.redirect) {
    redirect(
      buildOutgoingOffersPath({
        filter: resolvedFilter.filter,
        teklif: highlightOfferId,
        tur: highlightNegotiationId,
        gonderildi: justSubmitted ? "1" : null,
        guncellendi: justUpdated ? "1" : null,
        archiveView,
      }),
    );
  }

  const unreadOfferIds = await listUnreadOutgoingOfferIds(
    user.id,
    workspace?.companyId ?? null,
  );
  const activeFilter = resolvedFilter.filter;
  const inboxCounts = countOutgoingOfferInbox(
    filterOffersByArchiveView(offers, archivedOfferIds, "active"),
    unreadOfferIds,
  );
  const actionRequiredCount = visibleOffers.filter(isSellerActionableOutgoingOffer)
    .length;
  const listed = visibleOffers.filter((offer) =>
    offerMatchesOutgoingInboxFilter(
      classifyOutgoingOfferInbox(offer),
      activeFilter,
      { offerId: offer.id, unreadOfferIds },
    ),
  );

  const entitlements = await resolveEntitlements(
    user.id,
    await getCompanyContextOptions(),
  );
  const hasOfferIntelligence = hasFeature(
    entitlements.features,
    OFFER_INTELLIGENCE_FEATURE,
  );

  let intelligenceHubMode: "locked" | "empty" | "ready" = "locked";
  let readyIntelligence: OfferIntelligenceReadyItem[] = [];

  if (!hasOfferIntelligence) {
    intelligenceHubMode = "locked";
  } else {
    const requestMeta = new Map<string, string>();
    for (const offer of offers) {
      if (!requestMeta.has(offer.request.id)) {
        requestMeta.set(offer.request.id, offer.request.title);
      }
    }

    const settled = await Promise.all(
      [...requestMeta.entries()].map(async ([requestId, requestTitle]) => {
        try {
          const intelligence = await getRequestOfferIntelligence({
            userId: user.id,
            requestId,
          });
          return { requestId, requestTitle, intelligence };
        } catch (error) {
          if (error instanceof OfferIntelligenceLookupError) return null;
          throw error;
        }
      }),
    );

    readyIntelligence = settled.filter(
      (row): row is OfferIntelligenceReadyItem =>
        row != null &&
        row.intelligence.state === "READY" &&
        row.intelligence.min != null &&
        row.intelligence.max != null &&
        row.intelligence.median != null &&
        row.intelligence.average != null,
    );
    intelligenceHubMode =
      readyIntelligence.length > 0 ? "ready" : "empty";
  }

  return (
    <OfferInboxShell
      tone="outgoing"
      eyebrow="SATICI"
      title="Tekliflerim"
      description="Hangi taleplere teklif verdiğinizi ve şimdi ne yapmanız gerektiğini görün."
      summary={
        offers.length === 0
          ? "Açık taleplere teklif verdikçe süreçleriniz burada görünür."
          : actionRequiredCount > 0
            ? `${actionRequiredCount} teklifte yanıtınız bekleniyor.`
            : unreadOfferIds.size > 0
              ? `${unreadOfferIds.size} okunmamış teklif var.`
              : `${listed.length} teklif bu görünümde.`
      }
      cta={
        offers.length === 0
          ? { href: "/panel/talepler", label: "Talepler" }
          : null
      }
      toolbar={
        offers.length === 0 ? null : (
          <OfferInboxToolbar
            filters={
              <OutgoingOfferInboxFilters
                active={activeFilter}
                counts={inboxCounts}
                teklif={highlightOfferId}
                tur={highlightNegotiationId}
                archiveView={archiveView}
                archiveCount={archivedOfferIds.size}
              />
            }
            action={
              unreadOfferIds.size > 0 ? (
                <MarkAllOfferInboxReadButton
                  unreadCount={unreadOfferIds.size}
                  role="seller"
                />
              ) : null
            }
          />
        )
      }
    >
      {(justSubmitted || justUpdated) && (
        <section className="mb-5 rounded-[1.35rem] border border-[#0f1f1d]/8 bg-white px-5 py-4">
          <p className="flex items-center gap-2 text-sm font-semibold text-[#0f1f1d]">
            <CheckCircle2 className="h-4 w-4 shrink-0 text-[#0f766e]" />
            {justUpdated
              ? "Teklif notunuz güncellendi"
              : "Teklifiniz alıcıya iletildi"}
          </p>
          <p className="mt-1.5 text-sm leading-6 text-[#0f1f1d]/55">
            {justUpdated
              ? "Alıcı güncel açıklamanızı görür. Tutar ve teslim süresi aynı kalır."
              : "Alıcı teklifi Gelen teklifler’den görür. Kabul veya pazarlık ile süreç ilerler. Ürün fotoğrafları gönderimden sonra değişmez."}
          </p>
        </section>
      )}

      {offers.length === 0 ? (
        <section className="rounded-[1.35rem] border border-[#0f1f1d]/8 bg-white px-6 py-12 text-center sm:px-10 sm:py-14 sm:text-left">
          <EmptyIllustration variant="offers" className="sm:mx-0" />
          <h2 className="mt-6 text-xl font-semibold tracking-tight text-[#0f1f1d]">
            {OUTGOING_OFFER_INBOX_EMPTY.all}
          </h2>
          <p className="mt-2 max-w-md text-sm leading-6 text-[#0f1f1d]/55">
            Açık taleplere teklif verin; burada talep ve teklifiniz yan yana
            görünür.
          </p>
          <Link
            href="/panel/talepler"
            className="mt-6 inline-flex min-h-11 items-center justify-center rounded-xl bg-[#0f766e] px-5 text-sm font-semibold text-white transition hover:bg-[#115e59] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#0f766e]/40"
          >
            Talepler
          </Link>
        </section>
      ) : listed.length === 0 ? (
        <OutgoingOfferInboxEmpty filter={activeFilter} archiveView={archiveView} />
      ) : (
        <section className="grid gap-3" aria-label="Tekliflerim listesi">
          {listed.map((offer) => {
            const canRevise = ["SUBMITTED", "VIEWED"].includes(offer.status);
            const completeness = scoreOfferCompleteness({
              amount: offer.amount,
              deliveryDays: offer.deliveryDays,
              title: offer.title,
              description: offer.description,
              validUntil: offer.validUntil,
            });
            const quantity = offer.request.fieldValues[0];
            const budgetMin = toNumber(offer.request.budgetMin);
            const budgetMax = toNumber(offer.request.budgetMax);
            const request: IncomingRequestSummaryData = {
              id: offer.request.id,
              title: offer.request.title,
              city: offer.request.city,
              status: offer.request.status,
              coverImageUrl: offer.request.coverImageUrl,
              categorySlug: offer.request.category.slug,
              categoryName: offer.request.category.name,
              quantityLabel: formatRequestQuantity({
                textValue: quantity?.textValue ?? null,
                numberValue: toNumber(quantity?.numberValue),
              }),
              budgetMin,
              budgetMax,
              currency: offer.request.currency,
              budgetLabel: formatListingBudget(
                budgetMin,
                budgetMax,
                offer.request.currency,
              ),
            };
            const card: OutgoingOfferCardData = {
              id: offer.id,
              requestId: offer.request.id,
              amount: Number(offer.amount),
              currency: offer.currency,
              deliveryDays: offer.deliveryDays,
              title: offer.title,
              description: offer.description,
              status: offer.status,
              createdAt: offer.createdAt.toISOString(),
              conversationId: offer.conversation?.id ?? null,
              mediaIds: offer.media.map((item) => item.id),
              negotiations: toOfferNegotiationDtos(offer.negotiations),
            };

            return (
              <OutgoingOfferCompareGroup
                key={offer.id}
                request={request}
                offer={card}
                completeness={completeness}
                canMutate={canRevise}
                highlight={highlightOfferId === offer.id}
                isUnread={unreadOfferIds.has(offer.id)}
                archivedOfferIds={archivedOfferIds}
                archiveView={archiveView}
                highlightNegotiationId={
                  highlightOfferId === offer.id ? highlightNegotiationId : null
                }
              />
            );
          })}
        </section>
      )}

      {offers.length > 0 ? (
        <OfferIntelligenceHub
          mode={intelligenceHubMode}
          readyItems={readyIntelligence}
        />
      ) : null}
    </OfferInboxShell>
  );
}
