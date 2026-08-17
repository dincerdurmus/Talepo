import Link from "next/link";
import { notFound } from "next/navigation";
import {
  ArrowLeft,
  CalendarDays,
  CircleCheck,
  FileText,
  MapPin,
  MessageSquareText,
  PencilLine,
  Sparkles,
  WalletCards,
} from "lucide-react";

import { DeleteRequestButton } from "@/components/panel/DeleteRequestButton";
import { OfferActions } from "@/components/panel/OfferActions";
import { OfferMediaThumbStrip } from "@/components/panel/OfferMediaThumbStrip";
import { OfferNegotiationPanel } from "@/components/panel/OfferNegotiationPanel";
import { TrustSummaryBadge } from "@/components/panel/TrustSummaryBadge";
import { UrgentBroadcastBanner } from "@/components/panel/UrgentBroadcastBanner";
import { CategoryVisualThumb } from "@/components/visuals/CategoryVisualThumb";
import { EmptyIllustration } from "@/components/visuals/EmptyIllustration";
import { displayRequestFieldValue } from "@/lib/field-display";
import {
  offerNegotiationListInclude,
  toOfferNegotiationDtos,
} from "@/lib/offer/offer-negotiation";
import {
  formatListingBudget,
  getCategoryVisual,
} from "@/lib/visuals/category-visuals";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/server/auth/require-user";
import { canEditRequestStatus } from "@/server/request/update-request";
import {
  loadProviderTrustSummaries,
  trustForOfferProvider,
} from "@/server/offer/trust-summary";

const statusLabels: Record<string, string> = {
  DRAFT: "Taslak",
  PUBLISHED: "Yayınlandı",
  RECEIVING_OFFERS: "Teklif alıyor",
  OFFER_SELECTED: "Teklif seçildi",
  IN_PROGRESS: "Devam ediyor",
  COMPLETED: "Tamamlandı",
  CANCELLED: "İptal edildi",
  EXPIRED: "Süresi doldu",
};

const statusStyles: Record<string, string> = {
  DRAFT: "border-black/10 bg-black/[0.04] text-black/55",
  PUBLISHED: "border-teal-900/12 bg-teal-50 text-teal-800",
  RECEIVING_OFFERS: "border-teal-900/12 bg-teal-50 text-teal-800",
  OFFER_SELECTED: "border-sky-900/12 bg-sky-50 text-sky-800",
  IN_PROGRESS: "border-amber-900/12 bg-amber-50 text-amber-900",
  COMPLETED: "border-emerald-900/12 bg-emerald-50 text-emerald-800",
  CANCELLED: "border-red-900/10 bg-red-50 text-red-800",
  EXPIRED: "border-black/10 bg-black/[0.04] text-black/45",
};

export default async function RequestDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ "acil-yayin"?: string }>;
}) {
  const user = await requireUser();
  const { id } = await params;
  const query = await searchParams;
  const urgentBroadcastMode =
    query["acil-yayin"] === "1"
      ? "ask"
      : query["acil-yayin"] === "gonderildi"
        ? "sent"
        : null;

  const request = await prisma.request.findFirst({
    where: {
      id,
      createdById: user.id,
      deletedAt: null,
    },
    include: {
      category: { select: { name: true, slug: true } },
      fieldValues: {
        orderBy: { field: { sortOrder: "asc" } },
        include: { field: true },
      },
      offers: {
        orderBy: { createdAt: "desc" },
        include: {
          company: { select: { id: true, name: true, isVerified: true } },
          submittedBy: { select: { id: true, name: true } },
          conversation: { select: { id: true } },
          media: {
            orderBy: { sortOrder: "asc" },
            select: { id: true },
          },
          negotiations: offerNegotiationListInclude,
        },
      },
      _count: { select: { matches: true } },
    },
  });

  if (!request) notFound();

  const trustSummaries = await loadProviderTrustSummaries({
    personalUserIds: request.offers
      .filter((offer) => !offer.company)
      .map((offer) => offer.submittedBy.id),
    companyIds: request.offers
      .map((offer) => offer.company?.id)
      .filter((id): id is string => Boolean(id)),
  });

  const editable = canEditRequestStatus(request.status);
  const matchedCompanyCount = request._count.matches;
  const categorySlug = request.category.slug;
  const categoryLook = getCategoryVisual(categorySlug);
  const statusLabel = statusLabels[request.status] ?? request.status;
  const statusChipClass =
    statusStyles[request.status] ?? "border-black/10 bg-black/[0.04] text-black/55";

  return (
    <>
      <header className="flex flex-wrap items-center justify-between gap-3 rounded-[26px] border border-black/[0.06] bg-white/85 px-4 py-3.5 backdrop-blur-xl sm:px-5 sm:py-4">
        <Link
          href="/panel/taleplerim"
          className="inline-flex items-center gap-2 rounded-full px-2 py-1.5 text-sm font-medium text-black/45 transition hover:bg-black/[0.04] hover:text-black"
        >
          <ArrowLeft className="h-4 w-4" />
          Taleplerim
        </Link>
        <div className="flex flex-wrap items-center gap-2">
          {editable && (
            <Link
              href={`/panel/taleplerim/${request.id}/duzenle`}
              className="inline-flex items-center gap-2 rounded-full bg-black px-4 py-2 text-xs font-semibold text-white transition hover:bg-black/80"
            >
              <PencilLine className="h-3.5 w-3.5" />
              Talebimi düzelt
            </Link>
          )}
          <DeleteRequestButton requestId={request.id} variant="header" />
        </div>
      </header>

      <section className="relative mt-5 overflow-hidden rounded-[28px] border border-black/[0.06] bg-gradient-to-br from-white via-[#f8fbfa] to-[#eef6f4] px-5 py-7 shadow-[0_20px_70px_rgba(15,118,110,0.07)] transition-shadow duration-300 sm:px-8 sm:py-8">
        <div
          aria-hidden
          className="pointer-events-none absolute -right-16 -top-20 h-56 w-56 rounded-full bg-teal-200/25 blur-[72px]"
        />
        <div
          aria-hidden
          className="pointer-events-none absolute -bottom-24 left-1/4 h-48 w-48 rounded-full bg-sky-200/20 blur-[64px]"
        />
        <div
          aria-hidden
          className="pointer-events-none absolute right-1/3 top-1/2 h-32 w-32 rounded-full bg-amber-100/30 blur-[48px]"
        />

        <div className="relative flex items-start gap-4 sm:gap-5">
          <CategoryVisualThumb
            categorySlug={categorySlug}
            categoryName={request.category.name}
            coverImageUrl={request.coverImageUrl}
            size="lg"
          />
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-2">
              <span
                className={`inline-flex items-center rounded-full px-3 py-1.5 text-xs font-semibold shadow-sm ${categoryLook.chip}`}
              >
                {request.category.name}
              </span>
              <span
                className={`inline-flex items-center rounded-full border px-3 py-1.5 text-xs font-semibold ${statusChipClass}`}
              >
                {statusLabel}
              </span>
              {request.isUrgent && (
                <span className="inline-flex items-center rounded-full border border-amber-900/15 bg-amber-50 px-3 py-1.5 text-xs font-semibold text-amber-900">
                  Acil
                </span>
              )}
              {request.aiScore !== null && (
                <span className="inline-flex items-center gap-1.5 rounded-full border border-sky-900/10 bg-sky-50/90 px-3 py-1.5 text-xs font-semibold text-sky-800">
                  <Sparkles className="h-3.5 w-3.5 text-sky-600" />
                  AI kalite puanı {request.aiScore}/100
                </span>
              )}
            </div>

            <h1 className="mt-3 max-w-4xl text-3xl font-semibold tracking-[-0.04em] text-black/90 sm:mt-4 sm:text-[2.75rem] sm:leading-[1.08]">
              {request.title}
            </h1>

            <div className="mt-4 flex flex-wrap gap-2 sm:mt-5">
              {request.city && (
                <MetaChip icon={<MapPin className="h-3.5 w-3.5" />}>
                  {request.city}
                </MetaChip>
              )}
              <MetaChip icon={<CalendarDays className="h-3.5 w-3.5" />}>
                {formatDate(request.publishedAt ?? request.createdAt)}
              </MetaChip>
              <MetaChip icon={<MessageSquareText className="h-3.5 w-3.5" />}>
                {request.offers.length} teklif
              </MetaChip>
              <MetaChip icon={<Sparkles className="h-3.5 w-3.5" />}>
                {matchedCompanyCount} firmaya iletildi
              </MetaChip>
            </div>
          </div>
        </div>
      </section>

      {urgentBroadcastMode ? (
        <UrgentBroadcastBanner
          requestId={request.id}
          mode={urgentBroadcastMode}
        />
      ) : null}

      <div className="mt-5 grid gap-5 lg:grid-cols-[minmax(0,1fr)_340px] lg:gap-6">
        <section className="space-y-5">
          <div className="rounded-[28px] border border-black/[0.06] bg-white p-6 shadow-[0_18px_60px_rgba(0,0,0,0.04)] transition-shadow duration-300 hover:shadow-[0_22px_70px_rgba(15,118,110,0.07)] sm:p-8">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-[14px] bg-teal-50 text-teal-700">
                <FileText className="h-4 w-4" />
              </div>
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.16em] text-black/35">
                  Talep açıklaması
                </p>
                <p className="mt-0.5 text-sm text-black/40">
                  AI tarafından düzenlenmiş metin
                </p>
              </div>
            </div>
            <p className="mt-6 whitespace-pre-line text-[17px] leading-[1.75] text-black/70">
              {request.professionalDescription || request.description}
            </p>
          </div>

          {request.fieldValues.length > 0 && (
            <div className="rounded-[28px] border border-black/[0.06] bg-white p-6 shadow-[0_18px_60px_rgba(0,0,0,0.04)] transition-shadow duration-300 hover:shadow-[0_22px_70px_rgba(15,118,110,0.07)] sm:p-8">
              <div className="flex items-end justify-between gap-4">
                <div>
                  <h2 className="text-xl font-semibold tracking-tight sm:text-2xl">
                    Teknik detaylar
                  </h2>
                  <p className="mt-1 text-sm text-black/40">
                    {request.fieldValues.length} alan
                  </p>
                </div>
              </div>
              <div className="mt-6 grid gap-3 sm:grid-cols-2">
                {request.fieldValues.map((value) => (
                  <div
                    key={value.id}
                    className="rounded-[20px] border border-black/[0.05] bg-gradient-to-br from-[#fafaf8] to-[#f2f6f5] p-4 transition duration-300 hover:border-teal-900/10 hover:shadow-[0_10px_32px_rgba(15,118,110,0.07)]"
                  >
                    <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-black/35">
                      {value.field.label}
                    </p>
                    <p className="mt-2 text-[15px] font-semibold leading-snug text-black/80">
                      {displayRequestFieldValue({
                        ...value,
                        categoryId: categorySlug,
                      })}
                    </p>
                  </div>
                ))}
              </div>
            </div>
          )}

          <div className="rounded-[28px] border border-black/[0.06] bg-white p-6 shadow-[0_18px_60px_rgba(0,0,0,0.04)] transition-shadow duration-300 hover:shadow-[0_22px_70px_rgba(15,118,110,0.07)] sm:p-8">
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.16em] text-black/35">
                  Teklifler
                </p>
                <h2 className="mt-2 text-xl font-semibold tracking-tight sm:text-2xl">
                  {request.offers.length === 0
                    ? "Henüz teklif gelmedi"
                    : `${request.offers.length} teklif geldi`}
                </h2>
              </div>
              <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-[16px] bg-amber-50 text-amber-700">
                <MessageSquareText className="h-5 w-5" />
              </div>
            </div>

            {request.offers.length === 0 ? (
              <div className="mt-6 rounded-[22px] border border-dashed border-black/[0.08] bg-[#f8f9f7] px-5 py-8 text-center">
                <EmptyIllustration variant="offers" />
                <p className="mx-auto mt-4 max-w-md text-sm leading-6 text-black/45">
                  Talebiniz yayınlandı. Gelen teklifler burada ve{" "}
                  <Link
                    href="/panel/gelen-teklifler"
                    className="font-semibold text-teal-800 underline-offset-2 hover:underline"
                  >
                    Gelen teklifler
                  </Link>{" "}
                  sayfasında görünür. Kabul veya karşı teklif ile süreç ilerler.
                </p>
              </div>
            ) : (
              <div className="mt-6 space-y-3">
                {request.offers.map((offer) => (
                  <div
                    key={offer.id}
                    className="rounded-[22px] border border-black/[0.06] bg-white p-5 transition duration-300 hover:border-teal-900/10 hover:shadow-[0_12px_40px_rgba(15,118,110,0.06)]"
                  >
                    <div className="flex items-start justify-between gap-4">
                      <div>
                        <p className="font-semibold text-black/85">
                          {offer.company?.name ||
                            offer.submittedBy.name ||
                            "Firma"}
                        </p>
                        <div className="mt-1">
                          <TrustSummaryBadge
                            summary={trustForOfferProvider(trustSummaries, offer)}
                          />
                        </div>
                        <p className="mt-1 text-sm text-black/40">
                          {offer.deliveryDays
                            ? `${offer.deliveryDays} gün teslim`
                            : "Teslim süresi belirtilmedi"}
                        </p>
                        <p className="mt-3 text-sm leading-6 text-black/55">
                          {offer.description}
                        </p>
                        <OfferMediaThumbStrip
                          offerId={offer.id}
                          mediaIds={offer.media.map((item) => item.id)}
                        />
                      </div>
                      <p className="shrink-0 text-lg font-semibold text-black/85">
                        {formatMoney(Number(offer.amount), offer.currency)}
                      </p>
                    </div>
                    {["SUBMITTED", "VIEWED"].includes(offer.status) ||
                    offer.negotiations.length > 0 ? (
                      <OfferNegotiationPanel
                        offerId={offer.id}
                        originalAmount={Number(offer.amount)}
                        currency={offer.currency}
                        offerStatus={offer.status}
                        viewer="buyer"
                        negotiations={toOfferNegotiationDtos(offer.negotiations)}
                        canMutate={["SUBMITTED", "VIEWED"].includes(
                          offer.status,
                        )}
                      />
                    ) : null}
                    {["SUBMITTED", "VIEWED"].includes(offer.status) && (
                      <OfferActions
                        offerId={offer.id}
                        hasPendingNegotiation={offer.negotiations.some(
                          (row) => row.status === "PENDING",
                        )}
                      />
                    )}
                    {offer.conversation?.id &&
                    ["SUBMITTED", "VIEWED", "ACCEPTED"].includes(
                      offer.status,
                    ) ? (
                      <Link
                        href={`/panel/mesajlar/${offer.conversation.id}`}
                        className="mt-3 inline-flex text-xs font-semibold text-[#0f766e] underline-offset-2 hover:underline"
                      >
                        {offer.status === "ACCEPTED"
                          ? "Mesajlara git"
                          : "Pazarlık sohbetini aç"}
                      </Link>
                    ) : null}
                    {offer.status === "ACCEPTED" && !offer.conversation?.id ? (
                      <p className="mt-3 text-xs font-semibold text-teal-700">
                        Kabul edildi — mesajlaşma açıldı
                      </p>
                    ) : null}
                  </div>
                ))}
              </div>
            )}
          </div>
        </section>

        <aside className="space-y-4 lg:sticky lg:top-6 lg:self-start">
          <div className="relative overflow-hidden rounded-[28px] border border-teal-950/25 bg-gradient-to-br from-[#0f2926] via-[#132a35] to-[#122845] p-6 text-white shadow-[0_24px_75px_rgba(15,118,110,0.24)]">
            <div
              aria-hidden
              className="pointer-events-none absolute -right-10 -top-10 h-36 w-36 rounded-full bg-teal-400/15 blur-[52px]"
            />
            <div
              aria-hidden
              className="pointer-events-none absolute -bottom-8 left-0 h-28 w-28 rounded-full bg-sky-400/12 blur-[44px]"
            />
            <div className="relative">
              <div className="flex h-11 w-11 items-center justify-center rounded-[17px] border border-white/10 bg-white/10">
                <Sparkles className="h-5 w-5 text-teal-300" />
              </div>
              <p className="mt-5 text-xs font-semibold uppercase tracking-[0.16em] text-white/45">
                AI özeti
              </p>
              <p className="mt-3 whitespace-pre-line text-sm leading-7 text-white/85">
                {request.aiSummary ||
                  "Talep AI tarafından analiz edilerek yayınlandı."}
              </p>
              {request.aiScore !== null && (
                <div className="mt-5 inline-flex items-center gap-2 rounded-full border border-white/15 bg-white/10 px-3 py-1.5 text-xs font-semibold text-white/90">
                  <Sparkles className="h-3.5 w-3.5 text-sky-300" />
                  Kalite puanı {request.aiScore}/100
                </div>
              )}
            </div>
          </div>

          <div className="rounded-[28px] border border-black/[0.06] bg-white p-5 shadow-[0_16px_55px_rgba(0,0,0,0.035)] sm:p-6">
            <p className="text-xs font-semibold uppercase tracking-[0.16em] text-black/35">
              Durum ve işlemler
            </p>
            <div className="mt-1">
              <SummaryRow
                icon={<CircleCheck className="h-4 w-4" />}
                label="Durum"
                value={statusLabel}
                tone="teal"
              />
              <SummaryRow
                icon={<MessageSquareText className="h-4 w-4" />}
                label="Teklif"
                value={`${request.offers.length}`}
                tone="amber"
              />
              <SummaryRow
                icon={<WalletCards className="h-4 w-4" />}
                label="Bütçe"
                value={
                  formatListingBudget(
                    request.budgetMin,
                    request.budgetMax,
                    request.currency,
                  ) || "Belirtilmedi"
                }
                tone="sky"
                last={!editable}
              />
            </div>
            {editable && (
              <Link
                href={`/panel/taleplerim/${request.id}/duzenle`}
                className="mt-4 flex w-full items-center justify-center gap-2 rounded-[18px] bg-black px-4 py-3 text-sm font-semibold text-white transition hover:bg-black/80"
              >
                <PencilLine className="h-4 w-4" />
                Talebimi düzelt
              </Link>
            )}
            <div className={editable ? "" : "mt-4"}>
              <DeleteRequestButton requestId={request.id} variant="aside" />
            </div>
          </div>
        </aside>
      </div>
    </>
  );
}

function MetaChip({
  icon,
  children,
}: {
  icon: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <span className="inline-flex items-center gap-1.5 rounded-full border border-black/[0.06] bg-white/90 px-3 py-2 text-xs font-medium text-black/55 shadow-sm">
      <span className="text-teal-700/70">{icon}</span>
      {children}
    </span>
  );
}

function SummaryRow({
  icon,
  label,
  value,
  tone = "teal",
  last = false,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
  tone?: "teal" | "amber" | "sky";
  last?: boolean;
}) {
  const iconSurface = {
    teal: "bg-teal-50 text-teal-700",
    amber: "bg-amber-50 text-amber-700",
    sky: "bg-sky-50 text-sky-700",
  }[tone];

  return (
    <div
      className={`flex items-center justify-between gap-4 py-3.5 ${last ? "" : "border-b border-black/[0.06]"}`}
    >
      <span className="flex min-w-0 items-center gap-3 text-sm text-black/45">
        <span
          className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-[12px] ${iconSurface}`}
        >
          {icon}
        </span>
        {label}
      </span>
      <span className="shrink-0 text-right text-sm font-semibold text-black/80">
        {value}
      </span>
    </div>
  );
}

function formatDate(date: Date) {
  return new Intl.DateTimeFormat("tr-TR", {
    day: "numeric",
    month: "long",
    year: "numeric",
  }).format(date);
}

function formatMoney(amount: number, currency: string) {
  return new Intl.NumberFormat("tr-TR", {
    style: "currency",
    currency,
    maximumFractionDigits: 0,
  }).format(amount);
}
