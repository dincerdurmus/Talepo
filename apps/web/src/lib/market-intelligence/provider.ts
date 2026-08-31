/**
 * Admin read-model sözleşmesi — `getMarketIntelligence` sınırı (2026-08-31).
 *
 * Admin paneli veri SAKLAMAZ ve hangi sağlayıcının arkada olduğunu BİLMEZ;
 * yalnız bu arayüzden okur. Gerçek veri gelene kadar tek dürüst cevap
 * NOT_MEASURED'dır — boş dashboard sıfırlarla DOLDURULMAZ
 * (measurement-honesty: ölçülmeyen, ölçülmüş sıfır değildir).
 */
import type { MarketEventName } from "./contract";
import type { ProvinceCode } from "@/lib/observability/province-allowlist";

export type MarketPeriod = { fromIso: string; toIso: string };

export type MarketFilters = {
  categoryId?: string;
  provinceCode?: ProvinceCode;
};

export type MeasuredCount =
  | { status: "MEASURED"; value: number; denominator: string }
  | { status: "NOT_MEASURED"; reason: string };

export type MarketIntelligenceReadModel = {
  source: "EXTERNAL" | "TALEPO" | "NOT_MEASURED";
  metrics: Record<MarketEventName, MeasuredCount>;
  funnel: Array<{ step: MarketEventName; count: MeasuredCount }>;
  trends: Array<{
    month: string;
    categoryId: string;
    counts: Partial<Record<MarketEventName, number>>;
  }>;
};

export type MarketIntelligenceProvider = {
  name: string;
  getMarketIntelligence(
    period: MarketPeriod,
    filters?: MarketFilters,
  ): Promise<MarketIntelligenceReadModel>;
};

const NOT_MEASURED = (reason: string): MeasuredCount => ({
  status: "NOT_MEASURED",
  reason,
});

/** Varsayılan sağlayıcı: veri yokken yüzey "veri yok" der, asla doldurmaz. */
export function createNotMeasuredProvider(
  reason = "warehouse-provision-bekleniyor (DW-3) + sink doğrulaması (DW-1)",
): MarketIntelligenceProvider {
  const metrics: MarketIntelligenceReadModel["metrics"] = {
    request_published: NOT_MEASURED(reason),
    offer_submitted: NOT_MEASURED(reason),
    offer_accepted: NOT_MEASURED(reason),
    deal_completed: NOT_MEASURED(reason),
  };
  return {
    name: "not-measured",
    async getMarketIntelligence() {
      return {
        source: "NOT_MEASURED",
        metrics,
        funnel: (Object.keys(metrics) as MarketEventName[]).map((step) => ({
          step,
          count: metrics[step],
        })),
        trends: [],
      };
    },
  };
}
