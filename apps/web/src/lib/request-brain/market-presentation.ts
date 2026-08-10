import {
  confidenceLevelLabelTr,
  formatTryAmount,
} from "@/lib/request-brain/local-intelligence";
import type { MarketIntelligenceSnapshot } from "@/lib/request-brain/types";
import type { BudgetEvaluation } from "@/lib/price-intelligence/types";

export type MarketPresentationState =
  | "LOADING"
  | "ENOUGH"
  | "LIMITED"
  | "INSUFFICIENT"
  | "ERROR"
  | "HIDDEN";

export type MarketPresentation = {
  state: MarketPresentationState;
  headline: string;
  rangeText: string | null;
  medianText: string | null;
  confidenceLabel: string | null;
  explanation: string;
  sourceSemantics: string;
  budgetMessage: string | null;
  breakdown: { label: string; count: number }[];
};

function sourceSemanticsFromCounts(counts: MarketIntelligenceSnapshot["sourceCounts"]): string {
  const parts: string[] = [];
  if (counts.confirmedTransactions > 0) parts.push("confirmed");
  if (counts.acceptedOffers > 0) parts.push("accepted");
  if (counts.talepoOffers > 0) parts.push("offers");
  if (counts.externalListings > 0) parts.push("listings");

  if (parts.length === 0) return "Birden fazla piyasa sinyaline göre";
  if (parts.length > 1) return "Birden fazla piyasa sinyaline göre";
  if (parts[0] === "listings") return "Piyasadaki ilan fiyatlarına göre";
  if (parts[0] === "offers") return "Benzer taleplere verilen tekliflere göre";
  if (parts[0] === "accepted") return "Kabul edilen tekliflere göre";
  if (parts[0] === "confirmed") return "Gerçekleşen işlemlere göre";
  return "Birden fazla piyasa sinyaline göre";
}

function budgetMessage(
  evaluation: BudgetEvaluation | null | undefined,
  reliable: boolean,
): string | null {
  if (!reliable || !evaluation || evaluation.status === "UNKNOWN") return null;
  if (evaluation.status === "BELOW_MARKET") {
    return "Bütçeniz piyasa aralığının biraz altında görünüyor.";
  }
  if (evaluation.status === "ABOVE_MARKET") {
    return "Bütçeniz benzer piyasa sinyallerinin üzerinde görünüyor.";
  }
  if (evaluation.status === "WITHIN_MARKET") {
    return "Bütçeniz piyasa aralığıyla uyumlu görünüyor.";
  }
  return null;
}

export function buildMarketPresentation(input: {
  analysisStatus: string;
  market: MarketIntelligenceSnapshot | null;
  previewError: string | null;
}): MarketPresentation {
  const { analysisStatus, market, previewError } = input;

  if (
    analysisStatus !== "PRICE_ANALYZING" &&
    analysisStatus !== "PRICE_READY" &&
    analysisStatus !== "PRICE_INSUFFICIENT" &&
    analysisStatus !== "PRICE_ERROR" &&
    analysisStatus !== "READY_FOR_REVIEW" &&
    analysisStatus !== "PUBLISHING" &&
    analysisStatus !== "PUBLISHED"
  ) {
    return {
      state: "HIDDEN",
      headline: "Piyasa görünümü",
      rangeText: null,
      medianText: null,
      confidenceLabel: null,
      explanation: "",
      sourceSemantics: "",
      budgetMessage: null,
      breakdown: [],
    };
  }

  if (analysisStatus === "PRICE_ANALYZING") {
    return {
      state: "LOADING",
      headline: "Piyasa görünümü",
      rangeText: null,
      medianText: null,
      confidenceLabel: null,
      explanation: "Piyasa verisi kontrol ediliyor…",
      sourceSemantics: "",
      budgetMessage: null,
      breakdown: [],
    };
  }

  if (analysisStatus === "PRICE_ERROR") {
    return {
      state: "ERROR",
      headline: "Piyasa görünümü",
      rangeText: null,
      medianText: null,
      confidenceLabel: null,
      explanation:
        previewError ??
        "Piyasa analizi şu anda kullanılamıyor. Talebinizi yayınlamaya devam edebilirsiniz.",
      sourceSemantics: "",
      budgetMessage: null,
      breakdown: [],
    };
  }

  const level = market?.overallConfidence?.level ?? "NONE";
  const hasRange = Boolean(market?.marketRange);
  const reliable =
    hasRange && level !== "NONE" && level !== "VERY_LOW";
  const limited =
    hasRange && (level === "LOW" || level === "VERY_LOW" || market?.insufficientData);

  const breakdown = market
    ? [
        {
          label: "Piyasa ilanları",
          count: market.sourceCounts.externalListings,
        },
        {
          label: "Talepo teklifleri",
          count: market.sourceCounts.talepoOffers,
        },
        {
          label: "Kabul edilen teklifler",
          count: market.sourceCounts.acceptedOffers,
        },
        {
          label: "Gerçekleşen işlemler",
          count: market.sourceCounts.confirmedTransactions,
        },
      ].filter((row) => row.count > 0)
    : [];

  if (reliable && !limited && market?.marketRange) {
    return {
      state: "ENOUGH",
      headline: "Piyasa görünümü",
      rangeText: `${formatTryAmount(market.marketRange.low)} — ${formatTryAmount(market.marketRange.high)}`,
      medianText: formatTryAmount(market.marketRange.median),
      confidenceLabel: confidenceLevelLabelTr(level),
      explanation: "Benzer ürünlerde güncel fiyat aralığı",
      sourceSemantics: sourceSemanticsFromCounts(market.sourceCounts),
      budgetMessage: budgetMessage(market.budgetEvaluation, true),
      breakdown,
    };
  }

  if ((limited || level === "LOW") && market?.marketRange) {
    return {
      state: "LIMITED",
      headline: "Piyasa görünümü",
      rangeText: `${formatTryAmount(market.marketRange.low)} — ${formatTryAmount(market.marketRange.high)}`,
      medianText: formatTryAmount(market.marketRange.median),
      confidenceLabel: confidenceLevelLabelTr(level),
      explanation:
        "Bu aralık sınırlı sayıdaki güncel piyasa sinyaline dayanıyor.",
      sourceSemantics: sourceSemanticsFromCounts(market.sourceCounts),
      budgetMessage: budgetMessage(market.budgetEvaluation, false),
      breakdown,
    };
  }

  return {
    state: "INSUFFICIENT",
    headline: "Piyasa görünümü",
    rangeText: null,
    medianText: null,
    confidenceLabel: null,
    explanation:
      "Henüz yeterli piyasa verisi yok. Bu talep için güvenilir bir fiyat aralığı oluşturacak kadar doğrulanmış veri bulunmuyor.",
    sourceSemantics: "",
    budgetMessage: null,
    breakdown,
  };
}
