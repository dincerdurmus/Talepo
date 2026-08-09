import type { ParsedRequest, PriceEstimate } from "../types";

export function estimatePrice(request: ParsedRequest): PriceEstimate {
  const quantity = request.quantity ?? 1;

  const categoryRates: Record<string, [number, number]> = {
    printing: [7, 12],
    automotive: [4500, 18000],
    machinery: [120000, 450000],
    furniture: [2500, 9000],
    technology: [15000, 90000],
    services: [5000, 25000],
    "real-estate": [8000, 45000],
  };

  const [minRate, maxRate] =
    categoryRates[request.categoryId] ?? categoryRates.services;

  const multiplier =
    request.categoryId === "printing" ? quantity : Math.max(quantity, 1);

  return {
    min: Math.round(minRate * multiplier),
    max: Math.round(maxRate * multiplier),
    currency: "TRY",
    confidence: 45,
    explanation:
      "Bu aşamadaki hesaplama örnek kategori katsayılarına dayanır. Gerçek Talepo verileri geldikçe model güncellenecektir.",
  };
}
