"use client";

/**
 * MAIRA SAHNESİ — SUNUM KATMANI, CEVAP OTORİTESİ DEĞİL.
 *
 * Bu bileşen hiçbir soru, seçenek ya da kategori kuralı üretmez. Gösterdiği
 * her şey kanonik `FocusedQuestion[]` listesinden gelir ve kontroller mevcut
 * `FocusedQuestionsPanel` ile çizilir — 11 kontrol tipinin davranışı tek
 * yerde kalır, Maira ikinci bir kopyasını kurmaz.
 *
 * Kalıcı cevap deposu tutmaz: taslak metin ve panelin kendi geçici durumu
 * dışında state yoktur. Cevap uygulaması sayfanın apply-plan yolundan geçer.
 *
 * Görsel kimlik bu dilimin dışındadır: sahnede sahte bir yüz üretilmez, sade
 * ve sessiz bir ışık alanı bırakılır.
 */
import { useState } from "react";

import { FocusedQuestionsPanel } from "@/components/request/v2/FocusedQuestionsPanel";
import type { FocusedQuestion } from "@/lib/request-composer/v2/focused-questions";
import type { UserAnswerRow } from "@/lib/request-composer/v2/answer-apply-plan";
import type { QuestionControlDef } from "@/lib/request-composer/v2/question-control-types";

import { MairaAnswers } from "./MairaAnswers";

type Props = {
  /** Tek soru otoritesi — kanonik liste, olduğu gibi. */
  questions: FocusedQuestion[];
  draftByKey: Record<string, string>;
  onDraftChange: (fieldKey: string, value: string) => void;
  onAnswer: (fieldKey: string, value: string) => void;
  onSkip: (fieldKey: string) => void;
  remainingCriticalCount?: number;
  /** Kanonik cevaplardan türetilmiş satırlar. */
  answers: UserAnswerRow[];
  /** Kullanıcıya okunan cümle — sayfanın kanonik metni. */
  subtitle: string;
  onExitToStandard: () => void;
  /** Bir cevabı düzenlemek için kanonik kontrol — sayfa çözer, Maira üretmez. */
  editControl: (fieldKey: string) => QuestionControlDef | null;
  /** Düzenlenen cevap mevcut kanonik işleyiciye gider. */
  onEditAnswer: (fieldKey: string, value: string) => void;
};

export function MairaStage({
  questions,
  draftByKey,
  onDraftChange,
  onAnswer,
  onSkip,
  remainingCriticalCount,
  answers,
  subtitle,
  onExitToStandard,
  editControl,
  onEditAnswer,
}: Props) {
  /* Yalnız yaprağın açık/kapalı olması — cevap değil, görünüm durumu. */
  const [answersOpen, setAnswersOpen] = useState(false);

  return (
    <section
      className="relative min-h-[70vh] overflow-hidden rounded-3xl bg-[#07040f] text-[#f2ede9]"
      data-testid="maira-stage"
      style={{
        backgroundImage:
          "radial-gradient(115% 88% at 50% 26%, #2b1848 0%, rgba(25,14,44,.86) 34%, rgba(11,6,20,.98) 68%, #07040f 100%)",
      }}
    >
      <header className="flex items-start justify-between gap-3 px-6 py-5">
        <div>
          <span className="font-serif text-2xl leading-none tracking-[0.015em]">
            m<b className="font-normal text-[#ffb489]">AI</b>ra
          </span>
          <span className="mt-1.5 block text-[9.5px] uppercase tracking-[0.34em] text-[#f2ede9]/30">
            Talepo
          </span>
        </div>
        <div className="flex flex-wrap justify-end gap-2">
          <button
            type="button"
            data-testid="maira-open-answers"
            onClick={() => setAnswersOpen(true)}
            className="min-h-10 rounded-full border border-white/10 bg-white/[0.05] px-4 text-[13px] transition hover:border-white/25"
          >
            Yanıtlarım · <b className="font-semibold text-[#ffb489]">{answers.length}</b>
          </button>
          <button
            type="button"
            data-testid="maira-exit-to-standard"
            onClick={onExitToStandard}
            className="min-h-10 rounded-full border border-white/10 bg-white/[0.05] px-4 text-[13px] transition hover:border-white/25"
          >
            Standart görünüme geç
          </button>
        </div>
      </header>

      {/*
        GÖRSEL KİMLİK BU DİLİMİN DIŞINDA. Sahte yüz üretilmez; yalnız sessiz
        bir ışık alanı bırakılır ve nihai varlık ayrı yöntemle çözülür.
      */}
      <div
        className="mx-auto h-[26vh] max-h-[240px] w-full max-w-[520px] rounded-[50%] opacity-70"
        aria-hidden="true"
        style={{
          backgroundImage:
            "radial-gradient(closest-side, rgba(255,180,137,0.16), rgba(201,138,166,0.06) 55%, transparent 100%)",
        }}
      />

      <div className="mx-auto grid w-full max-w-[680px] justify-items-center gap-4 px-6 pb-8">
        <p
          className="m-0 max-w-[620px] text-center text-[19px] leading-relaxed"
          aria-live="polite"
          role="status"
          data-testid="maira-subtitle"
        >
          {subtitle}
        </p>

        {questions.length > 0 ? (
          <div className="w-full rounded-2xl bg-white/[0.96] p-1 text-[#0f1f1d]">
            <FocusedQuestionsPanel
              questions={questions}
              draftByKey={draftByKey}
              onDraftChange={onDraftChange}
              onAnswer={onAnswer}
              onSkip={onSkip}
              remainingCriticalCount={remainingCriticalCount}
            />
          </div>
        ) : null}
      </div>

      <MairaAnswers
        rows={answers}
        open={answersOpen}
        onClose={() => setAnswersOpen(false)}
        editControl={editControl}
        onEdit={(fieldKey, value) => {
          onEditAnswer(fieldKey, value);
        }}
      />
    </section>
  );
}
