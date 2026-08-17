/**
 * Bilateral deal completion — accepted ≠ completed.
 * Trust counts only BOTH_CONFIRMED rows with completedAt.
 */

export const BILATERAL_COMPLETED_WHERE = {
  status: "COMPLETED" as const,
  confirmationLevel: "BOTH_CONFIRMED" as const,
  completedAt: { not: null },
  buyerConfirmedAt: { not: null },
  supplierConfirmedAt: { not: null },
};

export const DEAL_COMPLETION_NOT_ELIGIBLE_MESSAGE =
  "Yalnız kabul edilmiş bir teklif için işlem tamamlandı onayı verilebilir.";

export const DEAL_COMPLETION_FORBIDDEN_MESSAGE =
  "Bu işlem için onay veremezsiniz.";

export const DEAL_COMPLETION_ALREADY_DONE_MESSAGE =
  "Bu işlem zaten taraflarca tamamlandı olarak onaylandı.";

export function isBilateralDealCompleted(deal: {
  status: string;
  confirmationLevel: string;
  completedAt?: Date | string | null;
  buyerConfirmedAt?: Date | string | null;
  supplierConfirmedAt?: Date | string | null;
}): boolean {
  return (
    deal.status === "COMPLETED" &&
    deal.confirmationLevel === "BOTH_CONFIRMED" &&
    Boolean(deal.completedAt) &&
    Boolean(deal.buyerConfirmedAt) &&
    Boolean(deal.supplierConfirmedAt)
  );
}

export function formatCompletedTransactionCount(count: number) {
  return `${count} tamamlanan işlem`;
}

export function formatCompletedPurchaseCount(count: number) {
  return `${count} tamamlanan alım`;
}
