import { resolvePreviewCategorySync, mergePreviewCategoryWithDbId } from "@/lib/price-intelligence/resolve-preview-category";
import { prisma } from "@/lib/prisma";
import { sanitizePreviewIntelligence } from "@/lib/price-intelligence/preview-sanitize";
import { understandRequest } from "@/lib/request-understanding/understand-request";
import { toLegacyFormHints } from "@/lib/request-understanding/adapters";
import { toPriceCanonicalHints } from "@/lib/request-understanding/consumer-adapters";
import type { RequestUnderstandingResult } from "@/lib/request-understanding/types";
import { getPriceIntelligence } from "@/server/price-intelligence/price-intelligence-engine";
import { normalizeProductFromRequest } from "@/server/price-intelligence/normalize-product";
import { parseBudgetValue } from "@/server/price-intelligence/weighted-market-reference";

export type DraftPreviewInput = {
  categorySlug?: string | null;
  title: string;
  fieldValues: { key: string; value: string | null }[];
  budget?: number | string | null;
  city?: string | null;
  district?: string | null;
  includeExternal?: boolean;
  windowDays?: number;
  /** Canonical brain activation — preferred over client categorySlug */
  rawInput?: string | null;
  structuredOverrides?: {
    categoryId?: string | null;
    city?: string | null;
    district?: string | null;
    fieldValues?: Record<string, string | null | undefined>;
  };
};

export { sanitizePreviewIntelligence };

function normalizeFieldValues(
  fieldValues: DraftPreviewInput["fieldValues"],
  budget?: number | string | null,
): { key: string; value: string | null }[] {
  const map = new Map<string, string | null>();
  for (const fv of fieldValues) {
    if (fv.key) map.set(fv.key, fv.value);
  }
  if (budget != null && budget !== "") {
    const budgetStr =
      typeof budget === "number" ? String(budget) : String(budget).trim();
    if (budgetStr) map.set("budget", budgetStr);
  }
  return Array.from(map.entries()).map(([key, value]) => ({ key, value }));
}

function extractLocation(
  fieldValues: { key: string; value: string | null }[],
  city?: string | null,
  district?: string | null,
) {
  const cityFromFields = fieldValues.find((f) => f.key === "city")?.value;
  return {
    city: city?.trim() || cityFromFields?.trim() || null,
    district: district?.trim() || null,
  };
}

function mergeCanonicalFields(
  understanding: RequestUnderstandingResult,
  clientFields: { key: string; value: string | null }[],
): { key: string; value: string | null }[] {
  const hints = toLegacyFormHints(understanding);
  const map = new Map<string, string | null>();

  for (const [k, v] of Object.entries(hints.fieldValues)) {
    if (v?.trim()) map.set(k, v);
  }
  if (hints.brand) map.set("brand", hints.brand);
  if (hints.model) map.set("model", hints.model);
  if (hints.needType) map.set("needType", hints.needType);
  if (hints.condition) {
    map.set(
      "condition",
      hints.condition === "NEW"
        ? "Sıfır"
        : hints.condition === "USED"
          ? "İkinci el"
          : hints.condition,
    );
  }
  if (hints.quantity != null) map.set("quantity", String(hints.quantity));

  // Client structured overrides win
  for (const fv of clientFields) {
    if (fv.key && fv.value?.trim()) map.set(fv.key, fv.value);
  }

  return Array.from(map.entries()).map(([key, value]) => ({ key, value }));
}

export async function runPriceIntelligencePreview(
  input: DraftPreviewInput,
): Promise<
  ReturnType<typeof sanitizePreviewIntelligence> & {
    understandingStrategy?: string | null;
    understandingCategory?: string | null;
    priceAnalysisReadiness?: string;
    priceInternalStrategy?: string | null;
    canonicalUnderstandingVersion?: string;
  }
> {
  const fieldValuesFromClient = normalizeFieldValues(input.fieldValues, input.budget);
  const structuredFromClient: Record<string, string | null | undefined> = {
    ...(input.structuredOverrides?.fieldValues ?? {}),
  };
  for (const fv of fieldValuesFromClient) {
    if (fv.value?.trim()) structuredFromClient[fv.key] = fv.value;
  }

  const rawForBrain =
    input.rawInput?.trim() ||
    input.title.trim();

  const understanding = understandRequest({
    rawInput: rawForBrain,
    structured: {
      categoryId:
        input.structuredOverrides?.categoryId?.trim() || null,
      city: input.structuredOverrides?.city ?? input.city,
      district: input.structuredOverrides?.district ?? input.district,
      fieldValues: structuredFromClient,
    },
  });

  const lockedCategory =
    input.structuredOverrides?.categoryId?.trim() || null;

  // Authoritative category from brain — never trust weak client services slug alone
  const canonicalCategory =
    understanding.category.status === "CONFIDENT" &&
    understanding.category.value
      ? understanding.category.value
      : understanding.category.status === "TENTATIVE" &&
          understanding.category.value
        ? understanding.category.value
        : lockedCategory ||
          (understanding.intent.value === "SERVICE"
            ? "services"
            : understanding.intent.value === "MANUFACTURE"
              ? "printing"
              : understanding.intent.value === "RENT" ||
                  understanding.intent.value === "SELL"
                ? "real-estate"
                : understanding.subject.kind.value === "VEHICLE" ||
                    understanding.intent.value === "PART"
                  ? "automotive"
                  : null);

  // Client slug is a hint only when canonical has no category
  const effectiveSlug =
    canonicalCategory ||
    input.categorySlug?.trim() ||
    "appliances";

  const syncResolved = resolvePreviewCategorySync(effectiveSlug);
  let resolved = syncResolved;

  try {
    const dbCategory = await prisma.category.findUnique({
      where: { slug: syncResolved.categorySlug },
      select: { id: true },
    });
    resolved = mergePreviewCategoryWithDbId(syncResolved, dbCategory?.id);
  } catch {
    // DB unavailable — continue with synthetic preview id
  }

  const fieldValues = mergeCanonicalFields(
    understanding,
    fieldValuesFromClient,
  );
  const { city, district } = extractLocation(
    fieldValues,
    input.structuredOverrides?.city ?? input.city,
    input.structuredOverrides?.district ?? input.district,
  );
  const title = input.title.trim();

  // Inject canonical strategy-critical needType into field values for engine
  if (
    understanding.strategy.value &&
    !fieldValues.some((f) => f.key === "needType" && f.value)
  ) {
    const hints = toLegacyFormHints(understanding);
    if (hints.needType) {
      fieldValues.push({ key: "needType", value: hints.needType });
    }
  }

  const normalizedProduct = normalizeProductFromRequest({
    categoryId: resolved.categoryId,
    categorySlug: resolved.categorySlug,
    title,
    fieldValues,
    city,
    district,
  });

  const userBudget =
    typeof input.budget === "number"
      ? input.budget
      : parseBudgetValue(
          input.budget != null
            ? String(input.budget)
            : fieldValues.find((f) => f.key === "budget")?.value,
        );

  const readiness = understanding.priceAnalysisReadiness.status;
  const includeExternal =
    (input.includeExternal ?? true) &&
    Boolean(title) &&
    readiness !== "NOT_READY";

  const priceHints = toPriceCanonicalHints(understanding);

  const result = await getPriceIntelligence({
    categoryId: resolved.categoryId,
    categorySlug: resolved.categorySlug,
    title,
    fieldValues,
    city,
    district,
    normalizedProduct,
    productFingerprint: normalizedProduct.fingerprint,
    includeExternal,
    userBudget,
    windowDays: input.windowDays,
    canonicalStrategy: priceHints.strategy,
  });

  const sanitized = sanitizePreviewIntelligence(result);

  return {
    ...sanitized,
    strategy: priceHints.strategy,
    understandingStrategy: understanding.strategy.value,
    understandingCategory: understanding.category.value,
    priceAnalysisReadiness: readiness,
    priceInternalStrategy: result.strategy?.strategy ?? null,
    canonicalUnderstandingVersion: understanding.version,
  };
}
