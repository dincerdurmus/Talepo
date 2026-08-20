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
import { ComplaintForm } from "@/components/panel/ComplaintForm";
import { CloneRequestAsDraftControl } from "@/components/panel/my-requests/CloneRequestAsDraftControl";
import { ConcludedProcessPanel } from "@/components/panel/my-requests/ConcludedProcessPanel";
import { IncomingOffersTransitionCard } from "@/components/panel/my-requests/IncomingOffersTransitionCard";
import { UrgentBroadcastBanner } from "@/components/panel/UrgentBroadcastBanner";
import { CategoryVisualThumb } from "@/components/visuals/CategoryVisualThumb";
import { displayRequestFieldValue } from "@/lib/field-display";
import { buildIncomingRequestWorkspacePath } from "@/lib/offer/incoming-offer-inbox";
import {
  offerNegotiationListInclude,
  toOfferNegotiationDtos,
} from "@/lib/offer/offer-negotiation";
import { buildConcludedProcessHistory } from "@/lib/panel/concluded-process-history";
import { MY_REQUEST_CONCLUDED_STATUSES } from "@/lib/panel/my-requests-surface";
import { formatListingBudget } from "@/lib/visuals/category-visuals";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/server/auth/require-user";
import { canCloneRequestAsDraft } from "@/server/request/clone-request-as-draft";
import { canEditRequestStatus } from "@/server/request/update-request";
import { canDeleteRequestStatus } from "@/server/request/delete-request";

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
          conversation: { select: { id: true, createdAt: true } },
          media: {
            orderBy: { sortOrder: "asc" },
            select: { id: true },
          },
          negotiations: offerNegotiationListInclude,
        },
      },
      dealOutcomes: {
        select: {
          status: true,
          agreedPrice: true,
          currency: true,
          completedAt: true,
          buyerConfirmedAt: true,
          supplierConfirmedAt: true,
          conversationId: true,
          reviews: {
            select: {
              id: true,
              reviewerSide: true,
              createdAt: true,
            },
          },
        },
      },
      _count: { select: { matches: true } },
    },
  });

  if (!request) notFound();

  const editable = canEditRequestStatus(request.status);
  const deletable = canDeleteRequestStatus(request.status);
  const cloneable = canCloneRequestAsDraft(request.status);
  const concluded = MY_REQUEST_CONCLUDED_STATUSES.has(request.status);
  const processHistory = concluded
    ? buildConcludedProcessHistory({
        status: request.status,
        createdAt: request.createdAt,
        publishedAt: request.publishedAt,
        completedAt: request.completedAt,
        cancelledAt: request.cancelledAt,
        offers: request.offers.map((offer) => ({
          id: offer.id,
          status: offer.status,
          amount: Number(offer.amount),
          currency: offer.currency,
          createdAt: offer.createdAt,
          submittedAt: offer.submittedAt,
          acceptedAt: offer.acceptedAt,
          companyName: offer.company?.name ?? null,
          submittedByName: offer.submittedBy.name,
          mediaIds: offer.media.map((item) => item.id),
          conversationId: offer.conversation?.id ?? null,
          conversationCreatedAt: offer.conversation?.createdAt ?? null,
          negotiations: toOfferNegotiationDtos(offer.negotiations),
        })),
        dealOutcomes: request.dealOutcomes.map((deal) => ({
          status: deal.status,
          agreedPrice:
            deal.agreedPrice != null ? Number(deal.agreedPrice) : null,
          currency: deal.currency,
          completedAt: deal.completedAt,
          buyerConfirmedAt: deal.buyerConfirmedAt,
          supplierConfirmedAt: deal.supplierConfirmedAt,
          conversationId: deal.conversationId,
          reviews: deal.reviews,
        })),
      })
    : null;
  const matchedCompanyCount = request._count.matches;
  const categorySlug = request.category.slug;
  const statusLabel = statusLabels[request.status] ?? request.status;
  const statusChipClass =
    statusStyles[request.status] ?? "border-black/10 bg-black/[0.04] text-black/55";
  const offerCount = request.offers.length;
  const incomingOffersHref = buildIncomingRequestWorkspacePath({
    requestId: request.id,
  });

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
          {cloneable ? (
            <CloneRequestAsDraftControl
              requestId={request.id}
              variant="header"
            />
          ) : null}
          {deletable ? (
            <DeleteRequestButton requestId={request.id} variant="header" />
          ) : null}
        </div>
      </header>

      <section className="relative mt-5 overflow-hidden rounded-[26px] border border-black/[0.05] bg-[linear-gradient(135deg,#FAFCFB_0%,#F2F7F6_52%,#E8F4F1_100%)] px-5 py-5 shadow-[0_10px_32px_rgba(15,31,29,0.035)] sm:px-6 sm:py-5">
        <div
          aria-hidden
          className="pointer-events-none absolute inset-px rounded-[25px] ring-1 ring-inset ring-white/55"
        />
        <div
          aria-hidden
          className="pointer-events-none absolute inset-0 opacity-[0.035]"
          style={{
            backgroundImage:
              "linear-gradient(rgba(15,31,29,0.55) 1px, transparent 1px), linear-gradient(90deg, rgba(15,31,29,0.55) 1px, transparent 1px)",
            backgroundSize: "1.75rem 1.75rem",
            maskImage:
              "radial-gradient(ellipse 70% 80% at 92% 18%, #000 0%, transparent 72%)",
          }}
        />
        <div
          aria-hidden
          className="pointer-events-none absolute -right-16 top-[-35%] h-[140%] w-[48%] bg-[radial-gradient(ellipse_at_center,rgba(15,118,110,0.055),transparent_70%)]"
        />

        <div className="relative flex items-start gap-3.5 sm:gap-4">
          <CategoryVisualThumb
            categorySlug={categorySlug}
            categoryName={request.category.name}
            coverImageUrl={request.coverImageUrl}
            requestTitle={request.title}
            size="lg"
            className="h-[6.5rem] w-[6.5rem] rounded-[1.25rem] shadow-none ring-1 ring-black/[0.06] sm:h-[7rem] sm:w-[7rem]"
          />
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-1.5 sm:gap-2">
              <span className="inline-flex items-center rounded-full border border-teal-900/8 bg-white/70 px-2.5 py-1 text-[11px] font-semibold text-teal-900/65">
                {request.category.name}
              </span>
              <span
                className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[11px] font-semibold ${statusChipClass}`}
              >
                <span
                  className="h-1.5 w-1.5 shrink-0 rounded-full bg-emerald-500/85"
                  aria-hidden
                />
                {statusLabel}
              </span>
              {request.isUrgent && (
                <span className="inline-flex items-center rounded-full border border-amber-900/12 bg-amber-50/80 px-2.5 py-1 text-[11px] font-semibold text-amber-900">
                  Acil
                </span>
              )}
              {request.aiScore !== null && (
                <span className="inline-flex items-center gap-1 rounded-full border border-black/[0.05] bg-white/55 px-2.5 py-1 text-[11px] font-medium text-black/45">
                  <Sparkles className="h-3 w-3 text-sky-700/70" aria-hidden />
                  AI kalite {request.aiScore}/100
                </span>
              )}
            </div>

            <h1 className="mt-2.5 max-w-3xl text-[1.7rem] font-semibold tracking-[-0.04em] text-[#0f1f1d] sm:mt-3 sm:text-[2.25rem] sm:leading-[1.08]">
              {request.title}
            </h1>

            <div className="mt-2.5 flex flex-wrap gap-1.5 sm:mt-3">
              {request.city && (
                <MetaChip icon={<MapPin className="h-3.5 w-3.5" />}>
                  {request.city}
                </MetaChip>
              )}
              <MetaChip icon={<CalendarDays className="h-3.5 w-3.5" />}>
                {formatDate(request.publishedAt ?? request.createdAt)}
              </MetaChip>
              <MetaChip
                href={incomingOffersHref}
                icon={<MessageSquareText className="h-3.5 w-3.5" />}
              >
                {offerCount} teklif
              </MetaChip>
              <MetaChip
                muted={matchedCompanyCount === 0}
                icon={<Sparkles className="h-3.5 w-3.5" />}
              >
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

      <div className="mt-5 grid gap-5 xl:grid-cols-[minmax(0,1fr)_320px] xl:gap-6">
        <section className="space-y-5">
          {processHistory ? (
            <ConcludedProcessPanel model={processHistory} />
          ) : null}
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

          {!concluded ? (
            <IncomingOffersTransitionCard
              requestId={request.id}
              offerCount={offerCount}
            />
          ) : null}

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
        </section>

        <aside className="space-y-4 xl:sticky xl:top-6 xl:self-start">
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
                value={`${offerCount}`}
                tone="amber"
                href={incomingOffersHref}
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
                className="mt-4 flex w-full items-center justify-center gap-2 rounded-[18px] border border-black/10 bg-white px-4 py-3 text-sm font-semibold text-[#0f1f1d]/80 transition hover:bg-black/[0.03]"
              >
                <PencilLine className="h-4 w-4" />
                Talebimi düzelt
              </Link>
            )}
            {cloneable ? (
              <div className={editable ? "mt-3" : "mt-4"}>
                <CloneRequestAsDraftControl
                  requestId={request.id}
                  variant="header"
                />
              </div>
            ) : null}
            {deletable ? (
              <div className={editable || cloneable ? "" : "mt-4"}>
                <DeleteRequestButton requestId={request.id} variant="aside" />
              </div>
            ) : null}
          </div>
        </aside>
      </div>
      <ComplaintForm subjectType="REQUEST" subjectId={request.id} />
    </>
  );
}

function MetaChip({
  icon,
  children,
  muted = false,
  href,
}: {
  icon: React.ReactNode;
  children: React.ReactNode;
  muted?: boolean;
  href?: string;
}) {
  const className = `inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1.5 text-[11px] font-medium shadow-sm sm:px-3 sm:py-2 sm:text-xs ${
    muted
      ? "border-black/[0.04] bg-white/55 text-black/35"
      : "border-black/[0.06] bg-white/90 text-black/55"
  } ${href ? "transition hover:border-teal-900/15 hover:bg-white hover:text-black/70" : ""}`;

  const content = (
    <>
      <span className={muted ? "text-teal-700/40" : "text-teal-700/70"}>
        {icon}
      </span>
      {children}
    </>
  );

  if (href) {
    return (
      <Link href={href} className={className}>
        {content}
      </Link>
    );
  }

  return <span className={className}>{content}</span>;
}

function SummaryRow({
  icon,
  label,
  value,
  tone = "teal",
  last = false,
  href,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
  tone?: "teal" | "amber" | "sky";
  last?: boolean;
  href?: string;
}) {
  const iconSurface = {
    teal: "bg-teal-50 text-teal-700",
    amber: "bg-amber-50 text-amber-700",
    sky: "bg-sky-50 text-sky-700",
  }[tone];

  const rowClass = `flex items-center justify-between gap-4 py-3.5 ${last ? "" : "border-b border-black/[0.06]"} ${
    href ? "rounded-xl transition hover:bg-black/[0.015]" : ""
  }`;

  const body = (
    <>
      <span className="flex min-w-0 items-center gap-3 text-[12px] font-medium text-black/40">
        <span
          className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-[12px] ${iconSurface}`}
        >
          {icon}
        </span>
        {label}
      </span>
      <span
        className={`shrink-0 text-right text-[15px] font-semibold tracking-tight ${
          href ? "text-teal-900 underline-offset-2 group-hover:underline" : "text-[#0f1f1d]"
        }`}
      >
        {value}
      </span>
    </>
  );

  if (href) {
    return (
      <Link href={href} className={`group ${rowClass}`}>
        {body}
      </Link>
    );
  }

  return <div className={rowClass}>{body}</div>;
}

function formatDate(date: Date) {
  return new Intl.DateTimeFormat("tr-TR", {
    day: "numeric",
    month: "long",
    year: "numeric",
  }).format(date);
}
