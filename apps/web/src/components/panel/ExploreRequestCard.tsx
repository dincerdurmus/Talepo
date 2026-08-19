import Link from "next/link";
import {
  ArrowRight,
  MapPin,
  MessageSquareText,
  Sparkles,
  Wallet,
  Zap,
} from "lucide-react";

import { CategoryVisualThumb } from "@/components/visuals/CategoryVisualThumb";
import {
  formatListingBudget,
  getCategoryVisual,
  listingSummary,
} from "@/lib/visuals/category-visuals";

type ExploreRequestCardProps = {
  href: string;
  title: string;
  categoryName: string;
  categorySlug?: string | null;
  city?: string | null;
  coverImageUrl?: string | null;
  summary?: string | null;
  description?: string | null;
  budgetMin?: number | { toString(): string } | null;
  budgetMax?: number | { toString(): string } | null;
  currency?: string | null;
  offerCount: number;
  timeLabel: string;
  isUrgent?: boolean;
  isFeatured?: boolean;
  isFresh?: boolean;
  matchReason?: string | null;
  /** Multiple match reasons from smart matching */
  matchReasons?: string[] | null;
  /** 0–100 match score from RequestMatch when available */
  matchScore?: number | null;
  emphasizeTime?: boolean;
};

export function ExploreRequestCard({
  href,
  title,
  categoryName,
  categorySlug,
  city,
  coverImageUrl,
  summary,
  description,
  budgetMin,
  budgetMax,
  currency,
  offerCount,
  timeLabel,
  isUrgent,
  isFeatured,
  isFresh,
  matchReason,
  matchReasons,
  matchScore,
  emphasizeTime,
}: ExploreRequestCardProps) {
  const look = getCategoryVisual(categorySlug);
  const blurb = listingSummary(summary, description);
  const budgetLabel = formatListingBudget(budgetMin, budgetMax, currency ?? "TRY");

  return (
    <Link
      href={href}
      className="group relative flex overflow-hidden rounded-[1.35rem] border border-[rgba(15,118,110,0.14)] bg-white"
    >
      <span className={`w-1 shrink-0 ${look.bar}`} aria-hidden />

      <div className="flex min-w-0 flex-1 flex-col gap-3 p-3.5 sm:flex-row sm:items-stretch sm:gap-4 sm:px-4 sm:py-3.5">
        <CategoryVisualThumb
          categorySlug={categorySlug}
          categoryName={categoryName}
          coverImageUrl={coverImageUrl}
          requestTitle={title}
          size="md"
          allowCategoryStockImage
          className="self-start"
        />

        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
            <h2 className="truncate text-[15px] font-semibold tracking-tight text-[#0f1f1d] sm:text-[16px]">
              {title}
            </h2>
            {isFresh ? (
              <span className="talepo-beacon-unread-chip">Yeni</span>
            ) : null}
            {isUrgent ? (
              <span className="inline-flex items-center gap-0.5 rounded-full bg-[#fff7ed] px-2 py-0.5 text-[10px] font-semibold text-[#c2410c]">
                <Zap className="h-3 w-3" />
                Acil
              </span>
            ) : null}
            {isFeatured ? (
              <span className="inline-flex items-center gap-0.5 rounded-full bg-teal-700/10 px-2 py-0.5 text-[10px] font-semibold text-teal-800">
                <Sparkles className="h-3 w-3" />
                Öne çıkan
              </span>
            ) : null}
          </div>

          {blurb ? (
            <p className="mt-1.5 line-clamp-2 text-[13px] leading-5 text-[#0f1f1d]/48">
              {blurb}
            </p>
          ) : null}

          <div className="mt-2 flex flex-wrap items-center gap-2 text-xs">
            <span
              className={`inline-flex items-center rounded-full px-2 py-0.5 text-[11px] font-semibold ${look.chip}`}
            >
              {categoryName}
            </span>
            {city ? (
              <span className="inline-flex items-center gap-1 font-medium text-[#0f1f1d]/48">
                <MapPin className="h-3 w-3 text-teal-700/70" />
                {city}
              </span>
            ) : null}
            {budgetLabel ? (
              <span className="inline-flex items-center gap-1 font-semibold text-[#0f1f1d]/70">
                <Wallet className="h-3 w-3 text-teal-700/70" />
                {budgetLabel}
              </span>
            ) : null}
            {typeof matchScore === "number" && matchScore > 0 ? (
              <span className="inline-flex items-center rounded-full bg-teal-800/10 px-2 py-0.5 text-[11px] font-semibold tabular-nums text-teal-900">
                Eşleşme %{Math.round(matchScore)}
              </span>
            ) : null}
            {matchReasons && matchReasons.length > 0
              ? matchReasons.slice(0, 3).map((reason) => (
                  <span
                    key={reason}
                    className="font-medium text-[#0f1f1d]/45"
                  >
                    {reason}
                  </span>
                ))
              : matchReason ? (
                  <span className="font-medium text-[#0f1f1d]/45">{matchReason}</span>
                ) : null}
          </div>

          <div className="mt-2.5 flex flex-wrap items-center gap-2 sm:hidden">
            <span className="inline-flex items-center gap-1 rounded-lg bg-white/85 px-2 py-1 text-[11px] font-semibold tabular-nums text-[#0f1f1d]">
              <MessageSquareText className="h-3 w-3" />
              {offerCount} teklif
            </span>
            <span
              className={`text-[11px] font-semibold ${
                emphasizeTime ? "text-teal-800" : "text-[#0f1f1d]/40"
              }`}
            >
              {timeLabel}
            </span>
          </div>
        </div>

        <div className="hidden shrink-0 flex-col items-end justify-between py-0.5 sm:flex">
          <p className="inline-flex items-center gap-1 rounded-xl bg-white/85 px-2.5 py-1 text-xs font-semibold tabular-nums text-[#0f1f1d]">
            <MessageSquareText className="h-3.5 w-3.5" />
            {offerCount} teklif
          </p>
          <p
            className={`text-[11px] font-semibold ${
              emphasizeTime ? "text-teal-800" : "text-[#0f1f1d]/40"
            }`}
          >
            {timeLabel}
          </p>
          <span className="talepo-beacon-spotlight-cta mt-auto">
            <ArrowRight className="h-4 w-4" strokeWidth={2.25} />
          </span>
        </div>
      </div>
    </Link>
  );
}
