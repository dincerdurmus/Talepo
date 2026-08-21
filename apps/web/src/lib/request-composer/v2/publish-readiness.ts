/**
 * Composer publish readiness — gates review CTA and hard publish.
 */

import type { ScheduleResult } from "./question-profile-types";
import {
  isBudgetSatisfiedForPublish,
  isLocationSatisfiedForPublish,
} from "./global-core-profile";

export type PublishReadiness = {
  canReview: boolean;
  canPublish: boolean;
  blockingLabels: string[];
  remainingCriticalCount: number;
  primaryCta: "continue" | "review" | "publish";
  primaryCtaLabel: string;
};

export function computeComposerPublishReadiness(input: {
  hasUsableText: boolean;
  schedule: ScheduleResult;
  realEstateLocationComplete?: boolean;
  categoryId?: string | null;
  budgetValue?: string | null;
  cityValue?: string | null;
  locationMode?: string | null;
}): PublishReadiness {
  const blocking = [...input.schedule.blockingLabels];

  const budgetOk = isBudgetSatisfiedForPublish(input.budgetValue);
  const locationOk = isLocationSatisfiedForPublish({
    cityValue: input.cityValue,
    locationMode: input.locationMode,
    realEstateComplete: input.realEstateLocationComplete,
    categoryId: input.categoryId,
  });

  if (!budgetOk && !blocking.some((l) => /bütçe/i.test(l))) {
    blocking.push("Bütçe");
  }
  if (!locationOk) {
    if (input.categoryId === "real-estate") {
      if (!blocking.some((l) => /il|konum/i.test(l))) blocking.push("İl ve ilçe");
    } else if (!blocking.some((l) => /konum|teslimat|il/i.test(l))) {
      blocking.push("Konum");
    }
  }

  const canReview =
    input.hasUsableText &&
    input.schedule.canEnterReview &&
    budgetOk &&
    locationOk;

  const canPublish = canReview;
  const remainingCriticalCount = Math.max(
    input.schedule.remainingCriticalCount,
    budgetOk ? 0 : 1,
    locationOk ? 0 : 1,
  );

  let primaryCta: PublishReadiness["primaryCta"] = "continue";
  let primaryCtaLabel = "Devam et";
  if (canReview) {
    primaryCta = "review";
    primaryCtaLabel = "Talebi gözden geçir";
  } else if (remainingCriticalCount > 0) {
    primaryCtaLabel =
      remainingCriticalCount === 1
        ? "1 kritik soru kaldı — devam et"
        : `${Math.min(remainingCriticalCount, 9)} kritik soru kaldı — devam et`;
  }

  return {
    canReview,
    canPublish,
    blockingLabels: blocking,
    remainingCriticalCount,
    primaryCta,
    primaryCtaLabel,
  };
}
