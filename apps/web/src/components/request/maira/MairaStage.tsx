"use client";

/**
 * MAIRA SAHNESİ — SUNUM KATMANI, CEVAP OTORİTESİ DEĞİL.
 *
 * Bu bileşen hiçbir soru, seçenek ya da kategori kuralı üretmez. Gösterdiği
 * her şey kanonik `FocusedQuestion[]` listesinden ve o sorunun KANONİK
 * kontrolünden (`question.control`) gelir; Maira ikinci bir soru sistemi
 * kurmaz. Kalıcı cevap deposu tutmaz: taslak metin dışında state yoktur ve
 * cevap uygulaması sayfanın apply-plan yolundan geçer.
 *
 * KOMPOZİSYON (2026-08-31, görsel ret sonrası). Önceki sürüm sahneyi 26vh
 * yüksekliğinde, 520px genişliğinde bir yuvaya sıkıştırıyor; mor sayfa
 * zemini ve standart beyaz "Son birkaç detay" kartı Maira'nın içinde
 * kalıyordu — sonuç "sayfaya eklenmiş video küçük resmi"ydi. Artık onaylanan
 * Showcase kompozisyonu taşınır: sahne `fixed inset-0` ile bütün viewport'u
 * kaplar, üstünde yalnız üç bölge durur — nav, `M A I R A` plakası ve alt
 * sıra (soru → cevaplar → Yanıtlarım). Standart form yüzeyi Maira'da HİÇ
 * çizilmez; o yüzey yalnız "Standart görünüme geç" ile açılır.
 *
 * Ölçüler (30px kenar boşluğu, 20px kart aralığı, 267px alt sıra, 256px
 * wordmark) onaylanan `maira8/overlay.css` tokenlarından birebir alındı;
 * burada yeniden tasarlanmaz.
 */
import dynamic from "next/dynamic";
import { useEffect, useState } from "react";

import type { FocusedQuestion } from "@/lib/request-composer/v2/focused-questions";
import type { UserAnswerRow } from "@/lib/request-composer/v2/answer-apply-plan";
import type { QuestionControlDef } from "@/lib/request-composer/v2/question-control-types";

import { MairaAnswers } from "./MairaAnswers";
import { formatBudgetDigits } from "@/lib/request-composer/v2/answer-apply-plan";

/**
 * Sahne yalnız istemcide yaşar: WebGL sunucuda yoktur ve ana paket
 * büyümesin diye ayrı bir parçaya alınır.
 */
const MairaContourScene = dynamic(
  () => import("./MairaContourScene").then((m) => m.MairaContourScene),
  { ssr: false },
);

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

/**
 * ONAYLANAN SHOWCASE TOKEN SETİ — `maira8/overlay.css`'ten birebir taşındı.
 *
 * Neden burada: 1440 ve 1024'te sabit 1920 değerleri kullanmak ölçüleri
 * onaylanan kompozisyondan ayırıyordu (ölçüldü: 1024'te lead sütunu 44px'e
 * eziliyordu). Kırılım noktaları ve yeniden yığma kuralı da kaynağın
 * kendisinden gelir; burada yeni bir ölçek uydurulmaz.
 */
const SHOWCASE_TOKENS = `
/* Kurucu 2026-09-01: kompozisyon bir kademe geri çekildi ("çok yakın").
   Taban artık eski 1680 katmanının değerlerini kullanır; oran korunur. */
.maira-showcase{
  --sc-pad:26px; --sc-gap:26px; --sc-radius:28px; --sc-text:21px;
  --sc-stat:56px; --sc-wm:224px; --sc-pill-px:35px; --sc-pill-py:14px;
  --sc-pill-r:41px; --sc-btn-gap:18px; --sc-lead-w:530px;
  --sc-card-h:234px; --sc-card-pad:28px; --sc-card-gap:18px;
  --sc-card1-w:256px; --sc-card2-w:531px; --sc-plate-min:180px;
}
@media (max-width:1680px){.maira-showcase{
  --sc-pad:22px; --sc-gap:22px; --sc-radius:24px; --sc-text:18px; --sc-stat:48px;
  --sc-wm:192px; --sc-pill-px:30px; --sc-pill-py:12px; --sc-pill-r:35px;
  --sc-btn-gap:15px; --sc-lead-w:455px; --sc-card-h:200px; --sc-card-pad:24px;
  --sc-card-gap:15px; --sc-card1-w:220px; --sc-card2-w:455px;}}
@media (max-width:1440px){.maira-showcase{
  --sc-pad:19px; --sc-gap:19px; --sc-radius:20px; --sc-text:16px; --sc-stat:42px;
  --sc-wm:168px; --sc-pill-px:26px; --sc-pill-py:11px; --sc-pill-r:31px;
  --sc-btn-gap:14px; --sc-lead-w:400px; --sc-card-h:176px; --sc-card-pad:21px;
  --sc-card-gap:14px; --sc-card1-w:194px; --sc-card2-w:400px;}}
@media (max-width:1200px){.maira-showcase{
  --sc-pad:19px; --sc-gap:19px; --sc-radius:20px; --sc-text:15px; --sc-stat:40px;
  --sc-wm:160px; --sc-pill-px:25px; --sc-pill-py:10px; --sc-pill-r:29px;
  --sc-btn-gap:13px; --sc-lead-w:379px; --sc-card-h:167px; --sc-card-pad:20px;
  --sc-card-gap:13px; --sc-card1-w:183px; --sc-card2-w:379px;}}
@media (max-width:1024px){.maira-showcase{
  --sc-pad:20px; --sc-gap:20px; --sc-radius:20px; --sc-text:16px; --sc-stat:44px;
  --sc-wm:150px; --sc-pill-px:22px; --sc-pill-py:10px; --sc-pill-r:28px;
  --sc-btn-gap:12px; --sc-card-pad:24px; --sc-card-gap:12px; --sc-plate-min:260px;}
  .maira-showcase .sc-bottom{flex-wrap:wrap;height:auto;}
  .maira-showcase .sc-lead{flex:1 0 100%;align-items:stretch;}
  .maira-showcase .maira-options{flex:2 1 360px;width:auto;}
  .maira-showcase .sc-card-stat{flex:1 1 220px;width:auto;}}
@media (max-width:768px){.maira-showcase{
  --sc-pad:16px; --sc-gap:16px; --sc-radius:18px; --sc-text:15px; --sc-stat:40px;
  --sc-wm:105px; --sc-card-pad:20px; --sc-card-gap:12px; --sc-plate-min:200px;}
  .maira-showcase .maira-options,.maira-showcase .sc-card-stat{flex:1 1 100%;}}
@media (max-width:480px){.maira-showcase{
  --sc-text:14px; --sc-stat:34px; --sc-wm:66px; --sc-card-pad:16px;}}
@media (max-width:414px){.maira-showcase{--sc-wm:58px;}}
@media (min-width:1025px) and (max-height:820px){.maira-showcase{--sc-wm:200px;}}
@media (min-width:1025px) and (max-height:820px) and (max-width:1440px){.maira-showcase{--sc-wm:176px;}}
@media (min-width:1025px) and (max-height:680px){.maira-showcase{--sc-wm:156px;}}
`;

const WORDMARK = ["M", "A", "I", "R", "A"] as const;

const ARROW = (
  <svg
    className="sc-arrow h-[0.614em] w-[0.834em] flex-none"
    viewBox="0 0 20 14.7279"
    fill="none"
    aria-hidden="true"
    xmlns="http://www.w3.org/2000/svg"
  >
    <path
      d="M1 6.36396C0.447715 6.36396 0 6.81168 0 7.36396C0 7.91625 0.447715 8.36396 1 8.36396V7.36396V6.36396ZM19.7071 8.07107C20.0976 7.68054 20.0976 7.04738 19.7071 6.65685L13.3431 0.292893C12.9526 -0.097631 12.3195 -0.097631 11.9289 0.292893C11.5384 0.683418 11.5384 1.31658 11.9289 1.70711L17.5858 7.36396L11.9289 13.0208C11.5384 13.4113 11.5384 14.0445 11.9289 14.435C12.3195 14.8256 12.9526 14.8256 13.3431 14.435L19.7071 8.07107ZM1 7.36396V8.36396H19V7.36396V6.36396H1V7.36396Z"
      fill="currentColor"
    />
  </svg>
);

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
  /* Yalnız görünüm durumu — cevap değil. */
  const [answersOpen, setAnswersOpen] = useState(false);
  const [moreOpen, setMoreOpen] = useState(false);

  const active = questions[0] ?? null;
  const control = active?.control ?? null;

  /* Soru değişince "diğer seçenekler" kapanır; taslak sayfanın state'idir. */
  useEffect(() => {
    setMoreOpen(false);
  }, [active?.fieldKey]);

  /**
   * Görünen seçenekler KANONİK kontrolden gelir: önce değer seçenekleri,
   * sonra kanonik kaçışlar. İlk üçü görünür, kalanı "Diğer seçenekler"
   * aynı yüzeyde açar — Showcase'in alt sıra düzeni budur.
   */
  const allOptions = [
    ...(control?.options ?? []),
    ...(control?.softOptions ?? []),
  ].filter((o) => o.value && o.value !== "__custom__");
  const visibleOptions = allOptions.slice(0, 3);
  const hasMore = allOptions.length > 3;

  const draft = active ? (draftByKey[active.fieldKey] ?? "") : "";
  const allowCustom = Boolean(control?.allowCustom) || allOptions.length === 0;

  const commit = (value: string) => {
    if (!active) return;
    const trimmed = value.trim();
    if (!trimmed) return;
    onAnswer(active.fieldKey, trimmed);
  };

  return (
    <section
      className="maira-showcase fixed inset-0 z-40 overflow-hidden bg-[#0c0c0c] text-[#f2f2f2]"
      data-testid="maira-stage"
    >
      <style>{SHOWCASE_TOKENS}</style>

      {/* Sahne katmanı — bütün viewport, dekoratif, etkileşimsiz. */}
      <div className="pointer-events-none absolute inset-0" aria-hidden="true">
        <div
          className="absolute inset-0"
          style={{
            backgroundImage:
              "radial-gradient(closest-side, rgba(255,180,137,0.16), rgba(201,138,166,0.06) 55%, transparent 100%)",
          }}
        />
        <MairaContourScene />
        {/* Alt kenar sahne rengine erir: gövde kesimi görünmez, kadraj
            dışındaki hiçbir ayrıntı okunmaz (kurucu, 2026-09-04). */}
        <div className="absolute inset-x-0 bottom-0 h-[34%] bg-gradient-to-t from-[#0c0c0c] via-[#0c0c0c]/78 to-transparent" />
      </div>

      <div className="sc relative flex h-full flex-col gap-[var(--sc-gap)] p-[var(--sc-pad)]">
        {/* nav — tek eylem, sahneyi boğmayan sade kapsül */}
        <header className="sc-nav flex flex-none items-center justify-end">
          <button
            type="button"
            data-testid="maira-exit-to-standard"
            onClick={onExitToStandard}
            className="inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-full border border-white/20 bg-white/[0.06] px-5 py-2.5 text-[14px] font-medium leading-none text-[#f2f2f2]/85 backdrop-blur transition hover:border-white/45 hover:bg-white/[0.12] hover:text-white"
          >
            Standart görünüme geç
            {ARROW}
          </button>
        </header>

        {/* plate — M A I R A kilidi, sahnenin üstünde */}
        <div className="sc-plate relative flex min-h-[var(--sc-plate-min)] flex-1 items-center justify-center">
          <h1
            className="sc-wordmark maira-wordmark flex w-[calc(var(--sc-wm)*5.859375)] max-w-full select-none items-center justify-between text-[length:var(--sc-wm)] font-normal leading-none"
            aria-label="Maira"
          >
            {WORDMARK.map((ch, i) => (
              <span
                key={`${ch}-${i}`}
                aria-hidden="true"
                className="block bg-clip-text text-center text-transparent"
                style={{
                  backgroundImage:
                    i % 2 === 1
                      ? "linear-gradient(180deg,rgba(255,255,255,0) 0%,#ffffff 100%)"
                      : "linear-gradient(180deg,#ffffff 0%,rgba(255,255,255,0) 100%)",
                }}
              >
                {ch}
              </span>
            ))}
          </h1>
        </div>

        {/* alt sıra — soru → cevaplar → Yanıtlarım (Showcase düzeni) */}
        <div className="sc-bottom flex h-[var(--sc-card-h)] flex-none items-stretch gap-[var(--sc-card-gap)]">
          <div className="sc-lead flex min-w-0 flex-1 flex-col items-end justify-between gap-6">
            <div className="w-full max-w-[var(--sc-lead-w)]">
              <p className="maira-eyebrow text-[14px] uppercase tracking-[0.14em] text-[#f2f2f2]/60">
                {active ? "Maira soruyor" : "Maira"}
              </p>
              <p
                className="sc-para mt-2 text-[length:var(--sc-text)] leading-tight"
                aria-live="polite"
                role="status"
                data-testid="maira-question-prompt"
              >
                {active ? (active.humanPrompt ?? active.label) : subtitle}
              </p>
              {typeof remainingCriticalCount === "number" &&
              remainingCriticalCount > 0 ? (
                <p className="mt-2 text-[13px] text-[#f2f2f2]/45">
                  Yayına {remainingCriticalCount} soru
                </p>
              ) : null}
            </div>

            {active ? (
              <div className="sc-cta flex w-full max-w-[var(--sc-lead-w)] gap-[var(--sc-btn-gap)]">
                {allowCustom ? (
                  <>
                    <label className="sr-only" htmlFor="maira-free-answer">
                      {active.humanPrompt ?? active.label}
                    </label>
                    <input
                      id="maira-free-answer"
                      data-testid="maira-free-answer"
                      value={draft}
                      placeholder={active.placeholder ?? "Yanıtını yaz"}
                      onChange={(e) => {
                        /* Para alanında binlik ayraç YAZARKEN görünür
                           (kurucu, 2026-09-01: "450000" ham görünüyordu). */
                        const v =
                          control?.controlType === "money_range"
                            ? /* Yalnız rakam: harf para alanına hiç giremez
                                 (kurucu, 2026-09-01). */
                              formatBudgetDigits(
                                e.target.value.replace(/[^0-9.,]/g, ""),
                              )
                            : e.target.value;
                        onDraftChange(active.fieldKey, v);
                      }}
                      onKeyDown={(e) => {
                        if (e.key === "Enter") commit(draft);
                      }}
                      className="min-h-[52px] flex-1 rounded-[81px] border border-[#f2f2f2]/25 bg-[#171717]/80 px-6 text-[15px] text-[#f2f2f2] outline-none placeholder:text-[#f2f2f2]/35 focus:border-[#f2f2f2]/55"
                    />
                    <button
                      type="button"
                      data-testid="maira-send-answer"
                      onClick={() => commit(draft)}
                      className="sc-btn sc-btn-solid min-h-[52px] rounded-[81px] bg-[#f2f2f2] px-8 text-[15px] font-medium text-[#0c0c0c]"
                    >
                      Gönder
                    </button>
                  </>
                ) : null}
                {active.importance === "optional" ? (
                  <button
                    type="button"
                    data-testid="maira-skip"
                    onClick={() => onSkip(active.fieldKey)}
                    className="sc-btn sc-btn-ghost min-h-[52px] rounded-[81px] border border-[#f2f2f2]/45 px-6 text-[15px]"
                  >
                    Şimdilik geç
                  </button>
                ) : null}
              </div>
            ) : null}
          </div>

          <div className="sc-card sc-card-tags maira-options relative flex w-[var(--sc-card2-w)] flex-none flex-col gap-3 rounded-[var(--sc-radius)] bg-[#171717] p-[var(--sc-card-pad)]">
            <p className="sc-cardtitle text-[length:var(--sc-text)] font-medium leading-tight">
              {active ? "Bir yanıt seç" : "Şu an bekleyen soru yok"}
            </p>
            <div className="maira-option-list flex min-h-0 shrink flex-col gap-1.5 overflow-y-auto">
              {visibleOptions.map((opt) => (
                <button
                  key={opt.value}
                  type="button"
                  data-testid={`maira-option-${opt.value}`}
                  onClick={() => commit(opt.value)}
                  className="maira-option flex h-10 w-full flex-none items-center overflow-hidden text-ellipsis whitespace-nowrap rounded-xl bg-[#242424] px-[18px] text-left text-[15px] text-[#f2f2f2] transition hover:bg-[#2e2e2e]"
                >
                  {opt.label}
                </button>
              ))}
            </div>
            {hasMore ? (
              <button
                type="button"
                data-testid="maira-more-options"
                onClick={() => setMoreOpen((v) => !v)}
                aria-expanded={moreOpen}
                className="maira-more self-start text-[13px] text-[#f2f2f2]/60 transition hover:text-[#f2f2f2]"
              >
                {moreOpen ? "Kapat" : `Diğer seçenekler (${allOptions.length - 3})`}
              </button>
            ) : null}

            {/*
              DİĞER SEÇENEKLER BALONU (kurucu, 2026-09-01): liste kartın
              içinde büyüyüp satırları eziyordu; artık kartın ÜSTÜNDE kendi
              cam panelinde açılır. Seçenekler yine kanonik kontrolden gelir.
            */}
            {moreOpen ? (
              <div
                data-testid="maira-more-balloon"
                className="absolute inset-x-0 bottom-[calc(100%+14px)] z-30 overflow-hidden rounded-2xl border border-white/10 bg-[#101418]/95 shadow-[0_28px_80px_rgba(0,0,0,0.55)] backdrop-blur-xl"
                style={{ animation: "maira-balloon-in 0.35s cubic-bezier(0.22,0.61,0.36,1) both" }}
              >
                <style>{`@keyframes maira-balloon-in { from { opacity: 0; transform: translateY(10px) scale(0.985); } to { opacity: 1; transform: translateY(0) scale(1); } }`}</style>
                <div className="flex items-center justify-between border-b border-white/[0.07] px-5 py-3.5">
                  <span className="text-[13px] font-medium uppercase tracking-[0.14em] text-[#2dd4bf]/80">
                    Tüm seçenekler
                  </span>
                  <button
                    type="button"
                    onClick={() => setMoreOpen(false)}
                    className="text-[12px] text-white/50 transition hover:text-white"
                  >
                    Kapat
                  </button>
                </div>
                <div className="grid max-h-[44vh] grid-cols-2 gap-1.5 overflow-y-auto p-3">
                  {allOptions.map((opt) => (
                    <button
                      key={opt.value}
                      type="button"
                      data-testid={`maira-option-${opt.value}`}
                      onClick={() => {
                        setMoreOpen(false);
                        commit(opt.value);
                      }}
                      className="flex h-10 w-full flex-none items-center overflow-hidden text-ellipsis whitespace-nowrap rounded-lg bg-white/[0.05] px-3.5 text-left text-[14px] text-[#f2f2f2]/90 transition hover:bg-[#2dd4bf]/15 hover:text-white"
                    >
                      {opt.label}
                    </button>
                  ))}
                </div>
              </div>
            ) : null}
          </div>

          <button
            type="button"
            data-testid="maira-open-answers"
            onClick={() => setAnswersOpen(true)}
            className="sc-card sc-card-stat flex w-[var(--sc-card1-w)] flex-none flex-col justify-between gap-6 rounded-[var(--sc-radius)] bg-[#171717] p-[var(--sc-card-pad)] text-left transition hover:bg-[#1d1d1d]"
          >
            <span className="sc-cardtitle text-[length:var(--sc-text)] font-medium leading-tight">
              Yanıtlarım
            </span>
            <span className="sc-statblock flex flex-col gap-3">
              <span className="sc-figure text-[length:var(--sc-stat)] font-medium leading-tight">
                {answers.length}
              </span>
              <span className="sc-statfoot text-[length:var(--sc-text)] leading-tight">
                bilgi kaydedildi
              </span>
            </span>
          </button>
        </div>
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
