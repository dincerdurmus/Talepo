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
import { CategoryVisualThumb } from "@/components/visuals/CategoryVisualThumb";
import { displayRequestFieldValue } from "@/lib/field-display";
import { canAccessRequest } from "@/lib/membership/assert-entitlement";
import { getCompanyContextOptions } from "@/lib/membership/company-context";
import { hasFeature } from "@/lib/membership/entitlements";
import { assessCompanyProfileReadiness } from "@/lib/monetization/company-profile-readiness";
import { resolveEntitlements } from "@/lib/membership/resolve-entitlements";
import { getCategoryVisual } from "@/lib/visuals/category-visuals";
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
      _count: { select: { offers: true } },
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
  const teklifHref = attributionTouch
    ? `/panel/talepler/${request.id}/teklif?acq=${encodeURIComponent(attributionTouch)}`
    : `/panel/talepler/${request.id}/teklif`;
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
                where: {
                  requestId: request.id,
                  createdAt: { gte: new Date(Date.now() - 14 * 86400000) },
                },
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

  return (
    <>
      <DetailHeader locked={false} />

      <section className="py-3 sm:py-4">
        <div className="flex items-start gap-3.5 sm:gap-4">
          <CategoryVisualThumb
            categorySlug={categorySlug}
            categoryName={request.category.name}
            coverImageUrl={request.coverImageUrl}
            size="lg"
          />
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-2">
              <span
                className={`rounded-full px-3 py-1.5 text-xs font-semibold ${categoryLook.chip}`}
              >
                {request.category.name}
              </span>
              {request.isUrgent && (
                <span className="rounded-full bg-[#ffe8cc] px-3 py-1.5 text-xs font-semibold text-[#9a5b00]">
                  Acil alıcı
                </span>
              )}
              {request.isFeatured && (
                <span className="rounded-full border border-amber-900/10 bg-amber-50 px-3 py-1.5 text-xs font-semibold text-amber-900">
                  Öne çıkan
                </span>
              )}
              {request.aiScore !== null && (
                <span className="inline-flex items-center gap-1.5 rounded-full border border-sky-900/10 bg-sky-50 px-3 py-1.5 text-xs font-semibold text-sky-800">
                  <Sparkles className="h-3.5 w-3.5 text-sky-600" />
                  AI kalite puanı {request.aiScore}/100
                </span>
              )}
            </div>

            <h1 className="mt-3 max-w-4xl text-[28px] font-semibold tracking-[-0.05em] sm:text-[40px]">
              {request.title}
            </h1>

            <div className="mt-3 flex flex-wrap gap-x-6 gap-y-2 text-sm text-black/40">
              {request.city && (
                <span className="flex items-center gap-1.5">
                  <MapPin className="h-4 w-4" />
                  {request.city}
                </span>
              )}
              <span className="flex items-center gap-1.5">
                <CalendarDays className="h-4 w-4" />
                {formatDate(request.publishedAt ?? request.createdAt)}
              </span>
              <span className="flex items-center gap-1.5">
                <MessageSquareText className="h-4 w-4" />
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

      <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_300px] lg:items-stretch lg:gap-5">
        <section className="flex h-full flex-col rounded-xl border border-black/[0.06] bg-white p-4 sm:p-5">
          <span className="text-xs font-semibold text-black/40">
            Talep açıklaması
          </span>
          <p className="mt-2.5 line-clamp-8 whitespace-pre-line text-sm leading-6 text-black/70">
            {request.professionalDescription || request.description}
          </p>
        </section>

        <aside className="flex h-full flex-col rounded-xl border border-teal-900/10 bg-gradient-to-br from-[#0f766e] via-[#0e7490] to-[#1e3a5f] p-4 text-white sm:p-5">
          <div className="flex items-center gap-2">
            <Sparkles className="h-3.5 w-3.5 text-sky-200" />
            <span className="text-xs font-semibold text-white/55">AI özeti</span>
          </div>
          <p className="mt-2.5 line-clamp-8 whitespace-pre-line text-sm leading-6 text-white/85">
            {request.aiSummary ||
              "Talep AI tarafından analiz edilerek yayınlandı."}
          </p>
        </aside>
      </div>

      <section className="mt-6 sm:mt-8">
        {isRequestOwner ? (
          <p className="rounded-xl border border-teal-900/8 bg-white px-4 py-3 text-sm text-teal-950/65">
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
              ["ACCEPTED", "SUBMITTED", "VIEWED"].includes(existingOffer.status)
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
      (request.status === "PUBLISHED" || request.status === "RECEIVING_OFFERS") ? (
        <OfferDraftSuggestion
          requestTitle={request.title}
          requestDescription={
            request.professionalDescription || request.description
          }
          categoryName={request.category.name}
          teklifHref={teklifHref}
        />
      ) : null}

      {request.fieldValues.length > 0 && (
        <section className="mt-5 sm:mt-6">
          <div className="rounded-2xl border border-black/[0.06] bg-white p-5 sm:p-6">
            <h2 className="text-base font-semibold tracking-tight sm:text-lg">
              Teknik detaylar
            </h2>
            <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
              {request.fieldValues.map((value) => (
                <div
                  key={value.id}
                  className="rounded-xl border border-black/[0.04] bg-[#f8f9f7] px-4 py-3"
                >
                  <p className="text-[11px] font-medium uppercase tracking-[0.06em] text-black/35">
                    {value.field.label}
                  </p>
                  <p className="mt-1 text-sm font-semibold text-[#111827]">
                    {displayRequestFieldValue({
                      ...value,
                      categoryId: categorySlug,
                    })}
                  </p>
                </div>
              ))}
            </div>
          </div>
        </section>
      )}
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
        Talepleri keşfet
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
