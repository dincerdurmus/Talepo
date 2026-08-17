/**
 * Submitted-offer commercial lock — amount and deliveryDays are binding
 * after the first SUBMITTED write. Text fields may still be revised.
 */

export const OFFER_AMOUNT_IMMUTABLE_MESSAGE =
  "Teklif gönderildikten sonra fiyat değiştirilemez.";

export const OFFER_DELIVERY_IMMUTABLE_MESSAGE =
  "Teklif gönderildikten sonra teslim süresi değiştirilemez.";

export const OFFER_NO_LONGER_EDITABLE_MESSAGE =
  "Teklif bulunamadı veya artık güncellenemez.";

export const AWAITING_OFFER_REVISION_STATUSES = [
  "SUBMITTED",
  "VIEWED",
] as const;

export type AwaitingOfferRevisionStatus =
  (typeof AWAITING_OFFER_REVISION_STATUSES)[number];

export function isAwaitingOfferRevisionStatus(
  status: string,
): status is AwaitingOfferRevisionStatus {
  return status === "SUBMITTED" || status === "VIEWED";
}

export function moneyAmountCents(value: number | string): number {
  return Math.round(Number(value) * 100);
}

export function amountsDiffer(
  current: number | string,
  next: number,
): boolean {
  if (!Number.isFinite(next)) return true;
  return moneyAmountCents(current) !== moneyAmountCents(next);
}

export function deliveryDaysDiffer(
  current: number | null,
  next: number | null,
): boolean {
  return (current ?? null) !== (next ?? null);
}

export function collectSubmittedCommercialLockIssues(input: {
  currentAmount: number | string;
  currentDeliveryDays: number | null;
  nextAmount?: number;
  nextDeliveryDays?: number | null;
  amountProvided: boolean;
  deliveryDaysProvided: boolean;
}): string[] {
  const issues: string[] = [];

  if (input.amountProvided) {
    const next = input.nextAmount;
    if (
      next === undefined ||
      amountsDiffer(input.currentAmount, next)
    ) {
      issues.push(OFFER_AMOUNT_IMMUTABLE_MESSAGE);
    }
  }

  if (input.deliveryDaysProvided) {
    const next = input.nextDeliveryDays;
    if (next !== null && next !== undefined && !Number.isFinite(next)) {
      issues.push(OFFER_DELIVERY_IMMUTABLE_MESSAGE);
    } else if (
      deliveryDaysDiffer(
        input.currentDeliveryDays,
        next === undefined ? null : next,
      )
    ) {
      issues.push(OFFER_DELIVERY_IMMUTABLE_MESSAGE);
    }
  }

  return issues;
}
