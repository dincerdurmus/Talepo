import Link from "next/link";
import {
  ArrowRight,
  GitCompareArrows,
  MapPin,
  MessageCircle,
} from "lucide-react";

import { OfferActions } from "@/components/panel/OfferActions";
import { OfferCompareToggle } from "@/components/panel/OfferCompareToggle";
import { OfferMediaThumbStrip } from "@/components/panel/OfferMediaThumbStrip";
import { OfferNegotiationPanel } from "@/components/panel/OfferNegotiationPanel";
import { TrustSummaryBadge } from "@/components/panel/TrustSummaryBadge";
import { EmptyIllustration } from "@/components/visuals/EmptyIllustration";
import { resolveOfferCommercialAmount } from "@/lib/offer/commercial-amount";
import {
  compareOffersByCompleteness,
  type OfferCompleteness,
} from "@/lib/offer/offer-completeness";
import {
  offerNegotiationListInclude,
  toOfferNegotiationDtos,
  type OfferNegotiationDto,
} from "@/lib/offer/offer-negotiation";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/server/auth/require-user";
import {
  loadProviderTrustSummaries,
  trustForOfferProvider,
} from "@/server/offer/trust-summary";
import type { TrustSummary } from "@/lib/offer/deal-review";

const statusLabels: Record<string, string> = {
  SUBMITTED: "Yeni",
  VIEWED: "Görüldü",
  ACCEPTED: "Kabul edildi",
  REJECTED: "Reddedildi",
  WITHDRAWN: "Geri çekildi",
  EXPIRED: "Süresi doldu",
};

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
  }>;
};

export default async function IncomingOffersPage() {
  const user = await requireUser();

  const offers = (await prisma.offer.findMany({
    where: {
      request: {
        createdById: user.id,
        deletedAt: null,
      },
    },
    orderBy: { createdAt: "desc" },
    include: {
      request: {
        select: {
          id: true,
          title: true,
          city: true,
          status: true,
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

  for (const offer of offers) {
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

  const pendingTotal = offers.filter((o) =>
    ["SUBMITTED", "VIEWED"].includes(o.status),
  ).length;

  return (
    <>
      <section className="py-4 sm:py-6">
        <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-teal-950/35">
          Alıcı
        </p>
        <div className="mt-2 flex flex-wrap items-end justify-between gap-4">
          <div>
            <h1 className="text-3xl font-semibold tracking-[-0.04em] text-[#0f1f1d] sm:text-4xl">
              Gelen teklifler
            </h1>
            <p className="mt-2 max-w-xl text-sm leading-6 text-black/45">
              Teklifler taleplerinize göre gruplanır. Birden fazla teklifte
              doluluğa göre karşılaştırın; kabul, red veya karşı teklif verin.
            </p>
          </div>
          {pendingTotal > 0 && (
            <span className="rounded-xl border border-teal-800/15 bg-teal-50 px-3 py-1.5 text-xs font-semibold text-teal-950">
              {pendingTotal} bekleyen · {groups.filter((g) => g.pending.length).length}{" "}
              talep
            </span>
          )}
        </div>
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
        <div className="space-y-6">
          {groups.map((group) => {
            const total = group.pending.length + group.others.length;
            const rankedPending = compareOffersByCompleteness(
              group.pending.map((offer) => ({
                ...offer,
                companyVerified: Boolean(offer.company?.isVerified),
              })),
            );

            return (
              <section
                key={group.request.id}
                className="overflow-hidden rounded-[1.75rem] border border-teal-900/10 bg-white shadow-[0_14px_40px_rgba(15,31,29,0.04)]"
              >
                {/* Prominent request header */}
                <div className="border-b border-teal-900/[0.06] bg-gradient-to-br from-[#0f766e]/[0.07] via-white to-[#f4f7f6] px-5 py-5 sm:px-6">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-teal-900/45">
                        Talebiniz
                      </p>
                      <Link
                        href={`/panel/taleplerim/${group.request.id}`}
                        className="mt-1.5 inline-flex items-center gap-2 text-xl font-semibold tracking-tight text-[#0f1f1d] transition hover:text-[#0f766e] sm:text-2xl"
                      >
                        <span className="line-clamp-2">{group.request.title}</span>
                        <ArrowRight className="h-4 w-4 shrink-0 opacity-40" />
                      </Link>
                      <div className="mt-2 flex flex-wrap items-center gap-2 text-xs text-black/45">
                        {group.request.city ? (
                          <span className="inline-flex items-center gap-1">
                            <MapPin className="h-3.5 w-3.5" />
                            {group.request.city}
                          </span>
                        ) : null}
                        <span className="rounded-md bg-white/80 px-2 py-0.5 font-medium text-teal-950/60 ring-1 ring-teal-900/8">
                          {total} teklif
                        </span>
                        {group.pending.length > 0 ? (
                          <span className="rounded-md bg-amber-50 px-2 py-0.5 font-semibold text-amber-900/80 ring-1 ring-amber-200/80">
                            {group.pending.length} yanıt bekliyor
                          </span>
                        ) : null}
                      </div>
                    </div>
                  </div>
                </div>

                <div className="space-y-4 p-4 sm:p-5">
                  {group.pending.length >= 2 ? (
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
                  ) : null}

                  {group.pending.length > 0 ? (
                    <div className="space-y-3">
                      {group.pending.length >= 2 ? (
                        <p className="flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-[0.12em] text-teal-950/40">
                          <GitCompareArrows className="h-3.5 w-3.5" />
                          Doluluğa göre sıralı
                        </p>
                      ) : (
                        <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-teal-950/40">
                          Yanıt bekleyen
                        </p>
                      )}
                      <div className="grid gap-3">
                        {rankedPending.map((offer, index) => (
                          <IncomingOfferCard
                            key={offer.id}
                            offer={offer}
                            actionable
                            completeness={offer.completeness}
                            trust={trustForOfferProvider(trustSummaries, offer)}
                            rank={
                              group.pending.length >= 2 ? index + 1 : undefined
                            }
                          />
                        ))}
                      </div>
                    </div>
                  ) : null}

                  {group.others.length > 0 ? (
                    <div className="space-y-3">
                      <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-black/35">
                        Diğer
                      </p>
                      <div className="grid gap-3">
                        {group.others.map((offer) => (
                          <IncomingOfferCard
                            key={offer.id}
                            offer={offer}
                            trust={trustForOfferProvider(trustSummaries, offer)}
                          />
                        ))}
                      </div>
                    </div>
                  ) : null}
                </div>
              </section>
            );
          })}
        </div>
      )}
    </>
  );
}

function CompletenessBar({ completeness }: { completeness: OfferCompleteness }) {
  const tone =
    completeness.score >= 85
      ? "bg-emerald-500"
      : completeness.score >= 65
        ? "bg-teal-500"
        : completeness.score >= 40
          ? "bg-amber-500"
          : "bg-rose-400";

  return (
    <div className="min-w-[120px]">
      <div className="flex items-center justify-between gap-2 text-[11px]">
        <span className="font-semibold text-teal-950/55">Teklif detayı</span>
        <span className="tabular-nums text-black/40">{completeness.score}%</span>
      </div>
      <div className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-teal-900/8">
        <div
          className={`h-full rounded-full ${tone}`}
          style={{ width: `${completeness.score}%` }}
        />
      </div>
    </div>
  );
}

function IncomingOfferCard({
  offer,
  actionable = false,
  completeness,
  rank,
  trust,
}: {
  offer: OfferRow;
  actionable?: boolean;
  completeness?: OfferCompleteness;
  rank?: number;
  trust?: TrustSummary;
}) {
  const firmName = offer.company?.name || offer.submittedBy.name || "Firma";
  const amount = Number(offer.amount);
  const pendingNegotiation = offer.negotiations.find(
    (row) => row.status === "PENDING",
  );
  const acceptedNegotiation = offer.negotiations.find(
    (row) => row.status === "ACCEPTED",
  );
  const commercialAmount = resolveOfferCommercialAmount({
    offerAmount: amount,
    acceptedNegotiationAmount: acceptedNegotiation
      ? Number(acceptedNegotiation.amount)
      : null,
  });
  const originalLabel = Number.isFinite(amount)
    ? `₺${amount.toLocaleString("tr-TR")}`
    : undefined;
  const computed =
    completeness ??
    compareOffersByCompleteness([
      { ...offer, companyVerified: Boolean(offer.company?.isVerified) },
    ])[0]?.completeness;

  return (
    <article className="rounded-2xl border border-teal-900/[0.07] bg-[#fbfcfc] p-4 sm:p-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            {rank != null ? (
              <span className="inline-flex h-6 min-w-6 items-center justify-center rounded-md bg-[#0f1f1d] px-1.5 text-[11px] font-bold text-white">
                #{rank}
              </span>
            ) : null}
            <span
              className={`rounded-md px-2 py-0.5 text-[11px] font-semibold ${
                actionable
                  ? "bg-teal-50 text-teal-900"
                  : "bg-[#f3f4f6] text-[#4b5563]"
              }`}
            >
              {statusLabels[offer.status] ?? offer.status}
            </span>
            {offer.company?.isVerified && (
              <span className="text-[11px] font-medium text-emerald-700">
                Doğrulanmış firma
              </span>
            )}
            {trust ? <TrustSummaryBadge summary={trust} /> : null}
          </div>
          <h3 className="mt-2 text-lg font-semibold tracking-tight text-[#0f1f1d]">
            {firmName}
          </h3>
          {offer.title ? (
            <p className="mt-0.5 text-sm text-black/45">{offer.title}</p>
          ) : null}
        </div>

        <div className="text-right">
          {offer.status === "ACCEPTED" && commercialAmount !== amount ? (
            <>
              <p className="text-2xl font-semibold tracking-tight text-[#0f1f1d]">
                ₺{commercialAmount.toLocaleString("tr-TR")}
              </p>
              <p className="mt-0.5 text-[11px] text-teal-800/70">Anlaşılan</p>
              <p className="mt-1 text-[11px] text-black/40">
                İlk teklif ₺{amount.toLocaleString("tr-TR")}
              </p>
            </>
          ) : pendingNegotiation ? (
            <>
              <p className="text-2xl font-semibold tracking-tight text-amber-950">
                ₺{Number(pendingNegotiation.amount).toLocaleString("tr-TR")}
              </p>
              <p className="mt-0.5 text-[11px] text-amber-900/70">
                Bekleyen karşı teklif
              </p>
              <p className="mt-1 text-[11px] text-black/40">
                İlk teklif ₺{amount.toLocaleString("tr-TR")}
              </p>
            </>
          ) : (
            <>
              <p className="text-2xl font-semibold tracking-tight text-[#0f1f1d]">
                {Number.isFinite(amount)
                  ? `₺${amount.toLocaleString("tr-TR")}`
                  : "—"}
              </p>
              <p className="mt-0.5 text-[11px] text-black/40">İlk teklif</p>
            </>
          )}
          {offer.deliveryDays != null && (
            <p className="mt-1 text-xs text-black/45">
              {offer.deliveryDays} gün teslim
            </p>
          )}
        </div>
      </div>

      {computed ? (
        <div className="mt-4 rounded-xl border border-teal-900/[0.06] bg-white px-3.5 py-3">
          <CompletenessBar completeness={computed} />
        </div>
      ) : null}

      {offer.description ? (
        <p className="mt-3 line-clamp-3 rounded-xl bg-white px-4 py-3 text-sm leading-6 text-black/65 ring-1 ring-teal-900/[0.05]">
          {offer.description}
        </p>
      ) : null}

      <OfferMediaThumbStrip
        offerId={offer.id}
        mediaIds={offer.media.map((item) => item.id)}
        compact
      />

      {actionable || offer.negotiations.length > 0 ? (
        <OfferNegotiationPanel
          offerId={offer.id}
          originalAmount={amount}
          currency={offer.currency}
          offerStatus={offer.status}
          viewer="buyer"
          negotiations={toOfferNegotiationDtos(offer.negotiations)}
          canMutate={actionable}
        />
      ) : null}

      {actionable && (
        <OfferActions
          offerId={offer.id}
          hasPendingNegotiation={Boolean(pendingNegotiation)}
          originalAmountLabel={originalLabel}
        />
      )}

      {offer.status === "ACCEPTED" && offer.conversation && (
        <Link
          href={`/panel/mesajlar/${offer.conversation.id}`}
          className="mt-4 inline-flex min-h-11 items-center gap-2 rounded-xl bg-[#0f1f1d] px-4 text-xs font-semibold text-white"
        >
          <MessageCircle className="h-3.5 w-3.5" />
          Mesajlara git
        </Link>
      )}
    </article>
  );
}
