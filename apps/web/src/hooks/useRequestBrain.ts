"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import { buildPreviewFingerprint } from "@/lib/request-brain/preview-fingerprint";
import type {
  MarketIntelligenceSnapshot,
  PricePreviewResponse,
  QuestionCandidate,
  RequestAnalysisStatus,
  RequestDraft,
} from "@/lib/request-brain/types";
import type { DynamicField } from "@/lib/request-category-engine";
import type { CompletenessBreakdown } from "@/lib/price-intelligence/strategy-completeness";
import type { PriceStrategyResolution } from "@/lib/price-intelligence/strategy-resolver";
import type { RequestUnderstandingResult } from "@/lib/request-understanding/types";
import {
  completenessFromUnderstanding,
  strategyResolutionFromUnderstanding,
} from "@/lib/request-understanding/activation-bridge";

const PREVIEW_DEBOUNCE_MS = 650;

export type UseRequestBrainInput = {
  draft: RequestDraft;
  dynamicFields: DynamicField[];
  requiredDynamicKeys: string[];
  professionalText: string;
  enabled: boolean;
  wizardStep: 1 | 2;
  /** Canonical understanding — strategy/completeness SoT when present */
  understanding?: RequestUnderstandingResult | null;
  /** Only then may categorySlug be sent as structured override to preview */
  categoryLockedByUser?: boolean;
};

export type UseRequestBrainResult = {
  analysisStatus: RequestAnalysisStatus;
  strategy: PriceStrategyResolution | null;
  completeness: CompletenessBreakdown | null;
  nextQuestions: QuestionCandidate[];
  marketIntelligence: MarketIntelligenceSnapshot | null;
  previewError: string | null;
  setAnalysisStatus: (status: RequestAnalysisStatus) => void;
  refreshPreview: () => void;
  professionalDraftApplied: boolean;
  setProfessionalDraftApplied: (applied: boolean) => void;
  professionalPreviewOpen: boolean;
  setProfessionalPreviewOpen: (open: boolean) => void;
};

function mapPreviewToMarket(
  data: NonNullable<PricePreviewResponse["intelligence"]>,
): MarketIntelligenceSnapshot {
  return {
    marketRange: data.marketRange ?? null,
    weightedReference: data.weightedReference ?? null,
    overallConfidence: data.overallConfidence ?? null,
    internalConfidence: data.internalConfidence ?? null,
    externalConfidence: data.externalConfidence ?? null,
    budgetEvaluation: data.budgetEvaluation ?? null,
    confidenceReasons: data.confidenceReasons ?? [],
    sourceCounts: {
      externalListings:
        data.externalListingStats?.rawSampleSize ??
        data.external?.fetchedCount ??
        0,
      talepoOffers: data.offerPriceStats?.rawSampleSize ?? 0,
      acceptedOffers: data.acceptedOfferStats?.rawSampleSize ?? 0,
      confirmedTransactions: data.confirmedTransactionStats?.rawSampleSize ?? 0,
    },
    externalMeta: data.external,
    insufficientData: Boolean(data.insufficientData),
  };
}

export function useRequestBrain(input: UseRequestBrainInput): UseRequestBrainResult {
  const [analysisStatus, setAnalysisStatus] = useState<RequestAnalysisStatus>("IDLE");
  const [marketIntelligence, setMarketIntelligence] =
    useState<MarketIntelligenceSnapshot | null>(null);
  const [previewError, setPreviewError] = useState<string | null>(null);
  const [professionalDraftApplied, setProfessionalDraftApplied] = useState(false);
  const [professionalPreviewOpen, setProfessionalPreviewOpen] = useState(false);

  const lastFingerprintRef = useRef<string | null>(null);
  const abortRef = useRef<AbortController | null>(null);

  /**
   * Strategy/completeness from authoritative understanding snapshot only.
   * Do not re-classify category/strategy from draft text (no second authority).
   * Question list is owned by resolveHybridQuestions — nextQuestions always [].
   */
  const localIntel = useMemo(() => {
    if (!input.understanding) {
      return { strategy: null, completeness: null };
    }
    if (!input.draft.title.trim() && !input.draft.rawText.trim()) {
      return { strategy: null, completeness: null };
    }

    try {
      const strategy = strategyResolutionFromUnderstanding(input.understanding);
      const completeness = completenessFromUnderstanding(
        input.understanding,
        input.draft.fieldValues,
      );
      return { strategy, completeness };
    } catch {
      return { strategy: null, completeness: null };
    }
  }, [input.draft, input.understanding]);

  /** @deprecated Questions come from resolveHybridQuestions (canonical-hybrid). */
  const nextQuestions: QuestionCandidate[] = [];

  const fetchPreview = useCallback(async () => {
    // Single-page flow: preview whenever composer is enabled (no wizard gate)
    if (!input.enabled) return;
    if (!input.draft.title.trim() || input.draft.title.trim().length < 3) return;

    // Cost control: skip external preview when canonical says NOT_READY
    const readiness = input.understanding?.priceAnalysisReadiness?.status;
    if (readiness === "NOT_READY") {
      setMarketIntelligence(null);
      setAnalysisStatus("PRICE_INSUFFICIENT");
      setPreviewError(null);
      return;
    }

    const fingerprint = buildPreviewFingerprint({
      categorySlug: input.draft.categorySlug,
      title: input.draft.title,
      fieldValues: input.draft.fieldValues,
      city: input.draft.city,
      district: input.draft.district,
      condition: input.draft.fieldValues.condition,
      canonicalStrategy: input.understanding?.strategy.value ?? null,
    });

    if (fingerprint === lastFingerprintRef.current && marketIntelligence) {
      return;
    }

    lastFingerprintRef.current = fingerprint;
    abortRef.current?.abort();
    const controller = new AbortController();
    abortRef.current = controller;

    setAnalysisStatus((s) =>
      s === "PUBLISHING" || s === "PUBLISHED" ? s : "PRICE_ANALYZING",
    );
    setPreviewError(null);

    try {
      const fieldValues = Object.entries(input.draft.fieldValues).map(([key, value]) => ({
        key,
        value: value || null,
      }));

      const includeExternal = readiness !== "LIMITED";

      const response = await fetch("/api/price-intelligence/preview", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          rawInput: input.draft.rawText || input.draft.title,
          categorySlug: input.draft.categorySlug || undefined,
          title: input.draft.title,
          fieldValues,
          budget: input.draft.budget || null,
          city: input.draft.city || null,
          district: input.draft.district,
          includeExternal,
          canonicalUnderstandingVersion: "v1",
          structuredOverrides: {
            categoryId: input.categoryLockedByUser
              ? input.draft.categorySlug || null
              : null,
            city: input.draft.city || null,
            district: input.draft.district,
            fieldValues: input.draft.fieldValues,
          },
        }),
        signal: controller.signal,
      });

      const data = (await response.json()) as PricePreviewResponse & {
        understandingStrategy?: string;
      };

      if (!response.ok || !data.ok || !data.intelligence) {
        setPreviewError("Piyasa analizi şu anda kullanılamıyor.");
        setAnalysisStatus("PRICE_ERROR");
        return;
      }

      const market = mapPreviewToMarket(data.intelligence);
      setMarketIntelligence(market);

      if (market.marketRange && market.overallConfidence?.level !== "NONE") {
        setAnalysisStatus("PRICE_READY");
      } else {
        setAnalysisStatus("PRICE_INSUFFICIENT");
      }
    } catch (err) {
      if ((err as Error).name === "AbortError") return;
      setPreviewError("Piyasa analizi şu anda kullanılamıyor.");
      setAnalysisStatus("PRICE_ERROR");
    }
  }, [
    input.draft,
    input.enabled,
    input.understanding?.priceAnalysisReadiness?.status,
    input.wizardStep,
    marketIntelligence,
  ]);

  useEffect(() => {
    if (!input.enabled || input.wizardStep !== 2) return;

    const timer = window.setTimeout(() => {
      void fetchPreview();
    }, PREVIEW_DEBOUNCE_MS);

    return () => window.clearTimeout(timer);
  }, [fetchPreview, input.enabled, input.wizardStep]);

  useEffect(() => {
    if (input.wizardStep === 2 && input.enabled) {
      // eslint-disable-next-line react-hooks/set-state-in-effect -- anlama sonucu → panel durumu senkronu; token korumalı (PanelShell emsali)
      setAnalysisStatus((s) => (s === "IDLE" || s === "PARSING" ? "READY_FOR_REVIEW" : s));
    }
  }, [input.enabled, input.wizardStep]);

  return {
    analysisStatus,
    strategy: localIntel.strategy,
    completeness: localIntel.completeness,
    nextQuestions,
    marketIntelligence,
    previewError,
    setAnalysisStatus,
    refreshPreview: fetchPreview,
    professionalDraftApplied,
    setProfessionalDraftApplied,
    professionalPreviewOpen,
    setProfessionalPreviewOpen,
  };
}
