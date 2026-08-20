import Link from "next/link";
import { ArrowRight, Inbox } from "lucide-react";

import { buildIncomingRequestWorkspacePath } from "@/lib/offer/incoming-offer-inbox";

type IncomingOffersTransitionCardProps = {
  requestId: string;
  offerCount: number;
};

export function IncomingOffersTransitionCard({
  requestId,
  offerCount,
}: IncomingOffersTransitionCardProps) {
  const href = buildIncomingRequestWorkspacePath({ requestId });
  const title =
    offerCount === 0
      ? "Henüz teklif gelmedi"
      : offerCount === 1
        ? "1 teklif geldi"
        : `${offerCount} teklif geldi`;

  if (offerCount === 0) {
    return (
      <section
        className="rounded-[22px] border border-black/[0.05] bg-[linear-gradient(135deg,#FAFCFB_0%,#F7F9F8_55%,#F3F7F6_100%)] px-4 py-4 sm:px-5"
        aria-label="Gelen teklifler"
      >
        <div className="flex items-start gap-3">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-[14px] bg-[#f4efe6] text-[#8a6a3d]">
            <Inbox className="h-4 w-4" aria-hidden />
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-teal-950/40">
              Gelen teklifler
            </p>
            <h2 className="mt-1 text-[15px] font-semibold tracking-tight text-[#0f1f1d]">
              {title}
            </h2>
            <p className="mt-1 text-[13px] leading-5 text-black/45">
              Talebiniz açık kaldığı sürece yeni teklifler burada görünecek.
            </p>
            <Link
              href={href}
              className="mt-2.5 inline-flex min-h-9 items-center text-[12px] font-semibold text-teal-900/70 underline-offset-2 hover:underline"
            >
              Gelen teklifleri aç
            </Link>
          </div>
        </div>
      </section>
    );
  }

  return (
    <section
      className="rounded-[22px] border border-teal-900/8 bg-[linear-gradient(135deg,#FAFCFB_0%,#F4F8F7_48%,#EEF5F3_100%)] px-4 py-4 shadow-[0_8px_28px_rgba(15,31,29,0.03)] sm:px-5 sm:py-4"
      aria-label="Gelen teklifler"
    >
      <div className="flex flex-col gap-3.5 sm:flex-row sm:items-center sm:justify-between sm:gap-5">
        <div className="flex min-w-0 items-start gap-3">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-[14px] bg-[#f4efe6] text-[#8a6a3d] ring-1 ring-amber-900/5">
            <Inbox className="h-4 w-4" aria-hidden />
          </div>
          <div className="min-w-0">
            <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-teal-950/40">
              Gelen teklifler
            </p>
            <h2 className="mt-1 text-[1.05rem] font-semibold tracking-tight text-[#0f1f1d] sm:text-[1.15rem]">
              {title}
            </h2>
            <p className="mt-1 max-w-md text-[13px] leading-5 text-black/45">
              Karşılaştırın, pazarlık yapın ve uygun teklifi seçin.
            </p>
          </div>
        </div>

        <Link
          href={href}
          className="inline-flex min-h-11 w-full shrink-0 items-center justify-center gap-2 rounded-xl bg-[#0f766e] px-4 text-sm font-semibold text-white transition hover:bg-[#0d6a63] sm:w-auto"
        >
          Teklifleri incele
          <ArrowRight className="h-4 w-4" aria-hidden />
        </Link>
      </div>
    </section>
  );
}
