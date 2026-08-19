import Link from "next/link";
import { ArrowRight, Lock, Sparkles } from "lucide-react";
import type { CSSProperties, ReactNode } from "react";

import { OfferIntelligenceCard } from "@/components/panel/OfferIntelligenceCard";
import type { OfferIntelligenceDTO } from "@/lib/monetization/offer-intelligence";
import { OFFER_INTELLIGENCE_MIN_OTHERS } from "@/lib/monetization/offer-intelligence";

export type OfferIntelligenceReadyItem = {
  requestId: string;
  requestTitle: string;
  intelligence: OfferIntelligenceDTO;
};

/** Same peach → rose → lavender wash as sidebar Pro Araçlar. */
const PRO_SURFACE_STYLE: CSSProperties = {
  background:
    "linear-gradient(180deg, rgba(255,246,234,0.92) 0%, rgba(253,232,228,0.9) 28%, rgba(246,228,238,0.9) 64%, rgba(235,228,246,0.94) 100%)",
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
      className="mb-5 overflow-hidden rounded-[20px] border border-[rgba(196,154,108,0.28)] bg-white shadow-[0_8px_24px_rgba(176,108,128,0.08)]"
    >
      <div className="border-b border-[rgba(196,154,108,0.18)] bg-white px-4 py-4 sm:px-5">
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
          <span className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-[10px] bg-[#f4e6c8] text-[#b8893a] shadow-[inset_0_1px_0_rgba(255,255,255,0.7)]">
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

function ProBubble({
  children,
  className = "",
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <div
      className={`relative overflow-hidden rounded-[16px] border border-[rgba(196,154,108,0.32)] px-4 py-5 shadow-[0_10px_24px_rgba(176,108,128,0.1),inset_0_1px_0_rgba(255,255,255,0.72)] sm:px-5 ${className}`}
      style={PRO_SURFACE_STYLE}
    >
      <div
        aria-hidden
        className="pointer-events-none absolute inset-x-4 top-0 h-px bg-[linear-gradient(90deg,transparent,rgba(212,175,110,0.55),transparent)]"
      />
      {children}
    </div>
  );
}

function LockedBody() {
  return (
    <ProBubble>
      <div className="relative flex items-start gap-3">
        <span className="mt-0.5 inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-[#f4e6c8] text-[#b8893a] shadow-[inset_0_1px_0_rgba(255,255,255,0.7)]">
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
    </ProBubble>
  );
}

function EmptyBody() {
  return (
    <ProBubble>
      <div className="relative">
        <p className="text-sm font-semibold text-[#1c2430]">
          Henüz yeterli anonim teklif verisi oluşmadı.
        </p>
        <p className="mt-1.5 text-sm leading-6 text-[#5b6472]">
          Teklif verdiğiniz bir talepte en az {OFFER_INTELLIGENCE_MIN_OTHERS}{" "}
          başka uygun teklif oluştuğunda burada fiyat dağılımını ve konumunuzu
          görebilirsiniz.
        </p>
        <Link
          href="/panel/talepler"
          className="mt-4 inline-flex min-h-11 items-center gap-2 rounded-full border border-[rgba(196,154,108,0.35)] bg-white/80 px-5 text-sm font-semibold text-[#1c2430] shadow-[inset_0_1px_0_rgba(255,255,255,0.8)] transition hover:bg-white"
        >
          Talepler
          <ArrowRight className="h-4 w-4" />
        </Link>
      </div>
    </ProBubble>
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
        <ProBubble key={item.requestId} className="!p-0">
          <div className="relative flex flex-wrap items-center justify-between gap-2 border-b border-[rgba(196,154,108,0.2)] px-4 py-3">
            <p className="min-w-0 truncate text-sm font-semibold text-[#1c2430]">
              {item.requestTitle}
            </p>
            <Link
              href={`/panel/talepler/${item.requestId}`}
              className="inline-flex min-h-11 items-center gap-1.5 rounded-full border border-[rgba(196,154,108,0.35)] bg-white/80 px-3 text-xs font-semibold text-[#1c2430]"
            >
              Talebi aç
              <ArrowRight className="h-3.5 w-3.5" />
            </Link>
          </div>
          <div className="relative px-2 pb-2 sm:px-3 sm:pb-3 [&_section]:mt-0 [&_section]:border-0 [&_section]:bg-transparent [&_section]:p-3 [&_section]:shadow-none sm:[&_section]:p-4">
            <OfferIntelligenceCard
              intelligence={item.intelligence}
              requestId={item.requestId}
            />
          </div>
        </ProBubble>
      ))}
    </div>
  );
}
