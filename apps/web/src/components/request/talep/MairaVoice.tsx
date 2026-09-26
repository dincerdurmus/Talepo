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
import {
  EASE_REVEAL,
  HIGHLIGHT_STEP_MS,
  READING_LEAD_MS,
  prefersReducedMotion,
  readingDurationMs,
} from "@/lib/motion/talep-motion";

import { MairaFace } from "./MairaFace";

export type MairaStatus =
  | "OKUYOR"
  | "SORUYOR"
  | "DÜŞÜNÜYOR"
  | "HAZIR"
  | "İNCELEMEDE"
  | "YAYINDA";

/**
 * Süreler ve yumuşatma değerleri KANONİK HAREKET TABLOSUNDAN gelir
 * (`lib/motion/talep-motion`); bu dosya kendi zamanlamasını uydurmaz.
 * `readingDurationMs` geriye dönük uyum için buradan da dışa verilir.
 */
export { readingDurationMs };

export function MairaStatusLine({
  status,
  thinking = false,
  pulseToken = 0,
}: {
  status: MairaStatus;
  thinking?: boolean;
  /**
   * DEKORATİF IŞIK NABZI. Her yeni vurguda artan bir sayaçtır; yüz o anda
   * bir kez parlar. Davranış taşımaz, hiçbir kararı tetiklemez.
   */
  pulseToken?: number;
}) {
  return (
    <div className="flex items-center gap-2.5" data-testid="maira-status-line">
      <MairaFace
        size={38}
        thinking={thinking}
        scene={false}
        pulseToken={pulseToken}
      />
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
  onReveal,
}: {
  segments: ReadingSegment[];
  /** `reading` büyük punto + sırayla vurgu; `quote` küçük alıntı. */
  phase: "reading" | "quote";
  /**
   * Her vurgu açıldığında çağrılır (1'den başlayan sıra numarasıyla). Yalnız
   * dekoratif nabız içindir; cevap, karar ya da telemetri taşımaz.
   */
  onReveal?: (index: number) => void;
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
  const [still] = useState(prefersReducedMotion);

  useEffect(() => {
    if (phase !== "reading" || still || entityCount === 0) return;
    const timers: number[] = [];
    for (let i = 0; i < entityCount; i += 1) {
      timers.push(
        window.setTimeout(() => {
          setRevealed(i + 1);
          onReveal?.(i + 1);
        }, READING_LEAD_MS + i * HIGHLIGHT_STEP_MS),
      );
    }
    return () => timers.forEach((t) => window.clearTimeout(t));
  }, [entityCount, onReveal, phase, still]);

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
            /* Yumuşatma kanonik hareket tablosundan; burada eğri uydurulmaz. */
            style={quote ? undefined : { transitionTimingFunction: EASE_REVEAL }}
            className={
              quote
                ? "relative mx-0 rounded-md bg-transparent px-0 text-[#0f1f1d] shadow-[inset_0_-1px_0_rgba(15,118,110,0.28)]"
                : `relative -mx-[3px] rounded-md px-[3px] py-[2px] text-inherit transition-all duration-300 ${
                    on ? "bg-[#e4f1ee]" : "bg-transparent"
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
            {/*
              VURGU ÇİZGİSİ SOLDAN SAĞA DOLAR (videodaki an). Sabit bir alt
              gölge yerine ölçeklenen bir çubuk: hareket yönü okuma yönüyle
              aynı olsun diye kaynak soldadır.
            */}
            {!quote ? (
              <span
                aria-hidden
                style={{ transitionTimingFunction: EASE_REVEAL }}
                className={`pointer-events-none absolute inset-x-0 bottom-0 h-[2px] origin-left rounded-full bg-[#0d9488] transition-transform duration-500 ${
                  on ? "scale-x-100" : "scale-x-0"
                }`}
              />
            ) : null}
            {segment.text}
          </mark>
        );
      })}
    </p>
  );
}
