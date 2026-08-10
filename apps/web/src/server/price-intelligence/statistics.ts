import type { PriceStatistics } from "@/lib/price-intelligence/types";

const MIN_AGGREGATE_SAMPLE = 5;

function percentile(sorted: number[], p: number): number | null {
  if (sorted.length === 0) return null;
  const idx = (sorted.length - 1) * p;
  const lower = Math.floor(idx);
  const upper = Math.ceil(idx);
  if (lower === upper) return sorted[lower] ?? null;
  const a = sorted[lower] ?? 0;
  const b = sorted[upper] ?? 0;
  return a + (b - a) * (idx - lower);
}

/** Robust stats — light outlier trim when sample >= 8 */
export function computePriceStatistics(
  values: number[],
  minSample = MIN_AGGREGATE_SAMPLE,
): PriceStatistics {
  const rawSampleSize = values.length;
  if (rawSampleSize === 0) {
    return {
      sampleSize: 0,
      rawSampleSize: 0,
      median: null,
      p25: null,
      p75: null,
      min: null,
      max: null,
      insufficientData: true,
    };
  }

  let usable = [...values].sort((a, b) => a - b);

  if (usable.length >= 8) {
    const q1 = percentile(usable, 0.25) ?? usable[0]!;
    const q3 = percentile(usable, 0.75) ?? usable[usable.length - 1]!;
    const iqr = q3 - q1;
    const low = q1 - 1.5 * iqr;
    const high = q3 + 1.5 * iqr;
    const trimmed = usable.filter((v) => v >= low && v <= high);
    if (trimmed.length >= minSample) usable = trimmed;
  }

  const sampleSize = usable.length;
  const insufficientData = sampleSize < minSample;

  return {
    sampleSize,
    rawSampleSize,
    median: percentile(usable, 0.5),
    p25: percentile(usable, 0.25),
    p75: percentile(usable, 0.75),
    min: usable[0] ?? null,
    max: usable[usable.length - 1] ?? null,
    insufficientData,
  };
}

export { MIN_AGGREGATE_SAMPLE };
