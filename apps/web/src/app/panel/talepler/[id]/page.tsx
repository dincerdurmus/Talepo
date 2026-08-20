import Link from "next/link";
import { notFound } from "next/navigation";
import {
  ArrowLeft,
  CalendarDays,
  Crown,
  MapPin,
  MessageSquareText,
  Sparkles,
  Zap,
} from "lucide-react";

import { OfferExistingStatus } from "@/components/panel/OfferExistingStatus";
import { OfferDraftSuggestion } from "@/components/panel/OfferDraftSuggestion";
import { OfferIntelligenceCard } from "@/components/panel/OfferIntelligenceCard";
import { RequestChangeBanner } from "@/components/panel/RequestChangeBanner";
import { SmartMatchPanel } from "@/components/panel/SmartMatchPanel";
import { WatchlistToggle } from "@/components/panel/WatchlistToggle";
import { OfferSendCta } from "@/components/panel/OfferSendCta";
import { ComplaintForm } from "@/components/panel/ComplaintForm";
import { CategoryVisualThumb } from "@/components/visuals/CategoryVisualThumb";
import { displayRequestFieldValue } from "@/lib/field-display";
import { canAccessRequest } from "@/lib/membership/assert-entitlement";
import { getCompanyContextOptions } from "@/lib/membership/company-context";
import { hasFeature } from "@/lib/membership/entitlements";
import { assessCompanyProfileReadiness } from "@/lib/monetization/company-profile-readiness";
import { resolveEntitlements } from "@/lib/membership/resolve-entitlements";
import { offerFormHref } from "@/lib/panel/offer-form-href";
import { splitEditorialRequestDescription } from "@/lib/panel/editorial-request-description";
import {
  formatListingBudget,
  getCategoryVisual,
} from "@/lib/visuals/category-visuals";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/server/auth/require-user";
import { findSupplierOfferOnRequest } from "@/server/offer/offer-service";
import { getRequestOfferIntelligence } from "@/server/monetization/offer-intelligence";
import { matchCompanyToRequest } from "@/server/monetization/smart-matching";

export default async function ExploreRequestDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<Record<string, string | undefined>>;
}) {
  const user = await requireUser();
  const entitlements = await resolveEntitlements(
    user.id,
    await getCompanyContextOptions(),
  );
  const { id } = await params;
  const query = await searchParams;
  const attributionTouch =
    typeof query.acq === "string" && query.acq.trim()
      ? query.acq.trim()
      : null;

  // Minimal fetch first — authorization before loading sensitive fields.
  // Opportunity cards use this canonical Request.id surface; the owner
  // filter lives on offer submission, not on viewing a published request.
  const preview = await prisma.request.findFirst({
    where: {
      id,
      deletedAt: null,
      isModerationHidden: false,
      status: {
        in: ["PUBLISHED", "RECEIVING_OFFERS", "OFFER_SELECTED", "IN_PROGRESS"],
      },
    },
    select: {
      id: true,
      title: true,
      isUrgent: true,
      publishedAt: true,
      createdAt: true,
      visibleToSuppliersAt: true,
      category: { select: { name: true, slug: true } },
      coverImageUrl: true,
    },
  });

  if (!preview) notFound();

  const isLocked = !canAccessRequest(entitlements, preview);

  if (isLocked) {
    const lockedLook = getCategoryVisual(preview.category.slug);
    return (
      <>
        <DetailHeader locked />
        <section className="py-3 sm:py-4">
          <div className="flex items-start gap-3.5 sm:gap-4">
            <CategoryVisualThumb
              categorySlug={preview.category.slug}
              categoryName={preview.category.name}
              coverImageUrl={preview.coverImageUrl}
              size="lg"
            />
            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-center gap-2">
                <span
                  className={`rounded-full px-3 py-1.5 text-xs font-semibold ${lockedLook.chip}`}
                >
                  {preview.category.name}
                </span>
                {preview.isUrgent && (
                  <span className="rounded-full bg-[#ffe8cc] px-3 py-1.5 text-xs font-semibold text-[#9a5b00]">
                    Acil alıcı
                  </span>
                )}
              </div>
              <h1 className="mt-3 max-w-4xl text-[28px] font-semibold tracking-[-0.05em] sm:text-[40px]">
                {preview.title}
              </h1>
              <div className="mt-3 flex flex-wrap gap-x-6 gap-y-2 text-sm text-black/40">
                <span className="flex items-center gap-1.5">
                  <CalendarDays className="h-4 w-4" />
                  {formatDate(preview.publishedAt ?? preview.createdAt)}
                </span>
              </div>
            </div>
          </div>
        </section>
        <LockedRequestPreview visibleAt={preview.visibleToSuppliersAt} />
      </>
    );
  }

  const request = await prisma.request.findFirst({
    where: { id: preview.id },
    include: {
      category: { select: { name: true, slug: true } },
      createdBy: { select: { name: true, city: true } },
      fieldValues: {
        orderBy: { field: { sortOrder: "asc" } },
        include: { field: true },
      },
      _count: { select: { offers: true, matches: true } },
    },
  });

  if (!request) notFound();

  const categorySlug = request.category.slug;
  const categoryLook = getCategoryVisual(categorySlug);
  const existingOffer = await findSupplierOfferOnRequest(user.id, request.id);
  const isRequestOwner = request.createdById === user.id;
  const offerIntelligence = isRequestOwner
    ? null
    : await getRequestOfferIntelligence({
        userId: user.id,
        requestId: request.id,
      });
  const teklifHref = offerFormHref(request.id, attributionTouch);
  const canCreateFreshOffer =
    !existingOffer ||
    ["REJECTED", "WITHDRAWN", "EXPIRED"].includes(existingOffer.status);

  const companyId =
    entitlements.subject.type === "company" ? entitlements.subject.id : null;
  const hasSmartMatching = hasFeature(entitlements.features, "smart_matching");
  const hasWatchlist = hasFeature(entitlements.features, "watchlist");

  const [companyProfile, watchlistItem, requestChanges, smartMatch] =
    companyId
      ? await Promise.all([
          prisma.company.findFirst({
            where: { id: companyId, deletedAt: null },
            select: {
              city: true,
              description: true,
              _count: { select: { categories: true } },
            },
          }),
          hasWatchlist
            ? prisma.opportunityWatchlistItem.findUnique({
                where: {
                  companyId_requestId: {
                    companyId,
                    requestId: request.id,
                  },
                },
                select: { id: true },
              })
            : Promise.resolve(null),
          hasWatchlist
            ? prisma.requestChange.findMany({
                where: { requestId: request.id },
                orderBy: { createdAt: "desc" },
                take: 5,
              })
            : Promise.resolve([]),
          hasSmartMatching
            ? matchCompanyToRequest(companyId, request.id)
            : Promise.resolve(null),
        ])
      : [null, null, [], null];

  const profileReadiness = companyProfile
    ? assessCompanyProfileReadiness({
        city: companyProfile.city,
        description: companyProfile.description,
        categoryCount: companyProfile._count.categories,
      })
    : null;

  const description =
    request.professionalDescription || request.description;
  const matchedCompanyCount = request._count.matches;
  const editorial = splitEditorialRequestDescription(description);
  const budgetLabel = formatListingBudget(
    request.budgetMin,
    request.budgetMax,
    request.currency,
  );
  const attributeRows: Array<{ id: string; label: string; value: string }> = [];
  if (request.city) {
    attributeRows.push({
      id: "city",
      label: "Teslimat yeri",
      value: request.city,
    });
  }
  if (budgetLabel) {
    attributeRows.push({
      id: "budget",
      label: "Bütçe",
      value: budgetLabel,
    });
  }
  for (const value of request.fieldValues) {
    attributeRows.push({
      id: value.id,
      label: value.field.label,
      value: displayRequestFieldValue({
        ...value,
        categoryId: categorySlug,
      }),
    });
  }

  return (
    <>
      <header className="flex items-center justify-between gap-2">
        <Link
          href="/panel/talepler"
          className="talepo-cloud-pill px-3.5 py-2 text-sm font-medium text-teal-950/50 transition hover:text-[#0f1f1d]"
        >
          <ArrowLeft className="h-4 w-4" />
          Talepler
        </Link>
      </header>

      <section className="relative mt-4 overflow-hidden rounded-[26px] border border-black/[0.05] bg-[linear-gradient(135deg,#FAFCFB_0%,#F1F5F7_48%,#E8F1F4_100%)] px-5 py-5 shadow-[0_10px_32px_rgba(15,31,29,0.035)] sm:mt-5 sm:px-6 sm:py-5">
        <div
          aria-hidden
          className="pointer-events-none absolute inset-px rounded-[25px] ring-1 ring-inset ring-white/55"
        />
        <div
          aria-hidden
          className="pointer-events-none absolute -right-16 top-[-35%] h-[140%] w-[48%] bg-[radial-gradient(ellipse_at_center,rgba(56,98,120,0.07),transparent_70%)]"
        />

        <div className="relative flex items-start gap-3.5 sm:gap-4">
          <CategoryVisualThumb
            categorySlug={categorySlug}
            categoryName={request.category.name}
            coverImageUrl={request.coverImageUrl}
            size="lg"
            className="h-[6.5rem] w-[6.5rem] rounded-[1.25rem] shadow-none ring-1 ring-black/[0.06] sm:h-[7rem] sm:w-[7rem]"
          />
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-1.5 sm:gap-2">
              <span
                className={`inline-flex items-center rounded-full border border-teal-900/8 px-2.5 py-1 text-[11px] font-semibold ${categoryLook.chip}`}
              >
                {request.category.name}
              </span>
              <span className="inline-flex items-center gap-1.5 rounded-full border border-teal-900/8 bg-[#e4f4df]/90 px-2.5 py-1 text-[11px] font-semibold text-[#356d3a]">
                <span
                  className="h-1.5 w-1.5 shrink-0 rounded-full bg-emerald-500/85"
                  aria-hidden
                />
                Açık talep
              </span>
              {request.isUrgent && (
                <span className="inline-flex items-center rounded-full border border-amber-900/12 bg-amber-50/80 px-2.5 py-1 text-[11px] font-semibold text-amber-900">
                  Acil alıcı
                </span>
              )}
              {request.isFeatured && (
                <span className="inline-flex items-center rounded-full border border-amber-900/10 bg-amber-50/70 px-2.5 py-1 text-[11px] font-semibold text-amber-900">
                  Öne çıkan
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
              {request.city ? (
                <span className="inline-flex items-center gap-1.5 rounded-full border border-black/[0.05] bg-white/60 px-2.5 py-1 text-[12px] text-[#0f1f1d]/55">
                  <MapPin className="h-3.5 w-3.5" />
                  {request.city}
                </span>
              ) : null}
              <span className="inline-flex items-center gap-1.5 rounded-full border border-black/[0.05] bg-white/60 px-2.5 py-1 text-[12px] text-[#0f1f1d]/55">
                <CalendarDays className="h-3.5 w-3.5" />
                {formatDate(request.publishedAt ?? request.createdAt)}
              </span>
              <span className="inline-flex items-center gap-1.5 rounded-full border border-black/[0.05] bg-white/60 px-2.5 py-1 text-[12px] text-[#0f1f1d]/55">
                <MessageSquareText className="h-3.5 w-3.5" />
                {request._count.offers} teklif
              </span>
            </div>
          </div>
        </div>
      </section>

      {hasSmartMatching ? (
        <SmartMatchPanel
          score={smartMatch?.score ?? 0}
          reasons={smartMatch?.reasons ?? []}
          profileIncomplete={Boolean(profileReadiness && !profileReadiness.ready)}
          missingProfileFields={profileReadiness?.missing ?? []}
        />
      ) : null}

      {hasWatchlist && watchlistItem && requestChanges.length > 0 ? (
        <RequestChangeBanner
          changes={requestChanges.map((c) => ({
            field: c.field,
            oldValue: c.oldValue,
            newValue: c.newValue,
          }))}
        />
      ) : null}

      {companyId ? (
        <WatchlistToggle
          requestId={request.id}
          initialWatchlisted={Boolean(watchlistItem)}
          entitled={hasWatchlist}
        />
      ) : null}

      <div className="mt-5 grid gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(260px,320px)] lg:items-start lg:gap-5">
        <section className="relative min-w-0 overflow-hidden rounded-[18px] border border-teal-900/[0.08] bg-[#fbfcfc] px-4 py-4 sm:px-5 sm:py-5">
          <div
            aria-hidden
            className="pointer-events-none absolute inset-y-3 left-0 w-[3px] rounded-full bg-teal-700/35"
          />
          <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-[#3d5c58]/85">
            Talep açıklaması
          </p>
          <div className="mt-2 h-px w-11 bg-teal-900/15" aria-hidden />

          {editorial.lead ? (
            <p className="mt-3 text-[16px] font-semibold leading-7 tracking-[-0.015em] text-[#0f1f1d] sm:text-[17px] sm:leading-[1.55]">
              {editorial.lead}
            </p>
          ) : null}

          {editorial.body ? (
            <p className="mt-3 whitespace-pre-line text-[14px] leading-7 text-[#0f1f1d]/72 sm:text-[15px]">
              {editorial.body}
            </p>
          ) : null}

          {attributeRows.length > 0 ? (
            <dl className="mt-4 space-y-2.5 border-t border-teal-900/[0.06] pt-4">
              {attributeRows.map((row) => (
                <div
                  key={row.id}
                  className="grid grid-cols-1 gap-0.5 sm:grid-cols-[minmax(7.5rem,11rem)_minmax(0,1fr)] sm:items-baseline sm:gap-4"
                >
                  <dt className="text-[12px] font-medium text-[#536b68]">
                    {row.label}
                  </dt>
                  <dd className="text-[13px] font-semibold text-[#0f1f1d] sm:text-right">
                    {row.value}
                  </dd>
                </div>
              ))}
            </dl>
          ) : null}

          {editorial.textCriteria.length > 0 && attributeRows.length === 0 ? (
            <ul className="mt-4 space-y-1.5 border-t border-teal-900/[0.06] pt-4 text-[13px] leading-6 text-[#0f1f1d]/72">
              {editorial.textCriteria.map((item) => (
                <li key={item} className="flex gap-2">
                  <span className="mt-2 h-1 w-1 shrink-0 rounded-full bg-teal-800/45" />
                  <span>{item}</span>
                </li>
              ))}
            </ul>
          ) : null}

          {editorial.expectations ? (
            <div className="mt-4 border-t border-teal-900/[0.06] pt-3.5">
              <p className="text-[10px] font-semibold uppercase tracking-[0.12em] text-[#3d5c58]/80">
                Teklifte beklenenler
              </p>
              <p className="mt-1.5 text-[13px] leading-6 text-[#0f1f1d]/62">
                {editorial.expectations}
              </p>
            </div>
          ) : null}
        </section>

        <aside className="relative overflow-hidden rounded-[18px] border border-teal-950/20 bg-[linear-gradient(155deg,#151d1b_0%,#111716_52%,#19302d_100%)] p-4 text-[#f5f7f6] shadow-[0_16px_40px_rgba(15,31,29,0.14)] sm:p-5">
          <div
            aria-hidden
            className="pointer-events-none absolute -right-8 -top-8 h-28 w-28 rounded-full bg-teal-400/12 blur-[40px]"
          />
          <div className="relative">
            <div className="flex items-center gap-2">
              <span className="flex h-8 w-8 items-center justify-center rounded-[10px] border border-white/10 bg-white/10">
                <Sparkles className="h-3.5 w-3.5 text-teal-200/85" />
              </span>
              <p className="text-[10px] font-semibold uppercase tracking-[0.12em] text-[#aebbb7]">
                Signal · AI özeti
              </p>
            </div>
            <p className="mt-3 whitespace-pre-line text-[13px] leading-6 text-[#e8eeec]/90">
              {request.aiSummary ||
                "Talep AI tarafından analiz edilerek yayınlandı."}
            </p>
            <dl className="mt-4 grid grid-cols-2 gap-2">
              <SignalStat label="Kategori" value={request.category.name} />
              {request.aiScore !== null ? (
                <SignalStat
                  label="AI güven"
                  value={`${request.aiScore}/100`}
                />
              ) : null}
              <SignalStat
                label="Eşleşen firma"
                value={String(matchedCompanyCount)}
              />
              <SignalStat
                label="Teklif"
                value={String(request._count.offers)}
              />
            </dl>
          </div>
        </aside>
      </div>

      <section className="mt-5 sm:mt-6">
        {isRequestOwner ? (
          <p className="rounded-[16px] border border-teal-900/8 bg-white px-4 py-3 text-sm text-teal-950/65">
            Bu sizin talebiniz. Teklif gönderme alıcıya kapalıdır.
          </p>
        ) : existingOffer && !canCreateFreshOffer ? (
          <OfferExistingStatus
            status={existingOffer.status}
            reviseHref={
              ["SUBMITTED", "VIEWED"].includes(existingOffer.status)
                ? teklifHref
                : undefined
            }
            messagesHref={
              existingOffer.conversation?.id &&
              existingOffer.status === "ACCEPTED"
                ? `/panel/mesajlar/${existingOffer.conversation.id}`
                : undefined
            }
          />
        ) : existingOffer && canCreateFreshOffer ? (
          <OfferExistingStatus
            status={existingOffer.status}
            newOfferHref={
              request.status === "PUBLISHED" ||
              request.status === "RECEIVING_OFFERS"
                ? teklifHref
                : undefined
            }
          />
        ) : (
          <OfferSendCta href={teklifHref} />
        )}
      </section>

      {offerIntelligence ? (
        <OfferIntelligenceCard
          intelligence={offerIntelligence}
          requestId={request.id}
        />
      ) : null}

      {!isRequestOwner &&
      entitlements.features.ai_offer_assistant &&
      (request.status === "PUBLISHED" ||
        request.status === "RECEIVING_OFFERS") ? (
        <OfferDraftSuggestion
          requestTitle={request.title}
          requestDescription={description}
          categoryName={request.category.name}
          teklifHref={teklifHref}
        />
      ) : null}

      <div className="mt-8 opacity-80">
        <ComplaintForm
          subjectType="REQUEST"
          subjectId={request.id}
          targetUserId={request.createdById}
        />
      </div>
    </>
  );
}

function DetailHeader({ locked }: { locked: boolean }) {
  return (
    <header className="flex items-center justify-between gap-2">
      <Link
        href="/panel/talepler"
        className="talepo-cloud-pill px-3.5 py-2 text-sm font-medium text-teal-950/50 transition hover:text-[#0f1f1d]"
      >
        <ArrowLeft className="h-4 w-4" />
        Talepler
      </Link>
      <span
        className={`rounded-full border px-3.5 py-2 text-xs font-semibold shadow-[0_6px_18px_rgba(15,31,29,0.04)] ${
          locked
            ? "border-teal-900/10 bg-[#eef6f4] text-teal-800"
            : "border-teal-900/8 bg-[#e4f4df] text-[#356d3a]"
        }`}
      >
        {locked ? "Kilitli önizleme" : "Açık talep"}
      </span>
    </header>
  );
}

function SignalStat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-[10px] border border-white/10 bg-white/[0.06] px-2.5 py-2">
      <dt className="text-[10px] font-medium uppercase tracking-wide text-[#aebbb7]/80">
        {label}
      </dt>
      <dd className="mt-0.5 truncate text-[12px] font-semibold text-[#f5f7f6]">
        {value}
      </dd>
    </div>
  );
}

function LockedRequestPreview({
  visibleAt,
}: {
  visibleAt: Date | null;
}) {
  return (
    <div className="grid gap-5 lg:grid-cols-[1fr_360px]">
      <section className="rounded-2xl border border-teal-900/10 bg-white p-6 shadow-[0_16px_48px_rgba(15,31,29,0.04)] sm:p-8">
        <p className="text-xs font-semibold uppercase tracking-[0.16em] text-teal-800/45">
          Sınırlı önizleme
        </p>
        <p className="mt-5 text-base leading-8 text-teal-950/55">
          Bu talep henüz standart erişime açılmadı. Tam açıklama, teknik
          detaylar, bütçe ve teklif formu Profesyonel üyeler için anında
          görünür.
        </p>
        <ul className="mt-6 space-y-2 text-sm text-teal-950/45">
          <li className="rounded-xl bg-[#f7faf9] px-4 py-3">
            Talep başlığı ve kategori görüntüleniyor
          </li>
          <li className="rounded-xl bg-[#f7faf9] px-4 py-3">
            Detaylı içerik ve teklif hakkı kilitli
          </li>
          {visibleAt && (
            <li className="rounded-xl bg-[#f7faf9] px-4 py-3">
              Standart erişim: {formatDateTime(visibleAt)}
            </li>
          )}
        </ul>
      </section>

      <aside className="rounded-2xl border border-teal-900/12 bg-[#eef6f4] p-6">
        <div className="flex items-start gap-3">
          <Crown className="mt-0.5 h-5 w-5 text-teal-800" />
          <div>
            <p className="font-semibold text-[#0f1f1d]">
              Bu talebe hemen erişmek için Profesyonel&apos;e geç.
            </p>
            <p className="mt-2 text-sm leading-6 text-teal-950/55">
              Profesyonel üyeler yeni talepleri anında görür ve sınırsız teklif
              verir.
            </p>
            <Link
              href="/panel/plan"
              className="mt-4 inline-flex items-center gap-2 rounded-xl bg-[#0f766e] px-4 py-2.5 text-xs font-semibold text-white transition hover:bg-[#115e59]"
            >
              <Zap className="h-3.5 w-3.5" />
              Profesyonel&apos;e geç
            </Link>
          </div>
        </div>
      </aside>
    </div>
  );
}

function formatDateTime(date: Date) {
  return new Intl.DateTimeFormat("tr-TR", {
    day: "numeric",
    month: "long",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(date);
}

function formatDate(date: Date) {
  return new Intl.DateTimeFormat("tr-TR", {
    day: "numeric",
    month: "long",
    year: "numeric",
  }).format(date);
}
