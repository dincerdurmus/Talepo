import Link from "next/link";
import {
  ArrowRight,
  CalendarDays,
  CirclePlus,
  MapPin,
  MessageSquareText,
  PencilLine,
  Sparkles,
} from "lucide-react";

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

export default async function MyRequestsPage() {
  const user = await requireUser();

  const requests = await prisma.request.findMany({
    where: {
      createdById: user.id,
      deletedAt: null,
    },
    orderBy: { createdAt: "desc" },
    include: {
      category: { select: { name: true } },
      _count: { select: { offers: true } },
    },
  });

  return (
    <>
      <section className="flex flex-col gap-5 py-4 sm:flex-row sm:items-end sm:justify-between sm:py-6">
        <div>
          <p className="text-sm font-semibold text-black/35">Panel</p>
          <h1 className="mt-3 text-4xl font-semibold tracking-[-0.05em] sm:text-5xl">
            Taleplerim
          </h1>
          <p className="mt-4 max-w-xl text-base leading-7 text-black/45">
            Yayınladığınız talepleri, gelen teklifleri ve süreç durumlarını
            buradan takip edin.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <div className="rounded-full bg-white px-4 py-2 text-sm font-semibold text-black/55 shadow-sm">
            {requests.length} talep
          </div>
          <Link
            href="/talep"
            className="flex items-center justify-center gap-2 rounded-full bg-black px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-black/80"
          >
            <CirclePlus className="h-4 w-4" />
            Yeni talep
          </Link>
        </div>
      </section>

      {requests.length === 0 ? (
        <section className="rounded-[34px] border border-black/[0.06] bg-white p-8 text-center shadow-[0_20px_70px_rgba(0,0,0,0.04)] sm:p-14">
          <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-[22px] bg-[#eee7ff]">
            <Sparkles className="h-7 w-7 text-[#704daf]" />
          </div>
          <h2 className="mt-6 text-2xl font-semibold tracking-tight">
            Henüz yayınlanmış talebiniz yok
          </h2>
          <p className="mx-auto mt-3 max-w-md text-sm leading-6 text-black/45">
            İhtiyacınızı birkaç cümleyle anlatın. Talepo AI bilgileri düzenleyip
            talebinizi yayınlamaya hazırlasın.
          </p>
          <Link
            href="/talep"
            className="mt-7 inline-flex items-center gap-2 rounded-full bg-black px-5 py-3 text-sm font-semibold text-white"
          >
            İlk talebimi oluştur
            <ArrowRight className="h-4 w-4" />
          </Link>
        </section>
      ) : (
        <section className="grid gap-4">
          {requests.map((request) => {
            const editable = canEditRequestStatus(request.status);

            return (
              <article
                key={request.id}
                className="rounded-[28px] border border-black/[0.06] bg-white p-5 shadow-[0_16px_55px_rgba(0,0,0,0.035)] transition hover:-translate-y-0.5 hover:shadow-[0_22px_65px_rgba(0,0,0,0.065)] sm:p-6"
              >
                <div className="flex flex-col gap-5 sm:flex-row sm:items-center sm:justify-between">
                  <Link
                    href={`/panel/taleplerim/${request.id}`}
                    className="min-w-0 flex-1"
                  >
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="rounded-full bg-[#efefeb] px-3 py-1.5 text-xs font-semibold text-black/45">
                        {request.category.name}
                      </span>
                      <span className="rounded-full bg-[#e4f4df] px-3 py-1.5 text-xs font-semibold text-[#356d3a]">
                        {statusLabels[request.status] ?? request.status}
                      </span>
                      {request.aiScore !== null && (
                        <span className="rounded-full bg-[#eee7ff] px-3 py-1.5 text-xs font-semibold text-[#704daf]">
                          AI puanı {request.aiScore}
                        </span>
                      )}
                      {request.isUrgent && (
                        <span className="rounded-full bg-[#ffe8cc] px-3 py-1.5 text-xs font-semibold text-[#9a5b00]">
                          Acil alıcı
                        </span>
                      )}
                      {request.isFeatured && (
                        <span className="rounded-full bg-[#dce9ff] px-3 py-1.5 text-xs font-semibold text-[#3d6fb5]">
                          Öne çıkan
                        </span>
                      )}
                    </div>

                    <h2 className="mt-4 truncate text-xl font-semibold tracking-tight sm:text-2xl">
                      {request.title}
                    </h2>

                    <div className="mt-3 flex flex-wrap gap-x-5 gap-y-2 text-sm text-black/40">
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
                  </Link>

                  <div className="flex shrink-0 items-center gap-2">
                    {editable && (
                      <Link
                        href={`/panel/taleplerim/${request.id}/duzenle`}
                        className="inline-flex items-center gap-2 rounded-full border border-black/10 bg-[#f7f7f4] px-4 py-2.5 text-sm font-semibold text-black/70 transition hover:bg-black hover:text-white"
                      >
                        <PencilLine className="h-4 w-4" />
                        Talebimi düzelt
                      </Link>
                    )}
                    <Link
                      href={`/panel/taleplerim/${request.id}`}
                      className="flex h-11 w-11 items-center justify-center rounded-full bg-[#f4f4f0] transition hover:bg-black hover:text-white"
                      aria-label="Talebi aç"
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

function formatDate(date: Date) {
  return new Intl.DateTimeFormat("tr-TR", {
    day: "numeric",
    month: "long",
    year: "numeric",
  }).format(date);
}
