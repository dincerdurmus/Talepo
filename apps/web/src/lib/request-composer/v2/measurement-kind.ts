import {
  getCategoryById,
  resolveCategoryQuestionContract,
  type MeasurementContract,
  type MeasurementKind,
} from "@/lib/request-category-engine";

export type { MeasurementKind } from "@/lib/request-category-engine";

export type MeasurementResolveInput = {
  categoryId: string;
  fieldKey: string;
  needType?: string | null;
  productType?: string | null;
};

const PRINT_FORMAT_KEYS = new Set(["printSize", "paperSize"]);
const MEASUREMENT_KEYS = new Set([
  "dimensions",
  "size",
  ...PRINT_FORMAT_KEYS,
]);

function fold(value: string | null | undefined): string {
  return (value ?? "")
    .toLocaleLowerCase("tr-TR")
    .replace(/[çğıöşü]/g, (char) =>
      ({ ç: "c", ğ: "g", ı: "i", ö: "o", ş: "s", ü: "u" })[char] ?? char,
    );
}

export type ResolvedMeasurementContract = Omit<MeasurementContract, "variants">;

function resolveDeclaredContract(
  contract: MeasurementContract,
  productType: string | null | undefined,
): ResolvedMeasurementContract {
  const product = fold(productType);
  const variant = contract.variants?.find((candidate) =>
    candidate.whenProductTypes.some((token) => product.includes(fold(token))),
  );
  if (!variant) {
    const { variants: _variants, ...base } = contract;
    return base;
  }
  return {
    kind: variant.kind,
    example: variant.example,
    unit: variant.unit,
    axes: variant.axes,
  };
}

/**
 * Returns null when the field is not a measurement field owned by this
 * contract. A physical measurement deliberately has no universal presets:
 * furniture, appliances and boxes need a free cm/mm value, not paper sizes.
 */
export function resolveMeasurementContract(
  input: MeasurementResolveInput,
): ResolvedMeasurementContract | null {
  const declared =
    resolveCategoryQuestionContract({
      categoryId: input.categoryId,
      productType: input.productType,
      needType: input.needType,
    })?.measurementContracts?.[input.fieldKey] ??
    getCategoryById(input.categoryId)?.measurementContracts?.[input.fieldKey];
  if (declared) return resolveDeclaredContract(declared, input.productType);

  if (!MEASUREMENT_KEYS.has(input.fieldKey)) return null;

  // Transitional compatibility for knowledge-only fields that have not yet
  // been migrated to category measurement contracts. It never assigns A-series
  // presets to a generic `size` field.
  if (PRINT_FORMAT_KEYS.has(input.fieldKey)) {
    return { kind: "print_format", example: "A4 veya 21 × 29,7 cm" };
  }

  // `size` is used by physical-label and product schemas, never as a generic
  // paper-format alias. This prevents the old A4/A5 leak for those schemas.
  if (input.fieldKey === "size") {
    return {
      kind: "physical_dimensions",
      axes: ["width", "height", "depth"],
      example: "Örn. 180 × 80 × 75 cm",
    };
  }

  if (input.categoryId !== "printing") {
    return {
      kind: "physical_dimensions",
      axes: ["width", "height", "depth"],
      example: "Örn. 180 × 80 × 75 cm",
    };
  }

  // Printing has one legacy aggregate key (`dimensions`). Boxes and labels
  // need real en/boy(/yükseklik); other print work keeps the established
  // A-series format affordance until its product contract is migrated.
  const product = fold(input.productType);
  if (
    product.includes("karton") ||
    product.includes("kutu") ||
    product.includes("etiket") ||
    product.includes("label")
  ) {
    return {
      kind: "physical_dimensions",
      axes: ["width", "height", "depth"],
      example: "Örn. 350 × 250 × 80 mm",
      unit: "mm",
    };
  }

  return { kind: "print_format", example: "A4 veya 21 × 29,7 cm" };
}

export function resolveMeasurementKind(
  input: MeasurementResolveInput,
): MeasurementKind | null {
  return resolveMeasurementContract(input)?.kind ?? null;
}
