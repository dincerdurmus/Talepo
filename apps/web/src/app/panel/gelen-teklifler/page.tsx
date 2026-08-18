import Link from "next/link";
import {
  ArrowRight,
  GitCompareArrows,
  MapPin,
} from "lucide-react";

import {
  IncomingOfferCard,
  type IncomingOfferCardData,
} from "@/components/panel/IncomingOfferCard";
import { OfferCompareToggle } from "@/components/panel/OfferCompareToggle";
import { EmptyIllustration } from "@/components/visuals/EmptyIllustration";
import { compareOffersByCompleteness } from "@/lib/offer/offer-completeness";
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
  };
}

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

  return (
    <>
      <section className="py-4 sm:py-6">
        <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-teal-950/35">
          Alıcı
        </p>
        <h1 className="mt-2 text-3xl font-semibold tracking-[-0.04em] text-[#0f1f1d] sm:text-4xl">
          Gelen teklifler
        </h1>
        <p className="mt-2 max-w-xl text-sm leading-6 text-black/45">
          Teklifler taleplerinize göre gruplanır. Satıcıyı, fiyatı ve teslimatı
          görün; kabul edin, reddedin veya pazarlık yapın.
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
        <div className="space-y-5">
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
                className="overflow-hidden rounded-[1.5rem] border border-teal-900/[0.08] bg-white shadow-[0_10px_28px_rgba(15,31,29,0.03)]"
              >
                <div className="border-b border-teal-900/[0.06] px-4 py-3.5 sm:px-5">
                  <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-teal-900/45">
                    Talebiniz
                  </p>
                  <div className="mt-1 flex flex-wrap items-start justify-between gap-x-4 gap-y-2">
                    <div className="min-w-0">
                      <Link
                        href={`/panel/taleplerim/${group.request.id}`}
                        className="inline-flex max-w-full items-center gap-2 text-lg font-semibold tracking-tight text-[#0f1f1d] transition hover:text-[#0f766e] sm:text-xl"
                      >
                        <span className="line-clamp-2">{group.request.title}</span>
                        <ArrowRight className="h-4 w-4 shrink-0 opacity-40" />
                      </Link>
                      {group.request.city ? (
                        <p className="mt-1 inline-flex items-center gap-1 text-xs text-black/45">
                          <MapPin className="h-3.5 w-3.5" />
                          {group.request.city}
                        </p>
                      ) : null}
                    </div>
                    <div className="flex flex-wrap items-center gap-1.5">
                      <span className="rounded-md bg-teal-50 px-2 py-0.5 text-[11px] font-medium text-teal-950/70">
                        {total} teklif
                      </span>
                      {group.pending.length > 0 ? (
                        <span className="rounded-md bg-amber-50 px-2 py-0.5 text-[11px] font-semibold text-amber-900/80">
                          {group.pending.length} yanıt bekliyor
                        </span>
                      ) : null}
                    </div>
                  </div>
                </div>

                <div className="space-y-4 p-3 sm:p-4">
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
                            offer={toCardData(offer)}
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
                            offer={toCardData(offer)}
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
