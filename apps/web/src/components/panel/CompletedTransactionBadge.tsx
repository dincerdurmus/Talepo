import { formatCompletedTransactionCount } from "@/lib/offer/deal-completion";

export function CompletedTransactionBadge({ count }: { count: number }) {
  if (count < 1) return null;
  return (
    <span className="inline-flex items-center rounded-md bg-teal-50 px-2 py-0.5 text-[11px] font-medium text-teal-900/75 ring-1 ring-teal-900/8">
      {formatCompletedTransactionCount(count)}
    </span>
  );
}
