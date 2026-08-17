import { CompletedTransactionBadge } from "@/components/panel/CompletedTransactionBadge";
import {
  formatTrustRatingMeta,
  type TrustSummary,
} from "@/lib/offer/deal-review";

export function TrustSummaryBadge({ summary }: { summary: TrustSummary }) {
  const ratingMeta = formatTrustRatingMeta(summary);
  if (summary.completedTransactions < 1 && !ratingMeta) return null;

  return (
    <span className="inline-flex flex-wrap items-center gap-1.5">
      <CompletedTransactionBadge count={summary.completedTransactions} />
      {ratingMeta ? (
        <span className="inline-flex items-center rounded-md bg-[#f4f4f0] px-2 py-0.5 text-[11px] font-medium text-black/55 ring-1 ring-black/5">
          {ratingMeta}
        </span>
      ) : null}
    </span>
  );
}
