"use client";

import { Lock, WandSparkles } from "lucide-react";

import {
  isOfferDraftAssistantLive,
  OFFER_DRAFT_COMING_SOON_COPY,
} from "@/lib/offer/offer-draft-assistant";

type OfferDraftSuggestionProps = {
  requestTitle: string;
  requestDescription: string;
  categoryName: string;
  teklifHref: string;
};

/**
 * Locked product teaser until ai_offer_assistant presentation status is LIVE.
 * Props retained for call-site stability; no draft API, navigation, or generation.
 */
export function OfferDraftSuggestion(_props: OfferDraftSuggestionProps) {
  if (isOfferDraftAssistantLive()) {
    return null;
  }

  return (
    <section
      className="mt-5 rounded-[16px] border border-teal-900/10 bg-[#f7faf9] px-4 py-3.5"
      aria-label="Teklif taslağı yakında aktif"
    >
      <div className="flex items-start gap-3">
        <span className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-[12px] border border-teal-900/10 bg-white text-teal-800/70">
          <WandSparkles className="h-4 w-4" aria-hidden />
        </span>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <p className="text-[14px] font-semibold tracking-tight text-[#0f1f1d]">
              Teklif taslağı
            </p>
            <span className="rounded-full border border-teal-900/8 bg-white px-2 py-0.5 text-[10px] font-semibold uppercase tracking-[0.08em] text-teal-800/80">
              Profesyonel
            </span>
            <span className="rounded-full bg-teal-900/[0.06] px-2 py-0.5 text-[10px] font-semibold uppercase tracking-[0.08em] text-teal-900/55">
              Yakında aktif
            </span>
          </div>
          <p className="mt-1.5 text-[13px] leading-5 text-[#0f1f1d]/55">
            {OFFER_DRAFT_COMING_SOON_COPY}
          </p>
          <button
            type="button"
            disabled
            aria-disabled="true"
            className="mt-3 inline-flex cursor-not-allowed items-center gap-1.5 rounded-full border border-teal-900/10 bg-white/80 px-3 py-1.5 text-[12px] font-semibold text-teal-950/40"
          >
            <Lock className="h-3.5 w-3.5" aria-hidden />
            Yakında aktif
          </button>
        </div>
      </div>
    </section>
  );
}

/** Compact locked row for offer composer — same availability authority. */
export function OfferDraftComposerLock() {
  if (isOfferDraftAssistantLive()) {
    return null;
  }

  return (
    <div
      className="flex items-center gap-2.5 rounded-[12px] border border-teal-900/[0.07] bg-[#f7faf9]/80 px-3 py-2.5"
      aria-label="Teklif taslağı yakında aktif"
    >
      <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-[10px] border border-teal-900/8 bg-white text-teal-800/55">
        <WandSparkles className="h-3.5 w-3.5" aria-hidden />
      </span>
      <div className="min-w-0 flex-1">
        <p className="text-[13px] font-medium text-[#0f1f1d]/75">
          Teklif taslağı
        </p>
        <p className="text-[11px] text-[#0f1f1d]/45">Yakında aktif</p>
      </div>
      <button
        type="button"
        disabled
        aria-disabled="true"
        className="inline-flex cursor-not-allowed items-center gap-1 rounded-full border border-teal-900/8 bg-white px-2.5 py-1 text-[11px] font-semibold text-teal-950/35"
      >
        <Lock className="h-3 w-3" aria-hidden />
        Kilitli
      </button>
    </div>
  );
}
