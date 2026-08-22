"use client";

import type { ReactNode } from "react";
import {
  AlertTriangle,
  Check,
  ChevronDown,
  FileText,
  Info,
  LoaderCircle,
  WandSparkles,
} from "lucide-react";
import { useState } from "react";

import { formatTryAmount } from "@/lib/request-brain/local-intelligence";
import {
  buildMarketPresentation,
  type MarketPresentation,
} from "@/lib/request-brain/market-presentation";
import { EnrichmentChips } from "@/components/request/EnrichmentChips";
import type { HumanizedQuestion } from "@/lib/request-brain/human-question-layer";
import type {
  MarketIntelligenceSnapshot,
  QuestionCandidate,
  RequestAnalysisStatus,
} from "@/lib/request-brain/types";
import type { RequestReadiness } from "@/lib/request-brain/request-readiness";
import type { SummaryChip } from "@/lib/request-brain/request-summary";
import { YearConditionConfirmation } from "@/components/request/YearConditionConfirmation";
import { FutureModelYearConfirmation } from "@/components/request/FutureModelYearConfirmation";
import { BudgetConflictConfirmation } from "@/components/request/BudgetConflictConfirmation";

export type ClarificationOption = {
  id: string;
  label: string;
  categoryId?: string;
  fieldKey?: string;
  value?: string;
};

export type TalepoAiPanelProps = {
  analysisStatus: RequestAnalysisStatus;
  categoryLabel: string;
  categoryConfident: boolean;
  readiness: RequestReadiness;
  marketIntelligence: MarketIntelligenceSnapshot | null;
  previewError: string | null;
  understoodHeadline: string;
  understoodChips: SummaryChip[];
  yearConditionConfirmation?: {
    year: string;
    condition: "Sıfır" | "İkinci el";
  } | null;
  onChangeConfirmedCondition?: (value: "Sıfır" | "İkinci el") => void;
  onConfirmYearCondition?: () => void;
  futureModelYearConfirmation?: { year: number } | null;
  onUseCurrentModelYear?: () => void;
  onConfirmFutureModelYear?: () => void;
  publishGuidance?: {
    attempted: boolean;
    missingLabels: string[];
    missingFieldKeys: string[];
  };
  budgetConflict?: { textBudget: string; enteredBudget: string } | null;
  onChooseBudget?: (value: string) => void;
  /** Ranked next questions — single ask surface (chips + draft) */
  enrichmentCandidates: QuestionCandidate[];
  enrichmentFieldKey: string | null;
  enrichmentDraft: string;
  humanPrompts?: Record<string, string>;
  onEnrichmentSelect: (question: QuestionCandidate) => void;
  onEnrichmentDraftChange: (value: string) => void;
  onEnrichmentApply: (question: QuestionCandidate, value: string) => void;
  onEnrichmentCancel: () => void;
  /** @deprecated kept for type compat — prefer enrichmentCandidates */
  humanQuestions?: HumanizedQuestion[];
  clarification?: {
    prompt: string;
    options: ClarificationOption[];
  } | null;
  onClarificationSelect?: (option: ClarificationOption) => void;
  onApplyHumanQuestion?: (question: HumanizedQuestion, value?: string) => void;
  onKeepBudget?: () => void;
  onUseMarketMedian?: () => void;
  showBudgetActions?: boolean;
  professionalText: string;
  professionalPreviewOpen: boolean;
  professionalDraftApplied?: boolean;
  onToggleProfessionalPreview: () => void;
  onApplyProfessionalDraft: () => void;
  matchingFirmCount?: number;
  compact?: boolean;
};

export function TalepoAiPanel(props: TalepoAiPanelProps) {
  const market = buildMarketPresentation({
    analysisStatus: props.analysisStatus,
    market: props.marketIntelligence,
    previewError: props.previewError,
  });

  const showUnderstood =
    props.understoodChips.length > 0 ||
    (props.understoodHeadline &&
      props.understoodHeadline !== "Talebiniz" &&
      props.categoryConfident);

  return (
    <div
      className={`talepo-ai-panel-body relative z-[1] space-y-4 ${
        props.compact ? "p-0" : ""
      }`}
    >
      <header>
        <div className="talepo-ai-console-bar">
          <span className="inline-flex items-center gap-2">
            <span className="talepo-ai-status-dot" />
            <span className="talepo-ai-index">
              {props.analysisStatus === "PARSING"
                ? "Analiz sürüyor"
                : props.readiness.state === "READY"
                  ? "Yayına hazır"
                  : "Canlı analiz"}
            </span>
          </span>
          {props.matchingFirmCount != null && props.matchingFirmCount > 0 ? (
            <span className="talepo-ai-index">
              ~{props.matchingFirmCount} firma
            </span>
          ) : null}
        </div>
        <p className="mt-2 text-xs leading-5 text-teal-100/45">
          {props.readiness.message}
        </p>
      </header>

      {/* 1. ANLADIĞIM */}
      <WorkspaceSection title="Anladığım" tone="default">
        {props.analysisStatus === "PARSING" ? (
          <p className="flex items-center gap-2 text-xs text-teal-100/60">
            <LoaderCircle className="h-3.5 w-3.5 animate-spin" />
            Talepo talebinizi inceliyor…
          </p>
        ) : props.clarification && !props.categoryConfident ? (
          <UncertaintyBlock
            clarification={props.clarification}
            onSelect={props.onClarificationSelect}
          />
        ) : showUnderstood ? (
          <div>
            <p className="inline-flex items-center gap-1.5 text-xs font-medium text-emerald-300/90">
              <Check className="h-3.5 w-3.5" aria-hidden />
              Sizi şöyle anladım
            </p>
            <p className="mt-1.5 text-lg font-semibold tracking-tight text-white">
              {props.understoodHeadline}
            </p>
            {props.categoryConfident ? (
              <p className="mt-1 text-xs text-teal-100/50">
                {props.categoryLabel}
              </p>
            ) : (
              <p className="mt-1 text-xs text-amber-200/70">
                Kategori henüz net değil — birlikte netleştirelim
              </p>
            )}
            {props.understoodChips.length > 0 ? (
              <div className="mt-3 flex flex-wrap gap-1.5">
                {props.understoodChips.map((chip) => (
                  <span
                    key={chip.fieldKey}
                    className="rounded-full border border-teal-200/20 bg-white/5 px-2.5 py-1 text-[11px] text-teal-50/85"
                  >
                    {chip.displayValue}
                  </span>
                ))}
              </div>
            ) : null}
          </div>
        ) : (
          <p className="text-xs leading-5 text-teal-100/50">
            Yazmaya devam edin — anladığımız bilgileri burada göstereceğiz.
          </p>
        )}
      </WorkspaceSection>

      {props.yearConditionConfirmation && props.onChangeConfirmedCondition && props.onConfirmYearCondition ? (
        <YearConditionConfirmation
          year={props.yearConditionConfirmation.year}
          condition={props.yearConditionConfirmation.condition}
          onChangeCondition={props.onChangeConfirmedCondition}
          onConfirm={props.onConfirmYearCondition}
        />
      ) : null}

      {props.futureModelYearConfirmation && props.onUseCurrentModelYear && props.onConfirmFutureModelYear ? (
        <FutureModelYearConfirmation
          year={props.futureModelYearConfirmation.year}
          onUseCurrentYear={props.onUseCurrentModelYear}
          onConfirm={props.onConfirmFutureModelYear}
        />
      ) : null}

      {props.budgetConflict && props.onChooseBudget ? (
        <BudgetConflictConfirmation
          textBudget={props.budgetConflict.textBudget}
          enteredBudget={props.budgetConflict.enteredBudget}
          onChoose={props.onChooseBudget}
        />
      ) : null}

      {/* 2. NETLEŞTİRELİM — single ask surface (no duplicate left chips) */}
      {props.enrichmentCandidates.length > 0 ? (
        <WorkspaceSection title="Netleştirelim" tone="accent">
          <EnrichmentChips
            variant="dark"
            candidates={props.enrichmentCandidates}
            activeFieldKey={props.enrichmentFieldKey}
            draftValue={props.enrichmentDraft}
            humanPrompts={props.humanPrompts}
            highlightFieldKeys={
              props.publishGuidance?.attempted
                ? props.publishGuidance.missingFieldKeys
                : []
            }
            onSelect={props.onEnrichmentSelect}
            onDraftChange={props.onEnrichmentDraftChange}
            onApply={props.onEnrichmentApply}
            onCancel={props.onEnrichmentCancel}
          />
        </WorkspaceSection>
      ) : null}

      {/* 3. PİYASA */}
      {market.state !== "HIDDEN" ? (
        <MarketSection
          market={market}
          showBudgetActions={props.showBudgetActions}
          onKeepBudget={props.onKeepBudget}
          onUseMarketMedian={props.onUseMarketMedian}
          userBudget={props.marketIntelligence?.budgetEvaluation?.userBudget}
        />
      ) : null}

      {props.publishGuidance?.attempted &&
      props.publishGuidance.missingLabels.length > 0 ? (
        <section className="rounded-2xl border-2 border-[#facc15] bg-[#17221d] p-4 text-white shadow-[0_14px_36px_rgba(0,0,0,0.28),0_0_24px_rgba(250,204,21,0.08)]">
          <p className="flex items-center gap-3 text-sm font-bold text-white">
            <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-[#facc15] text-[#29220a] shadow-[0_7px_18px_rgba(250,204,21,0.3)]"><AlertTriangle className="h-5 w-5" /></span>
            Talebini yayınlamadan önce {props.publishGuidance.missingLabels.length} bilgiyi tamamlayalım.
          </p>
          <div className="mt-3 flex flex-wrap gap-2">
            {props.publishGuidance.missingLabels.map((label) => (
              <span
                key={label}
                className="rounded-full border border-white/20 bg-white/10 px-2.5 py-1 text-[11px] font-semibold text-white/90"
              >
                {label}
              </span>
            ))}
          </div>
        </section>
      ) : null}

      {/* 4. PROFESYONEL TALEP */}
      <WorkspaceSection title="Profesyonel talep" tone="light">
        <div className="flex items-center gap-2">
          <FileText className="h-3.5 w-3.5 text-[#0f766e]/70" />
          <WandSparkles className="ml-auto h-3.5 w-3.5 text-[#0f766e]/45" />
        </div>
        {props.professionalPreviewOpen ? (
          <p className="talepo-ai-firm-text mt-2 max-h-40 overflow-y-auto whitespace-pre-line break-words rounded-xl bg-[#f7faf9] px-3 py-2.5 text-xs leading-6 text-teal-950/65">
            {props.professionalText}
          </p>
        ) : (
          <p className="mt-2 text-xs leading-5 text-teal-800/60">
            Verdiğiniz bilgileri değiştirmeden daha açık ve profesyonel bir talep
            hazırladık.
          </p>
        )}
        <div className="mt-2.5 flex flex-wrap gap-2">
          <button
            type="button"
            onClick={props.onToggleProfessionalPreview}
            className="rounded-lg border border-teal-900/10 bg-white px-3 py-1.5 text-xs font-medium text-teal-900/70"
          >
            {props.professionalPreviewOpen ? "Gizle" : "Önizle"}
          </button>
          {props.professionalDraftApplied ? (
            <span className="inline-flex items-center gap-1.5 rounded-lg border border-[#0f766e]/30 bg-[#e7f5ee] px-3 py-1.5 text-xs font-semibold text-[#0f5f59]">
              ✓ Talebinizde kullanılıyor
            </span>
          ) : (
            <button
              type="button"
              onClick={props.onApplyProfessionalDraft}
              className="rounded-lg bg-[#0f766e] px-3 py-1.5 text-xs font-semibold text-white shadow-[0_4px_14px_rgba(15,118,110,0.35)] transition hover:bg-[#115e59]"
            >
              Talebimde kullan
            </button>
          )}
        </div>
        {props.professionalDraftApplied ? (
          <p className="mt-2 text-[11px] leading-4 text-teal-800/70">
            Talep metniniz profesyonel hâle getirildi — soldaki yazım alanında
            görebilirsiniz.
          </p>
        ) : null}
      </WorkspaceSection>

      <p className="flex items-start gap-2 px-0.5 text-[10px] leading-4 text-teal-100/35">
        <Info className="mt-0.5 h-3 w-3 shrink-0" />
        Piyasa bilgisi yardımcıdır; kesin fiyat garantisi değildir.
      </p>
    </div>
  );
}

/** Akış sırası — konsol segment numaraları gerçek adım sırasıdır. */
const SECTION_INDEX: Record<string, string> = {
  Anladığım: "01",
  Netleştirelim: "02",
  "Piyasa görünümü": "03",
  "Profesyonel talep": "04",
};

function WorkspaceSection({
  title,
  tone,
  children,
}: {
  title: string;
  tone: "default" | "accent" | "light";
  children: ReactNode;
}) {
  const index = SECTION_INDEX[title];
  if (tone === "light") {
    return (
      <section className="talepo-ai-version rounded-2xl p-3.5">
        <p className="flex items-center gap-2 text-[11px] font-semibold uppercase tracking-[0.14em] text-teal-800/55">
          {index ? (
            <span className="talepo-ai-index !text-teal-800/45">{index}</span>
          ) : null}
          <span className="talepo-ai-section-tick" aria-hidden />
          {title}
        </p>
        <div className="mt-2.5">{children}</div>
      </section>
    );
  }
  return (
    <section
      className={
        tone === "accent" ? "talepo-ai-seg talepo-ai-seg--accent" : "talepo-ai-seg"
      }
    >
      <p className="flex items-center gap-2 text-[11px] font-semibold uppercase tracking-[0.14em] text-teal-100/55">
        {index ? <span className="talepo-ai-index">{index}</span> : null}
        {title}
      </p>
      <div className="mt-2.5">{children}</div>
    </section>
  );
}

function UncertaintyBlock({
  clarification,
  onSelect,
}: {
  clarification: NonNullable<TalepoAiPanelProps["clarification"]>;
  onSelect?: (option: ClarificationOption) => void;
}) {
  return (
    <div>
      <p className="text-xs font-medium text-amber-200/85">
        Bunu biraz netleştirelim
      </p>
      <p className="mt-1.5 text-sm leading-6 text-teal-50/90">
        {clarification.prompt}
      </p>
      <div className="mt-3 flex flex-wrap gap-1.5">
        {clarification.options.map((option) => (
          <button
            key={option.id}
            type="button"
            onClick={() => onSelect?.(option)}
            className="rounded-full border border-amber-200/30 bg-amber-400/10 px-3 py-1.5 text-[11px] font-medium text-amber-50/95 transition hover:bg-amber-400/20"
          >
            {option.label}
          </button>
        ))}
      </div>
    </div>
  );
}

function MarketSection({
  market,
  showBudgetActions,
  onKeepBudget,
  onUseMarketMedian,
  userBudget,
}: {
  market: MarketPresentation;
  showBudgetActions?: boolean;
  onKeepBudget?: () => void;
  onUseMarketMedian?: () => void;
  userBudget?: number | null;
}) {
  const [howOpen, setHowOpen] = useState(false);

  return (
    <WorkspaceSection title="Piyasa görünümü" tone="default">
      {market.state === "LOADING" ? (
        <p className="flex items-center gap-2 text-xs text-teal-100/60">
          <LoaderCircle className="h-3.5 w-3.5 animate-spin" />
          {market.explanation}
        </p>
      ) : null}

      {market.state === "ENOUGH" || market.state === "LIMITED" ? (
        <>
          <p className="text-xs text-teal-100/55">{market.explanation}</p>
          <p className="mt-2 text-xl font-semibold tracking-tight text-white">
            {market.rangeText}
          </p>
          <p className="mt-1.5 text-xs text-teal-100/55">
            Tipik değer{" "}
            <span className="font-medium text-teal-50/90">
              {market.medianText}
            </span>
            {market.confidenceLabel
              ? ` · Güven: ${market.confidenceLabel}`
              : ""}
          </p>
          <p className="mt-2 text-[11px] text-teal-100/45">
            {market.sourceSemantics}
          </p>
          {market.state === "LIMITED" ? (
            <p className="mt-2 rounded-lg border border-amber-200/20 bg-amber-400/10 px-2.5 py-2 text-[11px] text-amber-50/85">
              Sınırlı piyasa verisi
            </p>
          ) : null}
          {market.budgetMessage ? (
            <p className="mt-2 text-xs text-teal-50/80">{market.budgetMessage}</p>
          ) : null}
          {userBudget != null && Number.isFinite(userBudget) ? (
            <p className="mt-1 text-[11px] text-teal-100/45">
              Bütçeniz: {formatTryAmount(userBudget)}
            </p>
          ) : null}
          {showBudgetActions ? (
            <div className="mt-2.5 flex flex-wrap gap-2">
              {onKeepBudget ? (
                <button
                  type="button"
                  onClick={onKeepBudget}
                  className="rounded-full border border-teal-200/25 px-2.5 py-1 text-[11px] text-teal-50/85"
                >
                  Bütçemi koru
                </button>
              ) : null}
              {onUseMarketMedian ? (
                <button
                  type="button"
                  onClick={onUseMarketMedian}
                  className="rounded-full border border-teal-200/25 bg-white/5 px-2.5 py-1 text-[11px] text-teal-50/85"
                >
                  Piyasa medyanını kullan
                </button>
              ) : null}
            </div>
          ) : null}
          {market.breakdown.length > 0 ? (
            <>
              <button
                type="button"
                onClick={() => setHowOpen((o) => !o)}
                className="mt-2 inline-flex items-center gap-1 text-[11px] text-teal-100/40 hover:text-teal-100/70"
                aria-expanded={howOpen}
              >
                Bu tahmin neye dayanıyor?
                <ChevronDown
                  className={`h-3 w-3 transition ${howOpen ? "rotate-180" : ""}`}
                />
              </button>
              {howOpen ? (
                <ul className="mt-2 space-y-1 text-[11px] text-teal-100/45">
                  {market.breakdown.map((row) => (
                    <li key={row.label}>
                      {row.label}: {row.count}
                    </li>
                  ))}
                </ul>
              ) : null}
            </>
          ) : null}
        </>
      ) : null}

      {market.state === "INSUFFICIENT" ? (
        <div>
          <p className="text-sm text-teal-50/90">Henüz yeterli piyasa verisi yok.</p>
          <p className="mt-1.5 text-xs leading-5 text-teal-100/50">
            {market.explanation}
          </p>
        </div>
      ) : null}

      {market.state === "ERROR" ? (
        <p className="text-xs leading-5 text-teal-100/60">{market.explanation}</p>
      ) : null}
    </WorkspaceSection>
  );
}
