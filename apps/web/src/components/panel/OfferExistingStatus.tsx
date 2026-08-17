import Link from "next/link";
import {
  ArrowRight,
  CheckCircle2,
  Clock3,
  MessageSquare,
  Pencil,
  XCircle,
} from "lucide-react";

type OfferExistingStatusProps = {
  status: string;
  reviseHref?: string;
  messagesHref?: string;
  newOfferHref?: string;
};

export function OfferExistingStatus({
  status,
  reviseHref,
  messagesHref,
  newOfferHref,
}: OfferExistingStatusProps) {
  if (status === "SUBMITTED" || status === "VIEWED") {
    return (
      <section className="rounded-2xl border border-teal-900/10 bg-white p-5 shadow-[0_12px_36px_rgba(15,31,29,0.04)] sm:p-6">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex min-w-0 items-start gap-3.5">
            <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-[#eef6f4] text-teal-800">
              <Clock3 className="h-5 w-5" />
            </span>
            <div className="min-w-0">
              <p className="text-lg font-semibold tracking-tight text-[#0f1f1d]">
                Teklife cevap bekleniyor
              </p>
              <p className="mt-1 text-sm leading-6 text-teal-950/55">
                Alıcı kabul edebilir veya karşı teklif verebilir. Tutar
                gönderimden sonra değişmez; fiyat pazarlığı karşı teklif
                turlarıyla yürür. Mesajlaşma anlaşmadan sonra açılır.
              </p>
            </div>
          </div>
          <div className="flex shrink-0 flex-wrap gap-2">
            {reviseHref && (
              <Link
                href={reviseHref}
                className="inline-flex items-center justify-center gap-2 rounded-xl bg-[#0f766e] px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-[#115e59]"
              >
                <Pencil className="h-4 w-4" />
                Teklif notunu güncelle
              </Link>
            )}
          </div>
        </div>
      </section>
    );
  }

  if (status === "ACCEPTED") {
    return (
      <section className="rounded-2xl border border-teal-900/10 bg-[#eef6f4] p-5 shadow-[0_12px_36px_rgba(15,31,29,0.04)] sm:p-6">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex min-w-0 items-start gap-3.5">
            <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-white text-teal-800">
              <CheckCircle2 className="h-5 w-5" />
            </span>
            <div className="min-w-0">
              <p className="text-lg font-semibold tracking-tight text-[#0f1f1d]">
                Teklifiniz kabul edildi
              </p>
              <p className="mt-1 text-sm leading-6 text-teal-950/55">
                Bu talep için teklifiniz seçildi. Mesajlaşma üzerinden devam
                edebilirsiniz.
              </p>
            </div>
          </div>
          {messagesHref && (
            <Link
              href={messagesHref}
              className="inline-flex shrink-0 items-center justify-center gap-2 rounded-xl bg-[#0f766e] px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-[#115e59]"
            >
              <MessageSquare className="h-4 w-4" />
              Mesajlara git
            </Link>
          )}
        </div>
      </section>
    );
  }

  if (status === "REJECTED") {
    return (
      <section className="rounded-2xl border border-black/[0.06] bg-[#fff8f6] p-5 shadow-[0_10px_32px_rgba(0,0,0,0.03)] sm:p-6">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex min-w-0 items-start gap-3.5">
            <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-[#ffe4df] text-[#8b352b]">
              <XCircle className="h-5 w-5" />
            </span>
            <div className="min-w-0">
              <p className="text-lg font-semibold tracking-tight text-[#5c241c]">
                Teklifiniz reddedildi
              </p>
              <p className="mt-1 text-sm leading-6 text-[#8b352b]/75">
                Alıcı bu teklifi kabul etmedi. Talep hâlâ açıksa yeni bir teklif
                gönderebilirsiniz.
              </p>
            </div>
          </div>
          {newOfferHref && (
            <Link
              href={newOfferHref}
              className="inline-flex shrink-0 items-center justify-center gap-2 rounded-full bg-[#111827] px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-black"
            >
              Yeni teklif ver
              <ArrowRight className="h-4 w-4" />
            </Link>
          )}
        </div>
      </section>
    );
  }

  return (
    <section className="rounded-2xl border border-black/[0.06] bg-white p-5 shadow-[0_10px_32px_rgba(0,0,0,0.03)] sm:p-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="min-w-0">
          <p className="text-lg font-semibold tracking-tight text-[#111827]">
            Bu talep için önceki teklifiniz kapandı
          </p>
          <p className="mt-1 text-sm leading-6 text-black/50">
            Geri çekilmiş veya süresi dolmuş teklifler yeni gönderime engel
            değildir.
          </p>
        </div>
        {newOfferHref && (
          <Link
            href={newOfferHref}
            className="inline-flex shrink-0 items-center justify-center gap-2 rounded-full bg-[#111827] px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-black"
          >
            Teklif ver
            <ArrowRight className="h-4 w-4" />
          </Link>
        )}
      </div>
    </section>
  );
}
