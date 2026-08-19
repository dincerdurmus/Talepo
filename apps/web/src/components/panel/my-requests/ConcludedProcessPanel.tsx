"use client";

import { ChevronDown } from "lucide-react";

import { NegotiationHistory } from "@/components/panel/NegotiationHistory";
import { OfferMediaThumbStrip } from "@/components/panel/OfferMediaThumbStrip";
import type { ConcludedProcessModel } from "@/lib/panel/concluded-process-history";

export function ConcludedProcessPanel({
  model,
}: {
  model: ConcludedProcessModel;
}) {
  const { summary, events, offers } = model;
  const accepted = offers.find((offer) => offer.accepted) ?? null;
  const otherOffers = offers.filter((offer) => !offer.accepted);

  return (
    <section
      id="surec"
      className="rounded-[28px] border border-black/[0.06] bg-white p-5 shadow-[0_18px_60px_rgba(0,0,0,0.04)] sm:p-6"
    >
      <p className="text-xs font-semibold uppercase tracking-[0.16em] text-black/35">
        Sonuç
      </p>
      <div className="mt-3 grid gap-3 sm:grid-cols-2">
        <SummaryItem label="Durum" value={summary.outcomeLabel} />
        {summary.agreedAmountLabel ? (
          <SummaryItem label="Anlaşılan tutar" value={summary.agreedAmountLabel} />
        ) : null}
        <SummaryItem label="Son işlem" value={summary.lastActionLabel} />
        {summary.sellerName ? (
          <SummaryItem label="Satıcı" value={summary.sellerName} />
        ) : null}
        <SummaryItem
          label="Teklif"
          value={
            summary.offerCount === 1
              ? "1 teklif"
              : `${summary.offerCount} teklif`
          }
        />
        {summary.negotiationRoundCount > 0 ? (
          <SummaryItem
            label="Pazarlık"
            value={
              summary.negotiationRoundCount === 1
                ? "1 tur"
                : `${summary.negotiationRoundCount} tur`
            }
          />
        ) : null}
      </div>

      <div className="mt-5 space-y-3">
        <Accordion title={`Süreç geçmişi (${events.length} adım)`}>
          {events.length === 0 ? (
            <p className="text-sm text-black/45">Kayıtlı bir süreç adımı yok.</p>
          ) : (
            <ol className="space-y-2.5">
              {events.map((event) => (
                <li key={event.id}>
                  <p className="text-sm font-medium text-[#0f1f1d]">
                    {event.title}
                  </p>
                  <p className="mt-0.5 text-[12px] text-black/40">
                    {[event.detail, event.at].filter(Boolean).join(" · ")}
                  </p>
                </li>
              ))}
            </ol>
          )}
        </Accordion>

        <Accordion
          title={`Teklif ve pazarlık geçmişi (${summary.negotiationRoundCount} tur)`}
        >
          {offers.length === 0 ? (
            <p className="text-sm text-black/45">Kayıtlı teklif yok.</p>
          ) : (
            <div className="space-y-4">
              {accepted ? <OfferHistoryBlock offer={accepted} /> : null}
              {otherOffers.map((offer) => (
                <OfferHistoryBlock key={offer.id} offer={offer} />
              ))}
            </div>
          )}
        </Accordion>
      </div>

      {summary.conversationHref || summary.reviewHref ? (
        <div className="mt-4 flex flex-wrap gap-3">
          {summary.conversationHref ? (
            <a
              href={summary.conversationHref}
              className="inline-flex min-h-11 items-center text-sm font-semibold text-[#0f766e] underline-offset-2 hover:underline"
            >
              Mesajlara git
            </a>
          ) : null}
          {summary.reviewHref ? (
            <a
              href={summary.reviewHref}
              className="inline-flex min-h-11 items-center text-sm font-semibold text-[#0f766e] underline-offset-2 hover:underline"
            >
              Değerlendirmeyi görüntüle
            </a>
          ) : null}
        </div>
      ) : null}
    </section>
  );
}

function SummaryItem({ label, value }: { label: string; value: string }) {
  return (
    <div className="min-w-0">
      <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-black/35">
        {label}
      </p>
      <p className="mt-1 truncate text-sm font-semibold text-[#0f1f1d]">
        {value}
      </p>
    </div>
  );
}

function Accordion({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <details className="group rounded-2xl border border-teal-900/8 bg-[#fbfcfb]">
      <summary className="flex min-h-11 cursor-pointer list-none items-center justify-between gap-3 px-3.5 text-left marker:content-none [&::-webkit-details-marker]:hidden">
        <span className="text-sm font-semibold text-[#0f1f1d]">{title}</span>
        <ChevronDown className="h-4 w-4 shrink-0 text-black/40 transition group-open:rotate-180" />
      </summary>
      <div className="border-t border-teal-900/8 px-3.5 py-3">{children}</div>
    </details>
  );
}

function OfferHistoryBlock({
  offer,
}: {
  offer: ConcludedProcessModel["offers"][number];
}) {
  return (
    <div
      className={`rounded-2xl border px-3.5 py-3 ${
        offer.accepted
          ? "border-teal-900/12 bg-white"
          : "border-black/[0.06] bg-white/70"
      }`}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-sm font-semibold text-[#0f1f1d]">{offer.sellerName}</p>
          <p className="mt-0.5 text-[12px] text-black/45">{offer.statusLabel}</p>
        </div>
      </div>
      {offer.mediaIds.length > 0 ? (
        <OfferMediaThumbStrip offerId={offer.id} mediaIds={offer.mediaIds} />
      ) : null}
      <NegotiationHistory
        viewer="buyer"
        originalAmount={offer.originalAmount}
        currency={offer.currency}
        offerStatus={offer.status}
        offerCreatedAt={offer.offerCreatedAt}
        negotiations={offer.negotiations}
      />
    </div>
  );
}
