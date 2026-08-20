import Link from "next/link";
import { ArrowRight, Lock, Sparkles } from "lucide-react";
import type { ReactNode } from "react";

import { OfferIntelligenceCard } from "@/components/panel/OfferIntelligenceCard";
import type { OfferIntelligenceDTO } from "@/lib/monetization/offer-intelligence";
import { OFFER_INTELLIGENCE_MIN_OTHERS } from "@/lib/monetization/offer-intelligence";

export type OfferIntelligenceReadyItem = {
  requestId: string;
  requestTitle: string;
  intelligence: OfferIntelligenceDTO;
};

const secondaryCtaClass =
  "inline-flex min-h-11 shrink-0 items-center justify-center gap-2 rounded-xl border border-[#0f1f1d]/12 bg-white/70 px-4 text-sm font-semibold text-[#0f1f1d] transition hover:bg-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#c4a56c]/40";

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
      className="talepo-offer-intelligence"
    >
      <div className="talepo-offer-intelligence-surface px-4 py-4 sm:px-5">
        {mode === "locked" ? <LockedBody /> : null}
        {mode === "empty" ? <EmptyBody /> : null}
        {mode === "ready" ? <ReadyBody items={readyItems} /> : null}
      </div>
    </section>
  );
}

function IntelligenceMark() {
  return (
    <span className="talepo-offer-intelligence-mark" aria-hidden>
      <Sparkles className="h-4 w-4" strokeWidth={1.75} />
    </span>
  );
}

function IntelligenceHeader({
  description,
  action,
}: {
  description: ReactNode;
  action?: ReactNode;
}) {
  return (
    <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between lg:gap-6">
      <div className="flex min-w-0 flex-1 gap-3">
        <IntelligenceMark />
        <div className="min-w-0">
          <div className="flex flex-wrap items-baseline gap-x-2.5 gap-y-1">
            <h2
              id="teklif-zekasi-hub-title"
              className="text-[0.95rem] font-semibold tracking-[-0.02em] text-[#1c2430]"
            >
              Teklif Zekâsı
            </h2>
            <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-[#9a7b4a]">
              Profesyonel
            </p>
          </div>
          <div className="mt-1.5 max-w-2xl text-sm leading-6 text-[#5b6472]">
            {description}
          </div>
        </div>
      </div>
      {action ? <div className="lg:shrink-0">{action}</div> : null}
    </div>
  );
}

function LockedBody() {
  return (
    <IntelligenceHeader
      description={
        <>
          <p className="flex items-start gap-2 font-semibold text-[#1c2430]">
            <Lock
              className="mt-0.5 h-3.5 w-3.5 shrink-0 text-[#9a7b4a]"
              strokeWidth={2.25}
              aria-hidden
            />
            <span>Profesyonel üyelik ile açılır</span>
          </p>
          <p className="mt-1">
            Teklif verdiğiniz taleplerde yeterli anonim veri oluştuğunda teklif
            dağılımını ve fiyat konumunuzu görebilirsiniz. En az{" "}
            {OFFER_INTELLIGENCE_MIN_OTHERS} başka uygun teklif gerekir. Kimlik
            ve rakip listesi gösterilmez.
          </p>
        </>
      }
      action={
        <Link href="/panel/plan" className={secondaryCtaClass}>
          Profesyonel ile aç
        </Link>
      }
    />
  );
}

function EmptyBody() {
  return (
    <IntelligenceHeader
      description={
        <>
          <p className="font-semibold text-[#1c2430]">
            Henüz yeterli anonim teklif verisi oluşmadı.
          </p>
          <p className="mt-1">
            Teklif verdiğiniz bir talepte en az {OFFER_INTELLIGENCE_MIN_OTHERS}{" "}
            başka uygun teklif oluştuğunda burada fiyat dağılımını ve konumunuzu
            görebilirsiniz.
          </p>
        </>
      }
      action={
        <Link href="/panel/talepler" className={secondaryCtaClass}>
          Talepler
          <ArrowRight className="h-4 w-4" aria-hidden />
        </Link>
      }
    />
  );
}

function ReadyBody({ items }: { items: OfferIntelligenceReadyItem[] }) {
  return (
    <div>
      <IntelligenceHeader
        description="Anonim teklif dağılımı hazır olan talepleriniz. Piyasa fiyatı veya kazanma tahmini değildir."
      />
      <div className="mt-4 space-y-4 border-t border-[#0f1f1d]/8 pt-4">
        {items.map((item) => (
          <div key={item.requestId}>
            <div className="flex flex-wrap items-center justify-between gap-2">
              <p className="min-w-0 truncate text-sm font-semibold text-[#1c2430]">
                {item.requestTitle}
              </p>
              <Link
                href={`/panel/talepler/${item.requestId}`}
                className="inline-flex min-h-11 items-center gap-1.5 rounded-xl px-2 text-xs font-semibold text-[#5b6472] transition hover:text-[#1c2430] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#c4a56c]/40"
              >
                Talebi aç
                <ArrowRight className="h-3.5 w-3.5" aria-hidden />
              </Link>
            </div>
            <div className="[&_section]:mt-3 [&_section]:border-0 [&_section]:bg-transparent [&_section]:p-0 [&_section]:shadow-none">
              <OfferIntelligenceCard
                intelligence={item.intelligence}
                requestId={item.requestId}
              />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
