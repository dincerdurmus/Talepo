import Link from "next/link";
import {
  ArrowRight,
  CalendarDays,
  Crown,
  MapPin,
  MessageSquareText,
  Search,
  Sparkles,
  Zap,
} from "lucide-react";

import { buildSupplierVisibilityFilter } from "@/lib/membership/assert-entitlement";
import { getCompanyContextOptions } from "@/lib/membership/company-context";
import { resolveEntitlements } from "@/lib/membership/resolve-entitlements";
import { formatQuotaRemaining } from "@/lib/membership/serialize";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/server/auth/require-user";

const statusLabels: Record<string, string> = {
  PUBLISHED: "Yayında",
  RECEIVING_OFFERS: "Teklif alıyor",
};

export default async function ExploreRequestsPage() {
  const user = await requireUser();
  const entitlements = await resolveEntitlements(
    user.id,
    await getCompanyContextOptions(),
  );
  const visibilityFilter = buildSupplierVisibilityFilter(entitlements);
  const hasUrgentPriority = entitlements.features.urgent_request_priority;

  /**
   * PROFESSIONAL+: acil talepler listenin en üstünde.
   * Diğer planlar: öne çıkan → tarih (acil rozeti kalır, sıralama önceliği yok).
   */
  const orderBy = hasUrgentPriority
    ? ([
        { isUrgent: "desc" as const },
        { isFeatured: "desc" as const },
        { publishedAt: "desc" as const },
      ] as const)
    : ([
        { isFeatured: "desc" as const },
        { publishedAt: "desc" as const },
      ] as const);

  const [requests, myPublishedCount] = await Promise.all([
    prisma.request.findMany({
      where: {
        deletedAt: null,
        // Keşfet: başkalarının talepleri (teklif vermek için)
        createdById: { not: user.id },
        status: { in: ["PUBLISHED", "RECEIVING_OFFERS"] },
        ...visibilityFilter,
      },
      orderBy: [...orderBy],
      take: 50,
      include: {
        category: { select: { name: true } },
        createdBy: { select: { name: true, city: true } },
        _count: { select: { offers: true } },
      },
    }),
    prisma.request.count({
      where: {
        deletedAt: null,
        createdById: user.id,
        status: { in: ["PUBLISHED", "RECEIVING_OFFERS"] },
      },
    }),
  ]);

  const remainingLabel = formatQuotaRemaining(entitlements.quota);

  return (
    <>
      <section className="py-4 sm:py-6">
        <p className="text-sm font-semibold text-black/35">Keşfet</p>
        <div className="mt-3 flex flex-col gap-5 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <h1 className="text-4xl font-semibold tracking-[-0.05em] sm:text-5xl">
              Talepleri keşfet
            </h1>
            <p className="mt-4 max-w-2xl text-base leading-7 text-black/45">
              Burada <strong>başka kullanıcıların</strong> açık talepleri listelenir.
              Teklif vererek yeni müşterilere ulaşın. Kendi talepleriniz{" "}
              <Link
                href="/panel/taleplerim"
                className="font-semibold text-teal-800 underline-offset-2 hover:underline"
              >
                Taleplerim
              </Link>{" "}
              sayfasındadır.
            </p>
          </div>
        </div>

        {!entitlements.features.instant_request_access && (
          <div className="mt-5 flex items-start gap-3 rounded-[22px] border border-[#8c72c9]/20 bg-[#f8f5ff] px-5 py-4">
            <Crown className="mt-0.5 h-5 w-5 shrink-0 text-[#704daf]" />
            <p className="text-sm leading-6 text-[#4f3d72]/80">
              Standart planda yeni talepler 24 saat gecikmeyle açılır. Premium ile
              anında erişin.
            </p>
          </div>
        )}

        {hasUrgentPriority && (
          <div className="mt-3 flex items-start gap-3 rounded-[22px] border border-[#f59e0b]/25 bg-[#fff7e8] px-5 py-4">
            <Zap className="mt-0.5 h-5 w-5 shrink-0 text-[#b45309]" />
            <p className="text-sm leading-6 text-[#9a3412]/85">
              Profesyonel öncelik aktif: acil talepler listenin en üstünde
              sıralanıyor.
            </p>
          </div>
        )}

        <p className="mt-4 text-sm text-black/40">
          Plan: <strong>{entitlements.planLabel}</strong> · Kalan teklif hakkı:{" "}
          <strong>{remainingLabel}</strong>
          {entitlements.isExpired && (
            <span className="ml-2 text-[#8b352b]">
              (kayıtlı plan süresi dolmuş — Standart erişim)
            </span>
          )}
        </p>
      </section>

      <section className="pb-10">
        {requests.length === 0 ? (
          <div className="rounded-[30px] border border-black/[0.06] bg-white p-10 text-center shadow-[0_18px_60px_rgba(0,0,0,0.04)]">
            <Search className="mx-auto h-8 w-8 text-black/25" />
            <p className="mt-4 text-lg font-semibold">
              Şu an teklif verilecek başka talep yok
            </p>
            <p className="mx-auto mt-2 max-w-md text-sm leading-6 text-black/45">
              Keşfet, sizin oluşturduğunuz talepleri göstermez — onlar alıcı
              tarafınızdır. Başka kullanıcılar talep yayınladıkça burada görünür.
            </p>
            {myPublishedCount > 0 && (
              <div className="mx-auto mt-6 max-w-md rounded-[20px] border border-teal-200/70 bg-teal-50 px-5 py-4 text-sm text-teal-950">
                Sizin <strong>{myPublishedCount}</strong> yayında talebiniz var.
                Bunları yönetmek için{" "}
                <Link
                  href="/panel/taleplerim"
                  className="font-semibold underline underline-offset-2"
                >
                  Taleplerim
                </Link>{" "}
                sayfasına gidin.
              </div>
            )}
            <Link
              href="/panel/taleplerim"
              className="mt-6 inline-flex items-center gap-2 rounded-full bg-black px-5 py-3 text-sm font-semibold text-white"
            >
              Taleplerime git
              <ArrowRight className="h-4 w-4" />
            </Link>
          </div>
        ) : (
          <div className="grid gap-4">
            {requests.map((request) => (
              <Link
                key={request.id}
                href={`/panel/talepler/${request.id}`}
                className="group rounded-[28px] border border-black/[0.06] bg-white p-5 shadow-[0_14px_50px_rgba(0,0,0,0.04)] transition hover:border-black/15 sm:p-6"
              >
                <div className="flex flex-wrap items-center gap-2">
                  <span className="rounded-full bg-[#f6f6f2] px-3 py-1.5 text-xs font-semibold text-black/45">
                    {request.category.name}
                  </span>
                  {request.isUrgent && (
                    <span className="inline-flex items-center gap-1 rounded-full bg-[#ffe8cc] px-3 py-1.5 text-xs font-semibold text-[#9a5b00]">
                      <Zap className="h-3 w-3" />
                      Acil
                    </span>
                  )}
                  {request.isFeatured && (
                    <span className="inline-flex items-center gap-1 rounded-full bg-[#eee7ff] px-3 py-1.5 text-xs font-semibold text-[#704daf]">
                      <Sparkles className="h-3 w-3" />
                      Öne çıkan
                    </span>
                  )}
                  <span className="rounded-full bg-[#e4f4df] px-3 py-1.5 text-xs font-semibold text-[#356d3a]">
                    {statusLabels[request.status] ?? request.status}
                  </span>
                </div>

                <h2 className="mt-4 text-xl font-semibold tracking-tight group-hover:underline">
                  {request.title}
                </h2>

                <div className="mt-4 flex flex-wrap gap-x-5 gap-y-2 text-sm text-black/40">
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

                <div className="mt-5 flex items-center justify-between">
                  <span className="text-xs text-black/30">
                    {request.createdBy.name || "Alıcı"}
                  </span>
                  <span className="inline-flex items-center gap-1 text-sm font-semibold text-black/55">
                    İncele
                    <ArrowRight className="h-4 w-4 transition group-hover:translate-x-0.5" />
                  </span>
                </div>
              </Link>
            ))}
          </div>
        )}
      </section>
    </>
  );
}

function formatDate(date: Date) {
  return new Intl.DateTimeFormat("tr-TR", {
    day: "numeric",
    month: "long",
    year: "numeric",
  }).format(date);
}
