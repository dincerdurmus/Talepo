import Link from "next/link";
import {
  ArrowRight,
  CalendarDays,
  CirclePlus,
  MapPin,
  MessageSquareText,
  PencilLine,
  Sparkles,
  Wallet,
} from "lucide-react";

import { DeleteRequestButton } from "@/components/panel/DeleteRequestButton";
import { CategoryVisualThumb } from "@/components/visuals/CategoryVisualThumb";
import { EmptyIllustration } from "@/components/visuals/EmptyIllustration";
import {
  formatListingBudget,
  getCategoryVisual,
  listingSummary,
} from "@/lib/visuals/category-visuals";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/server/auth/require-user";
import { canEditRequestStatus } from "@/server/request/update-request";

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

const statusAccentBar: Record<string, string> = {
  DRAFT: "bg-black/15",
  PUBLISHED: "bg-teal-500",
  RECEIVING_OFFERS: "bg-teal-500",
  OFFER_SELECTED: "bg-sky-500",
  IN_PROGRESS: "bg-amber-500",
  COMPLETED: "bg-emerald-500",
  CANCELLED: "bg-red-400",
  EXPIRED: "bg-black/20",
};

const statusChipClass: Record<string, string> = {
  DRAFT: "text-black/50",
  PUBLISHED: "text-teal-800",
  RECEIVING_OFFERS: "text-teal-800",
  OFFER_SELECTED: "text-sky-800",
  IN_PROGRESS: "text-amber-900",
  COMPLETED: "text-emerald-800",
  CANCELLED: "text-red-800",
  EXPIRED: "text-black/45",
};

export default async function MyRequestsPage() {
  const user = await requireUser();

  const requests = await prisma.request.findMany({
    where: {
      createdById: user.id,
      deletedAt: null,
    },
    orderBy: { createdAt: "desc" },
    include: {
      category: { select: { name: true, slug: true } },
      _count: { select: { offers: true } },
    },
  });

  return (
    <>
      <section className="flex flex-col gap-5 py-4 sm:flex-row sm:items-end sm:justify-between sm:py-6">
        <div>
          <p className="talepo-page-eyebrow text-xs uppercase tracking-[0.14em]">
            Panel
          </p>
          <h1 className="talepo-page-title mt-2 text-3xl sm:text-4xl">
            Taleplerim
          </h1>
          <p className="mt-3 max-w-lg text-[15px] leading-7 text-teal-950/50">
            Yayınladığınız talepleri ve gelen teklifleri tek yerden yönetin.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <div className="rounded-full border border-teal-900/8 bg-white px-4 py-2 text-sm font-medium text-teal-950/55">
            {requests.length} talep
          </div>
          <Link
            href="/talep"
            className="flex items-center justify-center gap-2 rounded-xl bg-[#0f766e] px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-[#115e59]"
          >
            <CirclePlus className="h-4 w-4" />
            Yeni talep
          </Link>
        </div>
      </section>

      {requests.length === 0 ? (
        <section className="talepo-card px-6 py-12 text-center sm:px-14 sm:py-16">
          <EmptyIllustration variant="requests" />
          <h2 className="mt-6 text-2xl font-semibold tracking-tight text-[#0f1f1d]">
            Henüz talebiniz yok
          </h2>
          <p className="mx-auto mt-3 max-w-md text-sm leading-6 text-teal-950/50">
            İhtiyacınızı kısaca anlatın; Talepo bilgileri düzenleyip talebinizi
            yayına hazırlasın.
          </p>
          <Link
            href="/talep"
            className="mt-7 inline-flex items-center gap-2 rounded-xl bg-[#0f766e] px-5 py-3 text-sm font-semibold text-white transition hover:bg-[#115e59]"
          >
            İlk talebimi oluştur
            <ArrowRight className="h-4 w-4" />
          </Link>
        </section>
      ) : (
        <section className="grid gap-3">
          {requests.map((request) => {
            const editable = canEditRequestStatus(request.status);
            const accentBar =
              statusAccentBar[request.status] ?? "bg-black/15";
            const statusTone =
              statusChipClass[request.status] ?? "text-black/50";
            const statusLabel =
              statusLabels[request.status] ?? request.status;
            const offerCount = request._count.offers;
            const look = getCategoryVisual(request.category.slug);
            const blurb = listingSummary(
              request.aiSummary,
              request.description,
            );
            const budgetLabel = formatListingBudget(
              request.budgetMin,
              request.budgetMax,
              request.currency,
            );

            return (
              <article
                key={request.id}
                className={`talepo-card group flex overflow-hidden bg-gradient-to-r ${look.glow} transition duration-300 hover:border-teal-900/10 hover:shadow-[var(--talepo-shadow-md)]`}
              >
                <div
                  aria-hidden
                  className={`w-1 shrink-0 ${accentBar}`}
                />

                <div className="flex min-w-0 flex-1 flex-col gap-4 p-4 sm:flex-row sm:items-center sm:justify-between sm:gap-5 sm:p-5">
                  <Link
                    href={`/panel/taleplerim/${request.id}`}
                    className="flex min-w-0 flex-1 gap-3.5 sm:gap-4"
                  >
                    <CategoryVisualThumb
                      categorySlug={request.category.slug}
                      categoryName={request.category.name}
                      coverImageUrl={request.coverImageUrl}
                      size="md"
                      className="self-start"
                    />

                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-xs font-medium">
                        <span
                          className={`inline-flex items-center rounded-full px-2 py-0.5 text-[11px] font-semibold ${look.chip}`}
                        >
                          {request.category.name}
                        </span>
                        <span className={`font-semibold ${statusTone}`}>
                          {statusLabel}
                        </span>
                        {request.isUrgent && (
                          <span className="font-semibold text-amber-800">
                            Acil
                          </span>
                        )}
                        {request.isFeatured && (
                          <span className="font-semibold text-sky-800">
                            Öne çıkan
                          </span>
                        )}
                      </div>

                      <h2 className="mt-2 truncate text-lg font-semibold tracking-tight text-black/90 transition group-hover:text-teal-900 sm:text-xl">
                        {request.title}
                      </h2>

                      {blurb ? (
                        <p className="mt-1.5 line-clamp-2 text-[13px] leading-5 text-teal-950/50">
                          {blurb}
                        </p>
                      ) : null}

                      <div className="mt-3 flex flex-wrap items-center gap-2">
                        {request.city && (
                          <MetaItem icon={<MapPin className="h-3.5 w-3.5" />}>
                            {request.city}
                          </MetaItem>
                        )}
                        {budgetLabel ? (
                          <MetaItem icon={<Wallet className="h-3.5 w-3.5" />}>
                            {budgetLabel}
                          </MetaItem>
                        ) : null}
                        <MetaItem
                          icon={<CalendarDays className="h-3.5 w-3.5" />}
                        >
                          {formatDate(request.publishedAt ?? request.createdAt)}
                        </MetaItem>
                        <MetaItem
                          icon={
                            <MessageSquareText className="h-3.5 w-3.5" />
                          }
                        >
                          {offerCount === 0
                            ? "Henüz teklif yok"
                            : `${offerCount} teklif`}
                        </MetaItem>
                        {request.aiScore !== null && (
                          <MetaItem
                            icon={<Sparkles className="h-3.5 w-3.5" />}
                            tone="sky"
                          >
                            Kalite {request.aiScore}
                          </MetaItem>
                        )}
                      </div>
                    </div>
                  </Link>

                  <div className="flex shrink-0 items-center gap-2 border-t border-black/[0.05] pt-4 sm:border-t-0 sm:pt-0">
                    {editable && (
                      <Link
                        href={`/panel/taleplerim/${request.id}/duzenle`}
                        className="inline-flex flex-1 items-center justify-center gap-2 rounded-[16px] border border-black/[0.08] bg-[#f8f9f7] px-4 py-2.5 text-sm font-semibold text-black/70 transition hover:border-black/15 hover:bg-black hover:text-white sm:flex-none"
                      >
                        <PencilLine className="h-4 w-4" />
                        Talebimi düzelt
                      </Link>
                    )}
                    <DeleteRequestButton
                      requestId={request.id}
                      variant="list"
                    />
                    <Link
                      href={`/panel/taleplerim/${request.id}`}
                      className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-[14px] bg-teal-50 text-teal-800 transition hover:bg-teal-800 hover:text-white sm:h-11 sm:w-11"
                      aria-label="Talebi görüntüle"
                    >
                      <ArrowRight className="h-4 w-4" />
                    </Link>
                  </div>
                </div>
              </article>
            );
          })}
        </section>
      )}
    </>
  );
}

function MetaItem({
  icon,
  children,
  tone = "neutral",
}: {
  icon: React.ReactNode;
  children: React.ReactNode;
  tone?: "neutral" | "sky";
}) {
  const iconClass =
    tone === "sky" ? "text-sky-600/80" : "text-teal-700/65";

  return (
    <span className="inline-flex items-center gap-1.5 rounded-full border border-black/[0.05] bg-[#fafaf8] px-2.5 py-1.5 text-xs font-medium text-black/55">
      <span className={iconClass}>{icon}</span>
      {children}
    </span>
  );
}

function formatDate(date: Date) {
  return new Intl.DateTimeFormat("tr-TR", {
    day: "numeric",
    month: "long",
    year: "numeric",
  }).format(date);
}
