/**
 * Shared composer v2 question flow — demo and /talep must use this authority.
 * Demo may only block publish; it must not invent a parallel scheduler/CTA.
 */

"use client";

import { useMemo } from "react";

import type { QuestionCandidate } from "@/lib/request-brain/types";

import {
  scheduleComposerQuestions,
  scheduledToFocusedQuestion,
  type FocusedQuestion,
  type ScheduleResult,
} from "./focused-questions";
import {
  computeComposerPublishReadiness,
  type PublishReadiness,
} from "./publish-readiness";
import type { FieldAnswerState } from "./question-scheduler";

export type ComposerV2FlowInput = {
  categoryId: string;
  needType?: string | null;
  candidates: QuestionCandidate[];
  values: Record<string, string | undefined>;
  fieldStates?: Record<string, FieldAnswerState | undefined>;
  answeredKeys?: string[];
  skippedKeys?: string[];
  requestText: string;
  isSyncing?: boolean;
  hasUsableText?: boolean;
  realEstateLocationComplete?: boolean;
  isRemoteService?: boolean;
  budgetValue?: string | null;
  cityValue?: string | null;
  locationMode?: string | null;
};

export type ComposerV2Flow = {
  schedule: ScheduleResult;
  visibleQuestions: FocusedQuestion[];
  readiness: PublishReadiness;
  canReview: boolean;
  remainingCriticalCount: number;
};

export function computeComposerV2Flow(
  input: ComposerV2FlowInput,
): ComposerV2Flow {
  const hasText =
    input.hasUsableText ?? Boolean(input.requestText.trim());

  const schedule = scheduleComposerQuestions({
    categoryId: input.categoryId || "technology",
    needType: input.needType,
    candidates: input.candidates,
    values: input.values,
    fieldStates: input.fieldStates,
    answeredKeys: input.answeredKeys,
    optionalSkippedKeys: input.skippedKeys,
    realEstateLocationComplete: input.realEstateLocationComplete,
    isRemoteService: input.isRemoteService,
  });

  const hybridByKey = new Map(
    input.candidates.map((c) => [c.fieldKey, c]),
  );
  const productType =
    input.values.productType ??
    input.values.applianceType ??
    null;
  const visibleQuestions = schedule.visible.map((q) =>
    scheduledToFocusedQuestion(q, hybridByKey.get(q.fieldKey), {
      productType,
      needType: input.needType,
      isRemoteService: input.isRemoteService,
      listingType: input.values.listingType ?? null,
    }),
  );

  const readiness = computeComposerPublishReadiness({
    hasUsableText: hasText && !input.isSyncing,
    schedule,
    realEstateLocationComplete: input.realEstateLocationComplete,
    categoryId: input.categoryId,
    budgetValue: input.budgetValue ?? input.values.budget,
    cityValue: input.cityValue ?? input.values.city,
    locationMode: input.locationMode ?? input.values.locationMode,
  });

  return {
    schedule,
    visibleQuestions,
    readiness,
    canReview: readiness.canReview,
    remainingCriticalCount: readiness.remainingCriticalCount,
  };
}

/** React memo wrapper — same authority as computeComposerV2Flow. */
export function useComposerV2Flow(input: ComposerV2FlowInput): ComposerV2Flow {
  return useMemo(
    () => computeComposerV2Flow(input),
    // Explicit deps — callers should pass stable primitives where possible
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [
      input.categoryId,
      input.needType,
      input.candidates,
      input.values,
      input.fieldStates,
      input.answeredKeys,
      input.skippedKeys,
      input.requestText,
      input.isSyncing,
      input.hasUsableText,
      input.realEstateLocationComplete,
      input.isRemoteService,
      input.budgetValue,
      input.cityValue,
      input.locationMode,
    ],
  );
}
