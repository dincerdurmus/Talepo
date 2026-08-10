"use client";

import type { ReactNode } from "react";
import {
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
import type { HumanizedQuestion } from "@/lib/request-brain/human-question-layer";
import type {
  MarketIntelligenceSnapshot,
  RequestAnalysisStatus,
} from "@/lib/request-brain/types";
import type { RequestReadiness } from "@/lib/request-brain/request-readiness";
import type { SummaryChip } from "@/lib/request-brain/request-summary";

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
  humanQuestions: HumanizedQuestion[];
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
      <header className="space-y-1">
        <div className="inline-flex items-center gap-2 rounded-full border border-teal-300/25 bg-white/[0.05] px-2.5 py-1">
          <span className="talepo-ai-status-dot" />
          <span className="text-[11px] font-semibold uppercase tracking-[0.16em] text-teal-100/85">
            ✦ Talepo AI
          </span>
        </div>
        <p className="text-base font-semibold tracking-tight text-white">
          Talebinizi birlikte hazırlıyoruz
        </p>
        <p className="text-xs leading-5 text-teal-100/45">
          {props.readiness.message}
          {props.matchingFirmCount != null && props.matchingFirmCount > 0
            ? ` · ~${props.matchingFirmCount} firma`
            : ""}
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

      {/* 2. NETLEŞTİRELİM */}
      {props.humanQuestions.length > 0 ? (
        <WorkspaceSection title="Netleştirelim" tone="accent">
          <div className="space-y-3">
            {props.humanQuestions.map((q) => (
              <div key={q.fieldKey}>
                <p className="text-xs leading-5 text-teal-50/90">
                  {q.humanPrompt}
                </p>
                {q.fieldClass === "REQUIRED_TO_PUBLISH" ? (
                  <p className="mt-1 text-[10px] uppercase tracking-[0.12em] text-amber-200/60">
                    Yayın için gerekli
                  </p>
                ) : null}
                {q.quickChoices?.length ? (
                  <div className="mt-2 flex flex-wrap gap-1.5">
                    {q.quickChoices.map((choice) => (
                      <button
                        key={`${q.fieldKey}-${choice.value}`}
                        type="button"
                        onClick={() =>
                          props.onApplyHumanQuestion?.(q, choice.value)
                        }
                        className="rounded-full border border-teal-200/25 bg-white/5 px-2.5 py-1 text-[11px] text-teal-50/90 transition hover:border-teal-200/50 hover:bg-white/10"
                      >
                        {choice.label}
                      </button>
                    ))}
                  </div>
                ) : props.onApplyHumanQuestion ? (
                  <button
                    type="button"
                    onClick={() => props.onApplyHumanQuestion?.(q)}
                    className="mt-2 text-[11px] font-semibold text-teal-200/85 hover:text-white"
                  >
                    + {q.label} ekle
                  </button>
                ) : null}
                {q.escapeChoices?.length ? (
                  <div className="mt-2 flex flex-wrap gap-2">
                    {q.escapeChoices.map((escape) => (
                      <button
                        key={escape.value}
                        type="button"
                        onClick={() =>
                          props.onApplyHumanQuestion?.(q, escape.value)
                        }
                        className="text-[11px] text-teal-100/40 hover:text-teal-100/70"
                      >
                        {escape.label}
                      </button>
                    ))}
                  </div>
                ) : null}
              </div>
            ))}
          </div>
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
          <button
            type="button"
            onClick={props.onApplyProfessionalDraft}
            className="rounded-lg bg-[#0f766e] px-3 py-1.5 text-xs font-medium text-white"
          >
            Talebimde kullan
          </button>
        </div>
      </WorkspaceSection>

      <p className="flex items-start gap-2 px-0.5 text-[10px] leading-4 text-teal-100/35">
        <Info className="mt-0.5 h-3 w-3 shrink-0" />
        Piyasa bilgisi yardımcıdır; kesin fiyat garantisi değildir.
      </p>
    </div>
  );
}

function WorkspaceSection({
  title,
  tone,
  children,
}: {
  title: string;
  tone: "default" | "accent" | "light";
  children: ReactNode;
}) {
  const toneClass =
    tone === "light"
      ? "talepo-ai-version rounded-2xl p-3.5"
      : tone === "accent"
        ? "rounded-2xl border border-teal-300/20 bg-teal-400/8 px-3.5 py-3"
        : "talepo-ai-metric rounded-2xl p-3.5";

  return (
    <section className={toneClass}>
      <p
        className={`text-[11px] font-semibold uppercase tracking-[0.14em] ${
          tone === "light" ? "text-teal-800/55" : "text-teal-100/55"
        }`}
      >
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
