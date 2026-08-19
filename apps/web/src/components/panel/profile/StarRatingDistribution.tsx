import type { RatingDistribution } from "@/server/profile/self-profile-trust";

export function StarRatingDistribution({
  distribution,
  total,
}: {
  distribution: RatingDistribution;
  total: number;
}) {
  if (total <= 0) {
    return (
      <p className="text-sm text-black/45">Henüz görünür değerlendirme yok.</p>
    );
  }

  return (
    <ul className="space-y-2">
      {([5, 4, 3, 2, 1] as const).map((stars) => {
        const count = distribution[stars];
        const width = total > 0 ? Math.round((count / total) * 100) : 0;
        return (
          <li key={stars} className="flex items-center gap-3">
            <span
              className="w-8 shrink-0 text-xs font-semibold tabular-nums text-black/55"
              aria-hidden
            >
              {stars}★
            </span>
            <div
              className="h-2 min-w-0 flex-1 overflow-hidden rounded-full bg-[#eef0ee]"
              role="presentation"
            >
              <div
                className="h-full rounded-full bg-amber-400/85"
                style={{ width: `${width}%` }}
              />
            </div>
            <span className="w-8 shrink-0 text-right text-xs tabular-nums text-black/45">
              {count}
            </span>
            <span className="sr-only">
              {stars} yıldız: {count} değerlendirme
            </span>
          </li>
        );
      })}
    </ul>
  );
}
