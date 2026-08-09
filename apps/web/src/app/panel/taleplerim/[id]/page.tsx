import Link from "next/link";
import { notFound } from "next/navigation";
import {
  ArrowLeft,
  CalendarDays,
  CircleCheck,
  MapPin,
  MessageSquareText,
  PencilLine,
  Sparkles,
  WalletCards,
} from "lucide-react";

import { DeleteRequestButton } from "@/components/panel/DeleteRequestButton";
import { OfferActions } from "@/components/panel/OfferActions";
import { displayRequestFieldValue } from "@/lib/field-display";
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

export default async function RequestDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const user = await requireUser();
  const { id } = await params;

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
          company: { select: { name: true, isVerified: true } },
          submittedBy: { select: { name: true } },
        },
      },
      _count: { select: { matches: true } },
    },
  });

  if (!request) notFound();

  const editable = canEditRequestStatus(request.status);
  const matchedCompanyCount = request._count.matches;
  const categorySlug = request.category.slug;

  return (
    <>
      <header className="flex flex-wrap items-center justify-between gap-3 rounded-[26px] border border-black/[0.06] bg-white/80 px-5 py-4 backdrop-blur-xl">
        <Link
          href="/panel/taleplerim"
          className="flex items-center gap-2 text-sm font-medium text-black/45 transition hover:text-black"
        >
          <ArrowLeft className="h-4 w-4" />
          Taleplerim
        </Link>
        <div className="flex items-center gap-2">
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
          <span className="rounded-full bg-[#e4f4df] px-3 py-2 text-xs font-semibold text-[#356d3a]">
            {statusLabels[request.status] ?? request.status}
          </span>
        </div>
      </header>

      <section className="py-8 sm:py-10">
        <div className="flex flex-wrap items-center gap-2">
          <span className="rounded-full bg-white px-3 py-1.5 text-xs font-semibold text-black/45">
            {request.category.name}
          </span>
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
            {request.offers.length} teklif
          </span>
          <span className="flex items-center gap-1.5">
            <Sparkles className="h-4 w-4" />
            {matchedCompanyCount} firmaya iletildi
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

          <div className="rounded-[30px] border border-black/[0.06] bg-white p-6 shadow-[0_18px_60px_rgba(0,0,0,0.04)] sm:p-8">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-black/35">Teklifler</p>
                <h2 className="mt-2 text-2xl font-semibold tracking-tight">
                  {request.offers.length === 0
                    ? "Henüz teklif gelmedi"
                    : `${request.offers.length} teklif geldi`}
                </h2>
              </div>
              <MessageSquareText className="h-6 w-6 text-black/25" />
            </div>

            {request.offers.length === 0 ? (
              <div className="mt-6 rounded-[22px] bg-[#f6f6f2] p-5 text-sm leading-6 text-black/45">
                Talebiniz yayınlandı. Uygun firmalardan gelen teklifler burada
                listelenecek.
              </div>
            ) : (
              <div className="mt-6 space-y-3">
                {request.offers.map((offer) => (
                  <div
                    key={offer.id}
                    className="rounded-[22px] border border-black/[0.06] p-5"
                  >
                    <div className="flex items-start justify-between gap-4">
                      <div>
                        <p className="font-semibold">
                          {offer.company?.name ||
                            offer.submittedBy.name ||
                            "Firma"}
                        </p>
                        <p className="mt-1 text-sm text-black/40">
                          {offer.deliveryDays
                            ? `${offer.deliveryDays} gün teslim`
                            : "Teslim süresi belirtilmedi"}
                        </p>
                        <p className="mt-3 text-sm leading-6 text-black/55">
                          {offer.description}
                        </p>
                      </div>
                      <p className="text-lg font-semibold">
                        {formatMoney(Number(offer.amount), offer.currency)}
                      </p>
                    </div>
                    {["SUBMITTED", "VIEWED"].includes(offer.status) && (
                      <OfferActions offerId={offer.id} />
                    )}
                    {offer.status === "ACCEPTED" && (
                      <p className="mt-3 text-xs font-semibold text-[#356d3a]">
                        Kabul edildi — mesajlaşma açıldı
                      </p>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        </section>

        <aside className="space-y-4">
          <div className="rounded-[28px] bg-[#171717] p-6 text-white shadow-[0_24px_75px_rgba(0,0,0,0.14)]">
            <div className="flex h-11 w-11 items-center justify-center rounded-[17px] bg-white/10">
              <Sparkles className="h-5 w-5 text-[#d8c5ff]" />
            </div>
            <p className="mt-5 text-xs uppercase tracking-[0.16em] text-white/30">
              AI özeti
            </p>
            <p className="mt-3 whitespace-pre-line text-sm leading-6 text-white/65">
              {request.aiSummary || "Talep AI tarafından analiz edilerek yayınlandı."}
            </p>
          </div>

          <div className="rounded-[28px] border border-black/[0.06] bg-white p-6">
            <SummaryRow
              icon={<CircleCheck className="h-5 w-5" />}
              label="Durum"
              value={statusLabels[request.status] ?? request.status}
            />
            <SummaryRow
              icon={<MessageSquareText className="h-5 w-5" />}
              label="Teklif"
              value={`${request.offers.length}`}
            />
            <SummaryRow
              icon={<WalletCards className="h-5 w-5" />}
              label="Bütçe"
              value={
                request.budgetMin
                  ? formatMoney(Number(request.budgetMin), request.currency)
                  : "Belirtilmedi"
              }
              last={!editable}
            />
            {editable && (
              <Link
                href={`/panel/taleplerim/${request.id}/duzenle`}
                className="mt-5 flex w-full items-center justify-center gap-2 rounded-[18px] bg-black px-4 py-3 text-sm font-semibold text-white transition hover:bg-black/80"
              >
                <PencilLine className="h-4 w-4" />
                Talebimi düzelt
              </Link>
            )}
            <div className={editable ? "" : "mt-5"}>
              <DeleteRequestButton requestId={request.id} variant="aside" />
            </div>
          </div>
        </aside>
      </div>
    </>
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
