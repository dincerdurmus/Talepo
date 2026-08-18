import Link from "next/link";
import { type ReactNode } from "react";
import { ArrowRight, MapPin, Package, Wallet } from "lucide-react";

import { CollapsibleOfferGroup } from "@/components/panel/CollapsibleOfferGroup";
import {
  IncomingOfferCard,
  type IncomingOfferCardData,
} from "@/components/panel/IncomingOfferCard";
import { IncomingRequestCover } from "@/components/panel/IncomingRequestCover";
import { OfferCollapsedSummary } from "@/components/panel/OfferCollapsedSummary";
import { OfferCompareRail } from "@/components/panel/OfferCompareRail";
import {
  isActionRequiredOffer,
} from "@/lib/offer/offer-card-status";
import { canArchiveOffer } from "@/lib/offer/offer-archive";
import type { OfferCompleteness } from "@/lib/offer/offer-completeness";
import type { TrustSummary } from "@/lib/offer/deal-review";

export type IncomingRequestSummaryData = {
  id: string;
  title: string;
  city: string | null;
  status: string;
  coverImageUrl: string | null;
  categorySlug: string | null;
  categoryName: string | null;
  quantityLabel: string | null;
  budgetMin: number | null;
  budgetMax: number | null;
  currency: string;
  budgetLabel: string | null;
};

const REQUEST_STATUS: Record<string, string> = {
  PUBLISHED: "Yayında",
  RECEIVING_OFFERS: "Teklif alıyor",
  CLOSED: "Kapandı",
  COMPLETED: "Tamamlandı",
  CANCELLED: "İptal",
  DRAFT: "Taslak",
};

function IncomingRequestSummary({
  request,
  sticky,
  eyebrow = "Sizin talebiniz",
  detailHref,
  detailLabel = "Talep detayları",
}: {
  request: IncomingRequestSummaryData;
  sticky: boolean;
  eyebrow?: string;
  detailHref?: string;
  detailLabel?: string;
}) {
  const href = detailHref ?? `/panel/taleplerim/${request.id}`;
  return (
    <aside
      className={`border-b border-teal-900/[0.06] bg-[#f7f3ec] px-4 py-4 sm:px-5 lg:border-b-0 lg:border-r ${
        sticky ? "lg:sticky lg:top-24 lg:self-start" : ""
      }`}
    >
      <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-amber-900/70">
        {eyebrow}
      </p>
      <div className="mt-3">
        <IncomingRequestCover
          coverImageUrl={request.coverImageUrl}
          categorySlug={request.categorySlug}
          categoryName={request.categoryName}
          requestTitle={request.title}
        />
      </div>
      <h2 className="mt-3 text-lg font-semibold tracking-tight text-[#0f1f1d]">
        {request.title}
      </h2>
      {REQUEST_STATUS[request.status] ? (
        <p className="mt-1 text-[11px] font-medium text-black/40">
          {REQUEST_STATUS[request.status]}
        </p>
      ) : null}
      <dl className="mt-3 space-y-2 text-sm">
        {request.city ? (
          <div className="flex items-start gap-2 text-black/55">
            <MapPin className="mt-0.5 h-3.5 w-3.5 shrink-0 opacity-70" />
            <div>
              <dt className="sr-only">Konum</dt>
              <dd>{request.city}</dd>
            </div>
          </div>
        ) : null}
        <div className="flex items-start gap-2 text-black/55">
          <Package className="mt-0.5 h-3.5 w-3.5 shrink-0 opacity-70" />
          <div>
            <dt className="sr-only">Miktar</dt>
            <dd>{request.quantityLabel || "Adet belirtilmedi"}</dd>
          </div>
        </div>
        <div className="flex items-start gap-2">
          <Wallet className="mt-0.5 h-3.5 w-3.5 shrink-0 text-black/45" />
          <div>
            <dt className="text-[11px] font-medium text-black/40">Hedef bütçe</dt>
            <dd className="text-lg font-semibold tracking-tight text-[#0f1f1d]">
              {request.budgetLabel || "Bütçe belirtilmedi"}
            </dd>
          </div>
        </div>
      </dl>
      <Link
        href={href}
        className="mt-4 inline-flex min-h-11 items-center gap-1 text-sm font-semibold text-[#0f766e] hover:underline"
      >
        {detailLabel}
        <ArrowRight className="h-4 w-4" />
      </Link>
    </aside>
  );
}

export function RequestCompareSummary(props: {
  request: IncomingRequestSummaryData;
  sticky: boolean;
  eyebrow?: string;
  detailHref?: string;
  detailLabel?: string;
}) {
  return <IncomingRequestSummary {...props} />;
}

function sellerInitials(name: string) {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length >= 2) {
    return `${parts[0]![0] ?? ""}${parts[1]![0] ?? ""}`.toUpperCase();
  }
  return name.slice(0, 2).toUpperCase() || "TE";
}

export function IncomingOfferCompareGroup({
  request,
  pending,
  others,
  compareSlot,
  highlightOfferId,
  highlightNegotiationId,
  unreadOfferIds,
  archivedOfferIds,
  archiveView = false,
}: {
  request: IncomingRequestSummaryData;
  pending: Array<{
    offer: IncomingOfferCardData;
    completeness?: OfferCompleteness;
    trust?: TrustSummary;
    rank?: number;
  }>;
  others: Array<{
    offer: IncomingOfferCardData;
    trust?: TrustSummary;
  }>;
  compareSlot?: ReactNode;
  highlightOfferId?: string | null;
  highlightNegotiationId?: string | null;
  unreadOfferIds?: ReadonlySet<string>;
  archivedOfferIds?: ReadonlySet<string>;
  archiveView?: boolean;
}) {
  const total = pending.length + others.length;
  const sticky = total > 1;
  const unreadSet = unreadOfferIds ?? new Set<string>();
  const archivedSet = archivedOfferIds ?? new Set<string>();
  const actionRequiredCount =
    pending.filter((row) =>
      isActionRequiredOffer("buyer", {
        status: row.offer.status,
        negotiations: row.offer.negotiations,
      }),
    ).length +
    others.filter((row) =>
      isActionRequiredOffer("buyer", {
        status: row.offer.status,
        negotiations: row.offer.negotiations,
      }),
    ).length;

  const renderOffer = (
    row: {
      offer: IncomingOfferCardData;
      completeness?: OfferCompleteness;
      trust?: TrustSummary;
      rank?: number;
    },
    actionable: boolean,
  ) => {
    const firmName =
      row.offer.companyName || row.offer.submittedByName || "Firma";
    const isUnread = unreadSet.has(row.offer.id);
    const isDeepLinked = highlightOfferId === row.offer.id;
    const isActionRequired = isActionRequiredOffer("buyer", {
      status: row.offer.status,
      negotiations: row.offer.negotiations,
    });
    const isArchived = archivedSet.has(row.offer.id);
    const canArchive = canArchiveOffer({
      offer: {
        status: row.offer.status,
        negotiations: row.offer.negotiations,
      },
      isUnread,
      isActionRequired,
    });

    return (
      <CollapsibleOfferGroup
        key={row.offer.id}
        offerId={row.offer.id}
        viewer="buyer"
        offer={{
          status: row.offer.status,
          negotiations: row.offer.negotiations,
        }}
        isUnread={isUnread}
        isActionRequired={isActionRequired}
        isDeepLinked={isDeepLinked}
        header={
          <OfferCollapsedSummary
            viewer="buyer"
            offer={{
              status: row.offer.status,
              negotiations: row.offer.negotiations,
              amount: row.offer.amount,
              currency: row.offer.currency,
              createdAt: row.offer.createdAt,
            }}
            title={firmName}
            roleLabel="Satıcı"
            city={request.city}
            isUnread={isUnread}
            photoCount={row.offer.mediaIds.length}
            thumbnail={{
              initials: sellerInitials(firmName),
            }}
          />
        }
      >
        <div
          id={`teklif-${row.offer.id}`}
          className={
            isDeepLinked ? "rounded-b-[24px] ring-2 ring-inset ring-amber-300/70" : ""
          }
        >
          <div className="flex flex-col overflow-x-hidden lg:grid lg:grid-cols-[minmax(0,17.5rem)_9.5rem_minmax(0,1fr)]">
            <IncomingRequestSummary request={request} sticky={sticky} />
            <OfferCompareRail
              viewer="buyer"
              offer={{
                status: row.offer.status,
                negotiations: row.offer.negotiations,
              }}
              amount={row.offer.amount}
              currency={row.offer.currency}
              budgetMin={request.budgetMin}
              budgetMax={request.budgetMax}
              requestCurrency={request.currency}
            />
            <IncomingOfferCard
              offer={row.offer}
              actionable={actionable}
              completeness={row.completeness}
              trust={row.trust}
              rank={row.rank}
              isUnread={isUnread}
              compareStripLayout
              canArchive={canArchive}
              isArchived={isArchived || archiveView}
              highlightNegotiationId={
                isDeepLinked ? highlightNegotiationId : null
              }
            />
          </div>
        </div>
      </CollapsibleOfferGroup>
    );
  };

  return (
    <section className="space-y-4">
      <header className="flex flex-wrap items-end justify-between gap-3 px-1">
        <div className="min-w-0">
          <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-teal-900/45">
            Talebiniz
          </p>
          <h2 className="mt-1 text-lg font-semibold tracking-tight text-[#0f1f1d]">
            {request.title}
          </h2>
        </div>
        <div className="flex flex-wrap items-center gap-1.5">
          <span className="rounded-full bg-white px-2.5 py-0.5 text-[11px] font-medium text-teal-950/65 ring-1 ring-teal-900/8">
            {total} teklif
          </span>
          {actionRequiredCount > 0 ? (
            <span className="rounded-full bg-amber-50 px-2.5 py-0.5 text-[11px] font-semibold text-amber-900/80 ring-1 ring-amber-200/70">
              {actionRequiredCount} yanıt bekliyor
            </span>
          ) : null}
        </div>
      </header>

      {compareSlot}

      <div className="space-y-4">
        {pending.map((row) => renderOffer(row, true))}
        {others.length > 0 && pending.length > 0 ? (
          <p className="px-1 text-[11px] font-semibold uppercase tracking-[0.12em] text-black/35">
            Diğer
          </p>
        ) : null}
        {others.map((row) => renderOffer(row, false))}
      </div>
    </section>
  );
}
