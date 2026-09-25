"use client";

/**
 * MAIRA SAYFANIN SESİDİR (kurucu, 2026-09-25).
 *
 * Bu dosya iki küçük yüzey taşır ve ikisi de yalnız SUNAR:
 *  - `MairaStatusLine` — küçük yüz, "Maira" ve mono durum (OKUYOR / SORUYOR /
 *    DÜŞÜNÜYOR / HAZIR). Durumu kendisi hesaplamaz, dışarıdan alır.
 *  - `ReadingSentence` — tek teknolojik an. Kullanıcının cümlesi büyük
 *    puntoyla durur, anlaşılan parçalar SIRAYLA vurgulanır, sonra cümle
 *    küçülüp alıntıya döner.
 *
 * Vurgulanan parçalar burada ÜRETİLMEZ: `buildReadingHighlights` ile mevcut
 * anlama sonucundan türetilip hazır olarak gelir. Yeni model çağrısı, yeni
 * çıkarım ve kategoriye özel dal yoktur.
 */

import { useEffect, useMemo, useState } from "react";

import type { ReadingSegment } from "@/lib/request-composer/v2/reading-highlights";

import { MairaFace } from "./MairaFace";

export type MairaStatus =
  | "OKUYOR"
  | "SORUYOR"
  | "DÜŞÜNÜYOR"
  | "HAZIR"
  | "İNCELEMEDE"
  | "YAYINDA";

/** Vurgular arası gecikme; okuma anının toplam süresi bundan türer. */
const REVEAL_STEP_MS = 420;
const REVEAL_LEAD_MS = 320;
const REVEAL_TAIL_MS = 520;

/** Okuma anının bitip kartın belireceği an — tek yerden hesaplanır. */
export function readingDurationMs(spanCount: number): number {
  return REVEAL_LEAD_MS + Math.max(spanCount, 0) * REVEAL_STEP_MS + REVEAL_TAIL_MS;
}

export function MairaStatusLine({
  status,
  thinking = false,
}: {
  status: MairaStatus;
  thinking?: boolean;
}) {
  return (
    <div className="flex items-center gap-2.5" data-testid="maira-status-line">
      <MairaFace size={38} thinking={thinking} scene={false} />
      <span className="text-[15px] font-semibold text-[#0f1f1d]">Maira</span>
      <span
        data-testid="maira-status"
        className="font-mono text-[11px] font-medium uppercase tracking-[0.12em] text-[#0f766e]"
      >
        {status}
      </span>
    </div>
  );
}

export function ReadingSentence({
  segments,
  phase,
}: {
  segments: ReadingSegment[];
  /** `reading` büyük punto + sırayla vurgu; `quote` küçük alıntı. */
  phase: "reading" | "quote";
}) {
  const entityCount = useMemo(
    () => segments.filter((s) => s.kind === "entity").length,
    [segments],
  );
  const [revealed, setRevealed] = useState(0);
  /**
   * Azaltılmış hareket isteniyorsa sıraya hiç girilmez: her vurgu baştan
   * açıktır. Karar ilk render'da bir kez okunur — effect içinde state'e
   * yazmak gereksiz bir ikinci render üretirdi.
   */
  const [still] = useState(
    () =>
      typeof window !== "undefined" &&
      window.matchMedia("(prefers-reduced-motion: reduce)").matches,
  );

  useEffect(() => {
    if (phase !== "reading" || still || entityCount === 0) return;
    const timers: number[] = [];
    for (let i = 0; i < entityCount; i += 1) {
      timers.push(
        window.setTimeout(
          () => setRevealed(i + 1),
          REVEAL_LEAD_MS + i * REVEAL_STEP_MS,
        ),
      );
    }
    return () => timers.forEach((t) => window.clearTimeout(t));
  }, [entityCount, phase, still]);

  const quote = phase === "quote";
  const allOn = quote || still;

  return (
    <p
      data-testid="maira-reading-sentence"
      data-phase={phase}
      className={
        quote
          ? "m-0 text-[15px] font-normal leading-6 text-[#0f1f1d]/55 transition-all duration-500"
          : "m-0 text-[22px] font-medium leading-[2.1] tracking-[-0.02em] text-[#0f1f1d] transition-all duration-500 sm:text-[26px] lg:text-[30px]"
      }
    >
      {segments.map((segment, index) => {
        if (segment.kind === "plain") {
          return <span key={`p-${index}`}>{segment.text}</span>;
        }
        const on = allOn || segment.index < revealed;
        return (
          <mark
            key={`e-${segment.key}-${index}`}
            data-testid="maira-reading-entity"
            data-entity-key={segment.key}
            data-entity-label={segment.label}
            data-on={on ? "true" : "false"}
            className={
              quote
                ? "relative mx-0 rounded-md bg-transparent px-0 text-[#0f1f1d] shadow-[inset_0_-1px_0_rgba(15,118,110,0.28)]"
                : `relative -mx-[3px] rounded-md px-[3px] py-[2px] text-inherit transition-all duration-300 ${
                    on
                      ? "bg-[#e4f1ee] shadow-[inset_0_-2px_0_#0d9488]"
                      : "bg-transparent"
                  }`
            }
          >
            {!quote ? (
              <span
                aria-hidden
                className={`pointer-events-none absolute left-[3px] top-[-1.3em] whitespace-nowrap font-mono text-[10px] font-medium uppercase tracking-[0.08em] text-[#0f766e] transition-all duration-300 ${
                  on ? "translate-y-0 opacity-100" : "translate-y-1 opacity-0"
                }`}
              >
                {segment.label}
              </span>
            ) : null}
            {segment.text}
          </mark>
        );
      })}
    </p>
  );
}
