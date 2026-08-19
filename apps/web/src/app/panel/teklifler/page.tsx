import Link from "next/link";
import { redirect } from "next/navigation";
import {
  ArrowRight,
  CheckCircle2,
  CircleDot,
  Handshake,
  ThumbsDown,
  ThumbsUp,
} from "lucide-react";

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

  const counts = {
    open: inboxCounts.sent,
    negotiating: inboxCounts.negotiating,
    accepted: inboxCounts.accepted,
    rejected: inboxCounts.rejected,
  };

  const pageTitle = "Teklif verdiğim talepler";
  const pageSubtitle =
    "Teklif gönderdiğiniz talepleri, pazarlıkları ve sonuçlanan süreçleri buradan takip edin.";

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
    <>
      <section className="py-4 sm:py-6">
        <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-teal-950/35">
          SATICI
        </p>
        <h1 className="talepo-page-title mt-3 text-4xl sm:text-5xl">
          {pageTitle}
        </h1>
        <p className="mt-4 max-w-2xl text-base leading-7 text-teal-950/50">
          {pageSubtitle}
        </p>
      </section>

      {(justSubmitted || justUpdated) && (
        <section className="mb-5 rounded-2xl border border-teal-900/12 bg-[#eef6f4] px-5 py-4">
          <p className="flex items-center gap-2 text-sm font-semibold text-teal-900">
            <CheckCircle2 className="h-4 w-4 shrink-0" />
            {justUpdated
              ? "Teklif notunuz güncellendi"
              : "Teklifiniz alıcıya iletildi"}
          </p>
          <p className="mt-1.5 text-sm leading-6 text-teal-900/70">
            {justUpdated
              ? "Alıcı güncel açıklamanızı görür. Tutar ve teslim süresi aynı kalır."
              : "Alıcı teklifi Gelen teklifler’den görür. Kabul veya pazarlık ile süreç ilerler. Ürün fotoğrafları gönderimden sonra değişmez."}
          </p>
        </section>
      )}

      <div className="mb-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {(
          [
            {
              filter: "sent" as const,
              label: "Gönderilen",
              value: counts.open,
              hint: "Pazarlık yok, yanıt bekleniyor",
              icon: CircleDot,
              wrap: "border-teal-900/10 bg-[linear-gradient(160deg,#f3faf8_0%,#e8f4f1_55%,#f7fbfa_100%)] shadow-[0_10px_24px_rgba(15,118,110,0.08)]",
              iconWrap: "bg-teal-800/10 text-teal-800",
              valueClass: "text-teal-950",
            },
            {
              filter: "negotiating" as const,
              label: "Pazarlık",
              value: counts.negotiating,
              hint: "Açık pazarlık turları",
              icon: Handshake,
              wrap: "border-amber-200/70 bg-[linear-gradient(160deg,#fffbeb_0%,#fef3c7_55%,#fff8eb_100%)] shadow-[0_10px_24px_rgba(217,119,6,0.1)]",
              iconWrap: "bg-amber-500/15 text-amber-800",
              valueClass: "text-amber-950",
            },
            {
              filter: "accepted" as const,
              label: "Kabul",
              value: counts.accepted,
              hint: "Sonuçlanan kazanç",
              icon: ThumbsUp,
              wrap: "border-emerald-200/70 bg-[linear-gradient(160deg,#ecfdf5_0%,#d1fae5_55%,#f0fdf7_100%)] shadow-[0_10px_24px_rgba(5,150,105,0.1)]",
              iconWrap: "bg-emerald-600/12 text-emerald-800",
              valueClass: "text-emerald-950",
            },
            {
              filter: "rejected" as const,
              label: "Red",
              value: counts.rejected,
              hint: "Alıcı tarafından reddedildi",
              icon: ThumbsDown,
              wrap: "border-rose-200/70 bg-[linear-gradient(160deg,#fff1f2_0%,#ffe4e6_55%,#fff7f7_100%)] shadow-[0_10px_24px_rgba(225,29,72,0.08)]",
              iconWrap: "bg-rose-500/12 text-rose-800",
              valueClass: "text-rose-950",
            },
          ] as const
        ).map((item) => {
          const Icon = item.icon;
          const selected = activeFilter === item.filter;
          return (
            <Link
              key={item.label}
              href={buildOutgoingOffersPath({
                filter: item.filter,
                teklif: highlightOfferId,
                tur: highlightNegotiationId,
              })}
              className={`relative overflow-hidden rounded-[18px] border p-4 text-left transition hover:-translate-y-0.5 ${item.wrap} ${
                selected ? "ring-2 ring-teal-800/25" : ""
              }`}
            >
              <div
                aria-hidden
                className="pointer-events-none absolute -right-6 -top-6 h-20 w-20 rounded-full bg-white/45 blur-2xl"
              />
              <div className="relative flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="text-[11px] font-semibold uppercase tracking-[0.08em] text-black/40">
                    {item.label}
                  </p>
                  <p
                    className={`mt-1.5 text-3xl font-semibold tracking-tight tabular-nums ${item.valueClass}`}
                  >
                    {item.value}
                  </p>
                  <p className="mt-1 text-[11px] leading-4 text-black/40">
                    {item.hint}
                  </p>
                </div>
                <span
                  className={`inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-[12px] ${item.iconWrap}`}
                >
                  <Icon className="h-4 w-4" strokeWidth={2.25} />
                </span>
              </div>
            </Link>
          );
        })}
      </div>

      <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
        <OutgoingOfferInboxFilters
          active={activeFilter}
          counts={inboxCounts}
          teklif={highlightOfferId}
          tur={highlightNegotiationId}
          archiveView={archiveView}
          archiveCount={archivedOfferIds.size}
        />
        <MarkAllOfferInboxReadButton
          unreadCount={unreadOfferIds.size}
          role="seller"
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

      <OfferIntelligenceHub
        mode={intelligenceHubMode}
        readyItems={readyIntelligence}
      />

      {offers.length === 0 ? (
        <Gate
          title={OUTGOING_OFFER_INBOX_EMPTY.all}
          body="Açık taleplere teklif verin; burada talep ve teklifiniz yan yana görünür."
          href="/panel/talepler"
          cta="Talepler"
        />
      ) : listed.length === 0 ? (
        <OutgoingOfferInboxEmpty filter={activeFilter} archiveView={archiveView} />
      ) : (
        <section className="grid gap-6">
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
    </>
  );
}

function Gate({
  title,
  body,
  href,
  cta,
}: {
  title: string;
  body: string;
  href: string;
  cta: string;
}) {
  return (
    <div className="talepo-card p-8 text-center sm:text-left">
      <EmptyIllustration variant="offers" className="sm:mx-0" />
      <h2 className="mt-5 text-xl font-semibold">{title}</h2>
      <p className="mt-3 max-w-lg text-sm leading-6 text-black/45">{body}</p>
      <Link
        href={href}
        className="mt-6 inline-flex items-center gap-2 rounded-full bg-teal-800 px-5 py-3 text-sm font-semibold text-white"
      >
        {cta}
        <ArrowRight className="h-4 w-4" />
      </Link>
    </div>
  );
}
