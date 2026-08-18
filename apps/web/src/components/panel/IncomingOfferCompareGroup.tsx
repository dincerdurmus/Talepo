import Link from "next/link";
import { type ReactNode } from "react";
import { ArrowRight, MapPin, Package, Wallet } from "lucide-react";

import {
  IncomingOfferCard,
  type IncomingBudgetContext,
  type IncomingOfferCardData,
} from "@/components/panel/IncomingOfferCard";
import { IncomingRequestCover } from "@/components/panel/IncomingRequestCover";
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
}: {
  request: IncomingRequestSummaryData;
  sticky: boolean;
}) {
  return (
    <aside
      className={`border-b border-teal-900/[0.06] bg-[#f7f3ec] px-4 py-4 sm:px-5 lg:border-b-0 lg:border-r ${
        sticky ? "lg:sticky lg:top-24 lg:self-start" : ""
      }`}
    >
      <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-amber-900/70">
        Sizin talebiniz
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
        href={`/panel/taleplerim/${request.id}`}
        className="mt-4 inline-flex min-h-11 items-center gap-1 text-sm font-semibold text-[#0f766e] hover:underline"
      >
        Talep detayları
        <ArrowRight className="h-4 w-4" />
      </Link>
    </aside>
  );
}

export function IncomingOfferCompareGroup({
  request,
  pending,
  others,
  compareSlot,
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
}) {
  const budget: IncomingBudgetContext = {
    budgetMin: request.budgetMin,
    budgetMax: request.budgetMax,
    currency: request.currency,
  };
  const total = pending.length + others.length;
  const sticky = total > 1;

  return (
    <section className="talepo-card overflow-hidden">
      <header className="flex flex-wrap items-end justify-between gap-3 border-b border-teal-900/[0.06] px-4 py-3.5 sm:px-5">
        <div className="min-w-0">
          <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-teal-900/45">
            Talebiniz ve teklif karşılaştırması
          </p>
          <h2 className="mt-1 text-lg font-semibold tracking-tight text-[#0f1f1d]">
            {request.title}
          </h2>
        </div>
        <div className="flex flex-wrap items-center gap-1.5">
          <span className="rounded-full bg-white px-2.5 py-0.5 text-[11px] font-medium text-teal-950/65 ring-1 ring-teal-900/8">
            {total} teklif
          </span>
          {pending.length > 0 ? (
            <span className="rounded-full bg-amber-50 px-2.5 py-0.5 text-[11px] font-semibold text-amber-900/80 ring-1 ring-amber-200/70">
              {pending.length} yanıt bekliyor
            </span>
          ) : null}
        </div>
      </header>

      <div className="lg:grid lg:grid-cols-[17.5rem_minmax(0,1fr)]">
        <IncomingRequestSummary request={request} sticky={sticky} />
        <div className="min-w-0 divide-y divide-teal-900/[0.06]">
          {compareSlot}
          {pending.map((row) => (
            <IncomingOfferCard
              key={row.offer.id}
              offer={row.offer}
              budget={budget}
              actionable
              completeness={row.completeness}
              trust={row.trust}
              rank={row.rank}
            />
          ))}
          {others.length > 0 && pending.length > 0 ? (
            <p className="bg-white px-4 py-2 text-[11px] font-semibold uppercase tracking-[0.12em] text-black/35">
              Diğer
            </p>
          ) : null}
          {others.map((row) => (
            <IncomingOfferCard
              key={row.offer.id}
              offer={row.offer}
              budget={budget}
              trust={row.trust}
            />
          ))}
        </div>
      </div>
    </section>
  );
}
