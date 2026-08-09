import Link from "next/link";
import { notFound } from "next/navigation";
import {
  ArrowLeft,
  CalendarDays,
  Crown,
  MapPin,
  MessageSquareText,
  Sparkles,
  WalletCards,
  Zap,
} from "lucide-react";

import { OfferForm } from "@/components/panel/OfferForm";
import { displayRequestFieldValue } from "@/lib/field-display";
import { canAccessRequest } from "@/lib/membership/assert-entitlement";
import { getCompanyContextOptions } from "@/lib/membership/company-context";
import { resolveEntitlements } from "@/lib/membership/resolve-entitlements";
import { toEntitlementDTO } from "@/lib/membership/serialize";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/server/auth/require-user";

export default async function ExploreRequestDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ teklif?: string }>;
}) {
  const user = await requireUser();
  const entitlements = await resolveEntitlements(
    user.id,
    await getCompanyContextOptions(),
  );
  const entitlementDto = toEntitlementDTO(entitlements);
  const { id } = await params;
  const { teklif } = await searchParams;

  // Minimal fetch first — authorization before loading sensitive fields.
  const preview = await prisma.request.findFirst({
    where: {
      id,
      deletedAt: null,
      createdById: { not: user.id },
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
      category: { select: { name: true } },
    },
  });

  if (!preview) notFound();

  const isLocked = !canAccessRequest(entitlements, preview);

  if (isLocked) {
    return (
      <>
        <DetailHeader locked />
        <section className="py-8 sm:py-10">
          <div className="flex flex-wrap items-center gap-2">
            <span className="rounded-full bg-white px-3 py-1.5 text-xs font-semibold text-black/45">
              {preview.category.name}
            </span>
            {preview.isUrgent && (
              <span className="rounded-full bg-[#ffe8cc] px-3 py-1.5 text-xs font-semibold text-[#9a5b00]">
                Acil alıcı
              </span>
            )}
          </div>
          <h1 className="mt-5 max-w-4xl text-4xl font-semibold tracking-[-0.05em] sm:text-5xl">
            {preview.title}
          </h1>
          <div className="mt-5 flex flex-wrap gap-x-6 gap-y-2 text-sm text-black/40">
            <span className="flex items-center gap-1.5">
              <CalendarDays className="h-4 w-4" />
              {formatDate(preview.publishedAt ?? preview.createdAt)}
            </span>
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

  const showOfferPrompt = teklif === "1";
  const categorySlug = request.category.slug;

  return (
    <>
      <DetailHeader locked={false} />

      <section className="py-8 sm:py-10">
        <div className="flex flex-wrap items-center gap-2">
          <span className="rounded-full bg-white px-3 py-1.5 text-xs font-semibold text-black/45">
            {request.category.name}
          </span>
          {request.isUrgent && (
            <span className="rounded-full bg-[#ffe8cc] px-3 py-1.5 text-xs font-semibold text-[#9a5b00]">
              Acil alıcı
            </span>
          )}
          {request.isFeatured && (
            <span className="rounded-full bg-[#eee7ff] px-3 py-1.5 text-xs font-semibold text-[#704daf]">
              Öne çıkan
            </span>
          )}
          {request.aiScore !== null && (
            <span className="rounded-full bg-[#eee7ff] px-3 py-1.5 text-xs font-semibold text-[#704daf]">
              AI kalite puanı {request.aiScore}/100
            </span>
          )}
        </div>

        <h1 className="mt-5 max-w-4xl text-4xl font-semibold tracking-[-0.05em] sm:text-5xl">
          {request.title}
        </h1>

        <div className="mt-5 flex flex-wrap gap-x-6 gap-y-2 text-sm text-black/40">
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
      </section>

      <div className="grid gap-5 lg:grid-cols-[1fr_360px]">
        <section className="space-y-5">
          <div className="rounded-[30px] border border-black/[0.06] bg-white p-6 shadow-[0_18px_60px_rgba(0,0,0,0.04)] sm:p-8">
            <p className="text-xs font-semibold uppercase tracking-[0.16em] text-black/30">
              Talep açıklaması
            </p>
            <p className="mt-5 whitespace-pre-line text-base leading-8 text-black/65">
              {request.professionalDescription || request.description}
            </p>
          </div>

          {request.fieldValues.length > 0 && (
            <div className="rounded-[30px] border border-black/[0.06] bg-white p-6 shadow-[0_18px_60px_rgba(0,0,0,0.04)] sm:p-8">
              <h2 className="text-2xl font-semibold tracking-tight">
                Teknik detaylar
              </h2>
              <div className="mt-6 grid gap-3 sm:grid-cols-2">
                {request.fieldValues.map((value) => (
                  <div key={value.id} className="rounded-[20px] bg-[#f6f6f2] p-4">
                    <p className="text-xs font-medium text-black/35">
                      {value.field.label}
                    </p>
                    <p className="mt-2 font-semibold">
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

        <aside className="space-y-4">
          {showOfferPrompt ? (
            <div className="rounded-[28px] border border-black/[0.06] bg-white p-6 shadow-[0_18px_60px_rgba(0,0,0,0.04)]">
              <p className="text-lg font-semibold">Teklif ver</p>
              <p className="mt-2 text-sm text-black/45">
                Teklif metninde telefon ve IBAN paylaşmayın. Mesajlaşma teklif
                kabul edildikten sonra açılır.
              </p>
              <div className="mt-5">
                <OfferForm
                  requestId={request.id}
                  entitlements={entitlementDto}
                />
              </div>
            </div>
          ) : (
            <Link
              href={`/panel/talepler/${request.id}?teklif=1`}
              className="flex w-full items-center justify-center rounded-full bg-black px-5 py-3.5 text-sm font-semibold text-white"
            >
              Teklif ver
            </Link>
          )}

          <div className="rounded-[28px] bg-[#171717] p-6 text-white shadow-[0_24px_75px_rgba(0,0,0,0.14)]">
            <div className="flex h-11 w-11 items-center justify-center rounded-[17px] bg-white/10">
              <Sparkles className="h-5 w-5 text-[#d8c5ff]" />
            </div>
            <p className="mt-5 text-xs uppercase tracking-[0.16em] text-white/30">
              AI özeti
            </p>
            <p className="mt-3 whitespace-pre-line text-sm leading-6 text-white/65">
              {request.aiSummary ||
                "Talep AI tarafından analiz edilerek yayınlandı."}
            </p>
          </div>

          <div className="rounded-[28px] border border-black/[0.06] bg-white p-6">
            <SummaryRow
              icon={<WalletCards className="h-5 w-5" />}
              label="Bütçe"
              value={
                request.budgetMin
                  ? formatMoney(Number(request.budgetMin), request.currency)
                  : "Belirtilmedi"
              }
            />
            <SummaryRow
              icon={<MessageSquareText className="h-5 w-5" />}
              label="Mevcut teklif"
              value={`${request._count.offers}`}
              last
            />
          </div>
        </aside>
      </div>
    </>
  );
}

function DetailHeader({ locked }: { locked: boolean }) {
  return (
    <header className="flex items-center justify-between rounded-[26px] border border-black/[0.06] bg-white/80 px-5 py-4 backdrop-blur-xl">
      <Link
        href="/panel/talepler"
        className="flex items-center gap-2 text-sm font-medium text-black/45 transition hover:text-black"
      >
        <ArrowLeft className="h-4 w-4" />
        Talepleri keşfet
      </Link>
      <span
        className={`rounded-full px-3 py-2 text-xs font-semibold ${
          locked
            ? "bg-[#eee7ff] text-[#704daf]"
            : "bg-[#e4f4df] text-[#356d3a]"
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
      <section className="rounded-[30px] border border-black/[0.06] bg-white p-6 shadow-[0_18px_60px_rgba(0,0,0,0.04)] sm:p-8">
        <p className="text-xs font-semibold uppercase tracking-[0.16em] text-black/30">
          Sınırlı önizleme
        </p>
        <p className="mt-5 text-base leading-8 text-black/55">
          Bu talep henüz standart erişime açılmadı. Tam açıklama, teknik
          detaylar, bütçe ve teklif formu Premium üyeler için anında
          görünür.
        </p>
        <ul className="mt-6 space-y-2 text-sm text-black/40">
          <li className="rounded-[16px] bg-[#f6f6f2] px-4 py-3">
            Talep başlığı ve kategori görüntüleniyor
          </li>
          <li className="rounded-[16px] bg-[#f6f6f2] px-4 py-3">
            Detaylı içerik ve teklif hakkı kilitli
          </li>
          {visibleAt && (
            <li className="rounded-[16px] bg-[#f6f6f2] px-4 py-3">
              Standart erişim: {formatDateTime(visibleAt)}
            </li>
          )}
        </ul>
      </section>

      <aside className="rounded-[28px] border border-[#8c72c9]/25 bg-[#f8f5ff] p-6">
        <div className="flex items-start gap-3">
          <Crown className="mt-0.5 h-5 w-5 text-[#704daf]" />
          <div>
            <p className="font-semibold text-[#4f3d72]">
              Bu talebe hemen erişmek için Premium&apos;a geç.
            </p>
            <p className="mt-2 text-sm leading-6 text-[#4f3d72]/70">
              Premium üyeler yeni talepleri anında görür, sınırsız teklif verir
              ve AI araçlarından yararlanır.
            </p>
            <Link
              href="/panel/plan"
              className="mt-4 inline-flex items-center gap-2 rounded-full bg-black px-4 py-2.5 text-xs font-semibold text-white"
            >
              <Zap className="h-3.5 w-3.5" />
              Premium&apos;a geç
            </Link>
          </div>
        </div>
      </aside>
    </div>
  );
}

function SummaryRow({
  icon,
  label,
  value,
  last = false,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
  last?: boolean;
}) {
  return (
    <div
      className={`flex items-center justify-between py-4 ${last ? "" : "border-b border-black/[0.06]"}`}
    >
      <span className="flex items-center gap-3 text-sm text-black/40">
        {icon}
        {label}
      </span>
      <span className="text-sm font-semibold">{value}</span>
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

function formatMoney(amount: number, currency: string) {
  return new Intl.NumberFormat("tr-TR", {
    style: "currency",
    currency,
    maximumFractionDigits: 0,
  }).format(amount);
}
