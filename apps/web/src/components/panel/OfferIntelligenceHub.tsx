import Link from "next/link";
import { ArrowRight, Lock, Sparkles } from "lucide-react";

import { OfferIntelligenceCard } from "@/components/panel/OfferIntelligenceCard";
import type { OfferIntelligenceDTO } from "@/lib/monetization/offer-intelligence";
import { OFFER_INTELLIGENCE_MIN_OTHERS } from "@/lib/monetization/offer-intelligence";

export type OfferIntelligenceReadyItem = {
  requestId: string;
  requestTitle: string;
  intelligence: OfferIntelligenceDTO;
};

/**
 * Tekliflerim discoverability for Teklif Zekâsı.
 * LOCKED / EMPTY shells never mount READY exposure.
 * READY rows reuse OfferIntelligenceCard (exposure only on real READY mount).
 */
export function OfferIntelligenceHub({
  mode,
  readyItems = [],
}: {
  mode: "locked" | "empty" | "ready";
  readyItems?: OfferIntelligenceReadyItem[];
}) {
  return (
    <section
      aria-labelledby="teklif-zekasi-hub-title"
      className="mb-5 overflow-hidden rounded-[20px] border border-[#d9d0e8]/70 bg-white shadow-[0_8px_24px_rgba(107,86,163,0.06)]"
    >
      <div className="border-b border-[#ebe4f4] bg-[linear-gradient(180deg,#fbf8ff_0%,#ffffff_100%)] px-4 py-4 sm:px-5">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <h2
                id="teklif-zekasi-hub-title"
                className="text-base font-semibold tracking-[-0.02em] text-[#1c2430]"
              >
                Teklif Zekâsı
              </h2>
              <span className="inline-flex items-center rounded-full border border-[#cbb8e8]/70 bg-[#f3ecfb] px-2 py-0.5 text-[10px] font-bold uppercase tracking-[0.08em] text-[#6b56a3]">
                Professional
              </span>
            </div>
            <p className="mt-1.5 max-w-2xl text-sm leading-6 text-[#5b6472]">
              Gönderdiğiniz teklifleri anonim rekabet verileriyle değerlendirin.
            </p>
          </div>
          <span className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-[10px] bg-[#f3ecfb] text-[#6b56a3]">
            <Sparkles className="h-4 w-4" strokeWidth={2} />
          </span>
        </div>
      </div>

      <div className="px-4 py-4 sm:px-5 sm:py-5">
        {mode === "locked" ? <LockedBody /> : null}
        {mode === "empty" ? <EmptyBody /> : null}
        {mode === "ready" ? <ReadyBody items={readyItems} /> : null}
      </div>
    </section>
  );
}

function LockedBody() {
  return (
    <div className="rounded-[16px] border border-dashed border-[#d5cce6] bg-[#faf8fd] px-4 py-5 sm:px-5">
      <div className="flex items-start gap-3">
        <span className="mt-0.5 inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-[#efe8f8] text-[#6b56a3]">
          <Lock className="h-4 w-4" strokeWidth={2.25} />
        </span>
        <div className="min-w-0">
          <p className="text-sm font-semibold text-[#1c2430]">
            Professional üyelik ile açılır
          </p>
          <p className="mt-1.5 text-sm leading-6 text-[#5b6472]">
            Teklif verdiğiniz taleplerde yeterli anonim veri oluştuğunda teklif
            dağılımını ve fiyat konumunuzu görebilirsiniz.
          </p>
          <p className="mt-2 text-xs leading-5 text-[#7a8494]">
            En az {OFFER_INTELLIGENCE_MIN_OTHERS} başka uygun teklif gerekir.
            Kimlik ve rakip listesi gösterilmez.
          </p>
          <Link
            href="/panel/plan"
            className="mt-4 inline-flex min-h-11 items-center justify-center rounded-full bg-[#6b56a3] px-5 text-sm font-semibold text-white transition hover:bg-[#5a4790]"
          >
            Professional ile aç
          </Link>
        </div>
      </div>
    </div>
  );
}

function EmptyBody() {
  return (
    <div className="rounded-[16px] border border-[#ebe4f4] bg-[#fbfafe] px-4 py-5 sm:px-5">
      <p className="text-sm font-semibold text-[#1c2430]">
        Henüz yeterli anonim teklif verisi oluşmadı.
      </p>
      <p className="mt-1.5 text-sm leading-6 text-[#5b6472]">
        Teklif verdiğiniz bir talepte en az {OFFER_INTELLIGENCE_MIN_OTHERS} başka
        uygun teklif oluştuğunda burada fiyat dağılımını ve konumunuzu
        görebilirsiniz.
      </p>
      <Link
        href="/panel/talepler"
        className="mt-4 inline-flex min-h-11 items-center gap-2 rounded-full border border-teal-900/12 bg-white px-5 text-sm font-semibold text-teal-950 transition hover:bg-teal-50/60"
      >
        Talepleri keşfet
        <ArrowRight className="h-4 w-4" />
      </Link>
    </div>
  );
}

function ReadyBody({ items }: { items: OfferIntelligenceReadyItem[] }) {
  return (
    <div className="space-y-4">
      <p className="text-sm leading-6 text-[#5b6472]">
        Anonim teklif dağılımı hazır olan talepleriniz. Piyasa fiyatı veya
        kazanma tahmini değildir.
      </p>
      {items.map((item) => (
        <div
          key={item.requestId}
          className="overflow-hidden rounded-[16px] border border-[#ebe4f4] bg-[#fbfafe]"
        >
          <div className="flex flex-wrap items-center justify-between gap-2 border-b border-[#ebe4f4] px-4 py-3">
            <p className="min-w-0 truncate text-sm font-semibold text-[#1c2430]">
              {item.requestTitle}
            </p>
            <Link
              href={`/panel/talepler/${item.requestId}`}
              className="inline-flex min-h-11 items-center gap-1.5 rounded-full border border-teal-900/10 bg-white px-3 text-xs font-semibold text-teal-900"
            >
              Talebi aç
              <ArrowRight className="h-3.5 w-3.5" />
            </Link>
          </div>
          <div className="px-2 pb-2 sm:px-3 sm:pb-3 [&_section]:mt-0 [&_section]:border-0 [&_section]:bg-transparent [&_section]:p-3 [&_section]:shadow-none sm:[&_section]:p-4">
            <OfferIntelligenceCard
              intelligence={item.intelligence}
              requestId={item.requestId}
            />
          </div>
        </div>
      ))}
    </div>
  );
}
