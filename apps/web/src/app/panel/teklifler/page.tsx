import Link from "next/link";
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
import { getCompanyWorkspace } from "@/lib/panel/company-workspace";
import { prisma } from "@/lib/prisma";
import { formatListingBudget } from "@/lib/visuals/category-visuals";
import { requireUser } from "@/server/auth/require-user";
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
  }>;
}) {
  const user = await requireUser();
  const workspace = await getCompanyWorkspace(user.id);
  const { gonderildi, guncellendi, teklif } = await searchParams;
  const justSubmitted = gonderildi === "1";
  const justUpdated = guncellendi === "1";
  const highlightOfferId = teklif?.trim() || null;

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

  const negotiating = offers.filter(
    (o) =>
      ["SUBMITTED", "VIEWED"].includes(o.status) &&
      o.negotiations.some((row) => row.status === "PENDING"),
  ).length;

  const counts = {
    open: offers.filter((o) =>
      ["SUBMITTED", "VIEWED"].includes(o.status),
    ).length,
    negotiating,
    accepted: offers.filter((o) => o.status === "ACCEPTED").length,
    rejected: offers.filter((o) => o.status === "REJECTED").length,
  };

  const pageTitle = workspace ? "Tekliflerimiz" : "Tekliflerim";
  const pageSubtitle = workspace
    ? "Firmanızın tekliflerini talep bütçesi ve pazarlıkla aynı kartta karşılaştırın."
    : "Gönderdiğiniz teklifleri müşteri talebiyle karşılaştırın; sıra sizdeyse pazarlık yapın.";

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
        <p className="talepo-page-eyebrow">
          {workspace ? workspace.companyName : "Teklif takibi"}
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
              label: "Açık",
              value: counts.open,
              hint: "Bekleyen teklifler",
              icon: CircleDot,
              wrap: "border-teal-900/10 bg-[linear-gradient(160deg,#f3faf8_0%,#e8f4f1_55%,#f7fbfa_100%)] shadow-[0_10px_24px_rgba(15,118,110,0.08)]",
              iconWrap: "bg-teal-800/10 text-teal-800",
              valueClass: "text-teal-950",
            },
            {
              label: "Pazarlık",
              value: counts.negotiating,
              hint: "Karşı teklif turları",
              icon: Handshake,
              wrap: "border-amber-200/70 bg-[linear-gradient(160deg,#fffbeb_0%,#fef3c7_55%,#fff8eb_100%)] shadow-[0_10px_24px_rgba(217,119,6,0.1)]",
              iconWrap: "bg-amber-500/15 text-amber-800",
              valueClass: "text-amber-950",
            },
            {
              label: "Kabul",
              value: counts.accepted,
              hint: "Sonuçlanan kazanç",
              icon: ThumbsUp,
              wrap: "border-emerald-200/70 bg-[linear-gradient(160deg,#ecfdf5_0%,#d1fae5_55%,#f0fdf7_100%)] shadow-[0_10px_24px_rgba(5,150,105,0.1)]",
              iconWrap: "bg-emerald-600/12 text-emerald-800",
              valueClass: "text-emerald-950",
            },
            {
              label: "Red",
              value: counts.rejected,
              hint: "Kapanmış teklifler",
              icon: ThumbsDown,
              wrap: "border-rose-200/70 bg-[linear-gradient(160deg,#fff1f2_0%,#ffe4e6_55%,#fff7f7_100%)] shadow-[0_10px_24px_rgba(225,29,72,0.08)]",
              iconWrap: "bg-rose-500/12 text-rose-800",
              valueClass: "text-rose-950",
            },
          ] as const
        ).map((item) => {
          const Icon = item.icon;
          return (
            <div
              key={item.label}
              className={`relative overflow-hidden rounded-[18px] border p-4 ${item.wrap}`}
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
            </div>
          );
        })}
      </div>

      <OfferIntelligenceHub
        mode={intelligenceHubMode}
        readyItems={readyIntelligence}
      />

      {offers.length === 0 ? (
        <Gate
          title="Henüz teklif yok"
          body="Keşiften uygun taleplere teklif verin; burada talep ve teklifiniz yan yana görünür."
          href="/panel/talepler"
          cta="Talepleri keşfet"
        />
      ) : (
        <section className="grid gap-6">
          {offers.map((offer) => {
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
