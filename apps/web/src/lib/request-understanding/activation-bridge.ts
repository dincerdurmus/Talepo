import type { SummaryChip } from "@/lib/request-brain/request-summary";
import type { PriceStrategyKey } from "@/lib/price-intelligence/price-strategy-registry";
import type { PriceStrategyResolution } from "@/lib/price-intelligence/strategy-resolver";
import { computeStrategyCompleteness } from "@/lib/price-intelligence/strategy-completeness";

import {
  seedCatalogFactsIntoFields,
  toCanonicalCatalogFacts,
} from "@/lib/catalog/consumer";

import { stripRequestedItemClause } from "@/lib/request-composer/attribute-hints";
import { toLegacyFormHints, toStrategyContext } from "./adapters";
import type {
  RequestUnderstandingResult,
  UnderstandingValue,
} from "./types";

const HIGH_INFERENCE = 0.7;

function flattenValue(value: unknown): string {
  if (value == null) return "";
  if (typeof value === "object") {
    const obj = value as { value?: unknown; unit?: string };
    if (obj.value != null && obj.unit) return `${obj.value} ${obj.unit}`;
    if (obj.value != null) return String(obj.value);
    return JSON.stringify(value);
  }
  return String(value);
}

function isSafeToShow(v: UnderstandingValue<unknown> | undefined): boolean {
  if (!v) return false;
  if (v.provenance === "EXPLICIT") return true;
  return v.confidence >= HIGH_INFERENCE;
}

function isSafeForDraft(v: UnderstandingValue<unknown> | undefined): boolean {
  if (!v) return false;
  // Professional draft: explicit + structured only — never silent inferred brand/model
  return (
    v.provenance === "EXPLICIT" ||
    v.source === "STRUCTURED_FIELD" ||
    v.source === "USER_EXPLICIT" ||
    v.source === "NORMALIZED_EXPLICIT"
  );
}

/** Schema category for forms — never silently claim services for UNKNOWN. */
export function resolveSchemaCategory(result: RequestUnderstandingResult): {
  categoryId: string;
  confident: boolean;
  provisional: boolean;
  displayLabelSafe: boolean;
} {
  if (result.category.status === "CONFIDENT" && result.category.value) {
    return {
      categoryId: result.category.value,
      confident: true,
      provisional: false,
      displayLabelSafe: true,
    };
  }
  if (result.category.status === "TENTATIVE" && result.category.value) {
    return {
      categoryId: result.category.value,
      confident: false,
      provisional: true,
      displayLabelSafe: false,
    };
  }

  // UNKNOWN — prefer detector evidence, then intent heuristics
  const intent = result.intent.value;
  const detectorHint = result.category.evidence
    ?.map((e) => /^detector=(.+)$/.exec(e)?.[1])
    .find((id): id is string => Boolean(id));
  const altHint = result.category.alternatives?.[0]?.value;

  let provisionalId = "appliances";
  if (detectorHint) provisionalId = detectorHint;
  else if (altHint) provisionalId = altHint;
  else if (intent === "SERVICE") provisionalId = "services";
  else if (intent === "MANUFACTURE") provisionalId = "printing";
  else if (intent === "RENT" || intent === "SELL") provisionalId = "real-estate";
  else if (intent === "PART") provisionalId = "automotive";
  else if (result.subject.kind.value === "VEHICLE") provisionalId = "automotive";
  else if (result.subject.kind.value === "MACHINE") provisionalId = "machinery";

  return {
    categoryId: provisionalId,
    confident: false,
    provisional: true,
    displayLabelSafe: false,
  };
}

/** Seed form field values from canonical understanding (safe facts only). */
export function seedFieldValuesFromUnderstanding(
  result: RequestUnderstandingResult,
): Record<string, string> {
  const hints = toLegacyFormHints(result);
  const seeded: Record<string, string> = { ...hints.fieldValues };

  if (
    hints.brand &&
    isSafeToShow(result.identity.brand) &&
    !looksLikeYearToken(hints.brand)
  ) {
    seeded.brand = hints.brand;
    if (!seeded.brandPreference) seeded.brandPreference = hints.brand;
  } else {
    // Do not let year-as-brand leak into form/title composition
    if (seeded.brand && looksLikeYearToken(seeded.brand)) {
      delete seeded.brand;
      delete seeded.brandPreference;
    }
  }
  if (hints.model && isSafeToShow(result.identity.model)) {
    seeded.model = hints.model;
  }
  if (hints.needType) seeded.needType = hints.needType;
  if (hints.listingType) seeded.listingType = hints.listingType;

  const rs = result.requestSubject;
  if (rs?.displayPhrase?.value) {
    seeded.part = String(rs.displayPhrase.value);
  } else if (rs?.name?.value && (rs.kind.value === "PART" || rs.kind.value === "ACCESSORY")) {
    seeded.part = String(rs.name.value);
  }
  if (rs?.position?.value) {
    seeded.partPosition = String(rs.position.value);
  }

  if (result.condition && isSafeToShow(result.condition)) {
    seeded.condition =
      result.condition.value === "NEW"
        ? "Sıfır"
        : result.condition.value === "USED"
          ? "İkinci el"
          : seeded.condition ?? "";
  }

  if (result.quantity?.value?.value != null) {
    seeded.quantity = String(result.quantity.value.value);
  }

  // Preferences as soft display attrs (not fabricated numerics)
  if (result.preferences.mileagePreference?.value === "LOW") {
    if (!seeded.mileage) seeded.mileagePreference = "LOW";
  }
  if (result.preferences.tenantOccupied?.value === true) {
    seeded.tenantOccupied = "true";
  }

  return seedCatalogFactsIntoFields(result, seeded);
}

function looksLikeYearToken(value: string): boolean {
  return /^(19|20)\d{2}$/.test(value.trim());
}

function capitalizeTr(value: string): string {
  if (!value) return value;
  return value.charAt(0).toLocaleUpperCase("tr-TR") + value.slice(1);
}

function parentLabelFromSubject(result: RequestUnderstandingResult): string {
  const parent = result.requestSubject?.parentEntity;
  const brand =
    parent?.brand && isSafeToShow(parent.brand) && !looksLikeYearToken(String(parent.brand.value))
      ? String(parent.brand.value)
      : result.identity.brand &&
          isSafeToShow(result.identity.brand) &&
          !looksLikeYearToken(String(result.identity.brand.value))
        ? String(result.identity.brand.value)
        : null;
  const modelRaw =
    parent?.model && isSafeToShow(parent.model)
      ? String(parent.model.value)
      : result.identity.model && isSafeToShow(result.identity.model)
        ? String(result.identity.model.value)
        : null;
  const partName =
    result.requestSubject?.name?.value != null
      ? String(result.requestSubject.name.value)
      : result.requestSubject?.displayPhrase?.value != null
        ? String(result.requestSubject.displayPhrase.value)
        : null;
  const model = modelRaw
    ? stripRequestedItemClause(modelRaw, partName)
    : null;
  const series =
    parent?.series && isSafeToShow(parent.series)
      ? String(parent.series.value)
      : result.identity.series && isSafeToShow(result.identity.series)
        ? String(result.identity.series.value)
        : null;

  const tokens: string[] = [];
  for (const t of [brand, model, series]) {
    if (!t) continue;
    const prev = tokens[tokens.length - 1];
    if (prev && prev.toLocaleLowerCase("tr-TR") === t.toLocaleLowerCase("tr-TR")) {
      continue;
    }
    // Skip model token already embedded in brand
    if (
      brand &&
      t === model &&
      brand.toLocaleLowerCase("tr-TR").includes(t.toLocaleLowerCase("tr-TR")) &&
      brand.toLocaleLowerCase("tr-TR") !== t.toLocaleLowerCase("tr-TR")
    ) {
      // brand already contains model as substring end — still ok if we stripped parent
    }
    tokens.push(t);
  }
  return tokens.join(" ").replace(/\s+/g, " ").trim();
}

/**
 * Canonical semantic summary — composed from requestSubject, not brand+model concat.
 */
export function buildUnderstandingSummary(result: RequestUnderstandingResult): {
  headline: string;
  chips: SummaryChip[];
  subtypeLabel?: string | null;
} {
  const chips: SummaryChip[] = [];
  const seen = new Set<string>();
  const rs = result.requestSubject;

  const add = (fieldKey: string, label: string, displayValue: string) => {
    if (!displayValue.trim() || seen.has(fieldKey)) return;
    seen.add(fieldKey);
    chips.push({ fieldKey, label, displayValue });
  };

  const parentLabel = parentLabelFromSubject(result);
  const subjectPhrase =
    rs?.displayPhrase?.value ||
    rs?.name?.value ||
    null;
  const kind = rs?.kind.value;
  const kindOk =
    rs &&
    (rs.kind.status === "CONFIDENT" || rs.kind.status === "TENTATIVE") &&
    kind &&
    kind !== "UNKNOWN";

  // Chips from semantic structure — PART/ACCESSORY parent is compatibility target
  if (parentLabel && (kind === "PART" || kind === "ACCESSORY" || kind === "SERVICE")) {
    const brand = rs?.parentEntity?.brand?.value;
    const model = rs?.parentEntity?.model?.value;
    if (brand && !looksLikeYearToken(String(brand))) {
      add(
        "brand",
        kind === "SERVICE" ? "Marka" : "Uyumlu marka",
        String(brand),
      );
    }
    if (model) {
      add(
        "model",
        kind === "SERVICE" ? "Model" : "Uyumlu model",
        String(model),
      );
    }
  } else {
    if (result.identity.brand && isSafeToShow(result.identity.brand)) {
      const brand = String(result.identity.brand.value);
      if (!looksLikeYearToken(brand)) add("brand", "Marka", brand);
    }
    if (result.identity.model && isSafeToShow(result.identity.model)) {
      add("model", "Model", String(result.identity.model.value));
    }
  }

  if (subjectPhrase && (kind === "PART" || kind === "ACCESSORY")) {
    add("part", kind === "ACCESSORY" ? "Aksesuar" : "Parça", capitalizeTr(String(subjectPhrase)));
  }
  if (rs?.position?.value) {
    add("partPosition", "Konum", String(rs.position.value));
  }
  if (result.attributes.modelYear && isSafeToShow(result.attributes.modelYear)) {
    add("modelYear", "Model yılı", String(result.attributes.modelYear.value));
  }
  const catalogFacts = toCanonicalCatalogFacts(result);
  if (catalogFacts?.generation) {
    add("generation", "Nesil", catalogFacts.generation.label);
  }
  if (catalogFacts?.engine) {
    add("engine", "Motor", catalogFacts.engine.marketingName);
  }
  if (result.preferences.mileagePreference?.value === "LOW") {
    add("mileagePreference", "Kilometre", "Düşük km tercihi");
  }
  if (result.condition && isSafeToShow(result.condition)) {
    const cikmaPart = result.condition.evidence?.some((e) =>
      /cikma|çıkma/i.test(e),
    );
    add(
      "condition",
      kind === "PART" || kind === "ACCESSORY" ? "Parça durumu" : "Durum",
      result.condition.value === "NEW"
        ? "Sıfır"
        : cikmaPart
          ? "Çıkma"
          : result.condition.value === "USED"
            ? "İkinci el"
            : String(result.condition.value),
    );
  }
  if (result.quantity && isSafeToShow(result.quantity as UnderstandingValue<unknown>)) {
    const q = result.quantity.value;
    add(
      "quantity",
      "Miktar",
      `${q?.value ?? ""}${q?.unit ? ` ${q.unit}` : ""}`.trim(),
    );
  }
  if (result.attributes.roomCount && isSafeToShow(result.attributes.roomCount)) {
    add("roomCount", "Oda", String(result.attributes.roomCount.value));
  }
  if (result.attributes.area && isSafeToShow(result.attributes.area)) {
    add("area", "Alan", flattenValue(result.attributes.area.value));
  }
  if (result.attributes.weight && isSafeToShow(result.attributes.weight)) {
    add("weight", "Gramaj", flattenValue(result.attributes.weight.value));
  }
  if (result.location?.city && isSafeToShow(result.location.city)) {
    add("city", "Konum", String(result.location.city.value));
  }
  if (result.attributes.listingType && isSafeToShow(result.attributes.listingType)) {
    add("listingType", "İlan", String(result.attributes.listingType.value));
  }
  if (rs?.serviceType && isSafeToShow(rs.serviceType)) {
    add("serviceType", "Hizmet", String(rs.serviceType.value));
  }
  if (rs?.target && isSafeToShow(rs.target)) {
    add("serviceTarget", "Hedef", String(rs.target.value));
  }
  if (result.subject.productType && isSafeToShow(result.subject.productType)) {
    add("productType", "Ürün", String(result.subject.productType.value));
  }

  let headline = "Talebiniz";
  let subtypeLabel: string | null = null;

  if (kindOk && (kind === "PART" || kind === "ACCESSORY") && subjectPhrase) {
    const phrase = capitalizeTr(String(subjectPhrase));
    headline = parentLabel
      ? `${parentLabel} için ${String(subjectPhrase)}`
      : phrase;
    subtypeLabel = kind === "ACCESSORY" ? "Aksesuar" : "Yedek parça";
  } else if (kindOk && kind === "SERVICE") {
    const svc = rs.serviceType?.value ?? rs.name?.value ?? "hizmet";
    const target = rs.target?.value;
    const area = result.attributes.area
      ? flattenValue(result.attributes.area.value)
      : null;
    if (parentLabel && !target) {
      headline = `${parentLabel} için ${svc}`;
    } else if (target && area) {
      headline = `${area} ${target} için ${svc}`;
    } else if (target) {
      headline = `${target} için ${svc}`;
    } else if (area) {
      headline = `${area} ${svc}`;
    } else {
      headline = String(svc);
    }
    subtypeLabel = "Hizmet";
  } else if (kindOk && kind === "MANUFACTURED_ITEM") {
    const qty = result.quantity?.value?.value;
    const unit = result.quantity?.value?.unit ?? "adet";
    const name = rs.displayPhrase?.value ?? rs.name?.value ?? "üretim";
    const qtyLabel =
      qty != null
        ? new Intl.NumberFormat("tr-TR").format(qty) + (unit ? ` ${unit}` : "")
        : null;
    headline = [qtyLabel, name, "üretimi"].filter(Boolean).join(" ");
    subtypeLabel = "Üretim";
  } else if (kindOk && kind === "REAL_ESTATE") {
    const city = result.location?.city?.value;
    const rooms = result.attributes.roomCount?.value;
    const listing = result.attributes.listingType?.value;
    const listingTr =
      listing === "RENT" || listing === "kiralık"
        ? "kiralık"
        : listing === "SALE" || listing === "satılık"
          ? "satılık"
          : listing
            ? String(listing).toLocaleLowerCase("tr-TR")
            : null;
    const prop = rs.name?.value ?? "gayrimenkul";
    headline = [city ? `${city}'de` : null, rooms, listingTr, prop]
      .filter(Boolean)
      .join(" ");
    // Avoid "Başakşehir Başakşehir"
    headline = headline.replace(
      /\b([\wÇĞİÖŞÜçğıöşü]+)'de\s+\1\b/gi,
      "$1'de",
    );
    subtypeLabel = listingTr === "kiralık" ? "Kiralık" : listingTr === "satılık" ? "Satılık" : "Emlak";
  } else if (kindOk && kind === "VEHICLE") {
    // Only automotive VEHICLE may surface "Araç" — never cross-domain pollution
    const cat = result.category.value;
    if (cat && cat !== "automotive") {
      headline =
        (result.subject.productType && isSafeToShow(result.subject.productType)
          ? String(result.subject.productType.value)
          : null) ||
        parentLabel ||
        String(rs.name?.value ?? "Ürün");
      subtypeLabel =
        result.subject.productType && isSafeToShow(result.subject.productType)
          ? capitalizeTr(String(result.subject.productType.value))
          : "Ürün";
    } else {
      headline = parentLabel || String(rs.name?.value ?? "Araç");
      subtypeLabel = "Araç";
    }
  } else if (kindOk && kind === "INDUSTRIAL_EQUIPMENT") {
    headline = parentLabel || String(rs.name?.value ?? "Makine");
    subtypeLabel = "Makine";
  } else if (kindOk && kind === "PRODUCT") {
    const productType = result.subject.productType?.value;
    const capacity = result.attributes.capacity
      ? flattenValue(result.attributes.capacity.value)
      : result.attributes.storage
        ? flattenValue(result.attributes.storage.value)
        : null;
    const bits = [parentLabel, capacity, productType].filter(Boolean) as string[];
    // Dedupe adjacent
    const deduped: string[] = [];
    for (const b of bits) {
      const prev = deduped[deduped.length - 1];
      if (prev && prev.toLocaleLowerCase("tr-TR") === b.toLocaleLowerCase("tr-TR")) continue;
      if (prev && b.toLocaleLowerCase("tr-TR").includes(prev.toLocaleLowerCase("tr-TR"))) {
        deduped[deduped.length - 1] = b;
        continue;
      }
      deduped.push(b);
    }
    headline = deduped.join(" ") || String(rs.name?.value ?? "Ürün");
    subtypeLabel = productType
      ? capitalizeTr(String(productType))
      : "Ürün";
  } else {
    const brandForHeadline =
      result.identity.brand &&
      isSafeToShow(result.identity.brand) &&
      !looksLikeYearToken(String(result.identity.brand.value))
        ? String(result.identity.brand.value)
        : null;
    headline =
      (result.identity.model && isSafeToShow(result.identity.model)
        ? [brandForHeadline, String(result.identity.model.value)]
            .filter(Boolean)
            .join(" ")
        : null) ||
      (result.subject.productType && isSafeToShow(result.subject.productType)
        ? String(result.subject.productType.value)
        : null) ||
      "Talebiniz";
  }

  // Final generic adjacent-token dedupe safety
  headline = headline
    .split(/\s+/)
    .filter(Boolean)
    .reduce<string[]>((acc, tok) => {
      const prev = acc[acc.length - 1];
      if (prev && prev.toLocaleLowerCase("tr-TR") === tok.toLocaleLowerCase("tr-TR")) {
        return acc;
      }
      acc.push(tok);
      return acc;
    }, [])
    .join(" ");

  return { headline, chips: chips.slice(0, 8), subtypeLabel };
}

/** Attributes safe for professional draft — no low-confidence inventions. */
export function safeDraftAttributes(
  result: RequestUnderstandingResult,
  manualValues: Record<string, string>,
): Record<string, string | number | boolean> {
  const out: Record<string, string | number | boolean> = {};

  for (const [key, val] of Object.entries(result.attributes)) {
    if (!isSafeForDraft(val) && val.provenance !== "EXPLICIT") continue;
    if (val.provenance === "INFERRED" && !isSafeForDraft(val)) continue;
    // Prefer explicit + structured; skip weak product-identity brand dumps into draft
    if (
      key === "brand" &&
      result.identity.brand &&
      !isSafeToShow(result.identity.brand)
    ) {
      continue;
    }
    const flat = flattenValue(val.value);
    if (flat) out[key] = flat;
  }

  if (result.identity.model && isSafeToShow(result.identity.model)) {
    out.model = String(result.identity.model.value);
  }
  if (result.identity.brand && isSafeToShow(result.identity.brand)) {
    // Only if explicit or user wrote the brand — never year-as-brand
    const brand = String(result.identity.brand.value);
    if (
      result.identity.brand.provenance === "EXPLICIT" &&
      !looksLikeYearToken(brand)
    ) {
      out.brand = brand;
    }
  }
  if (result.condition && isSafeToShow(result.condition)) {
    out.condition =
      result.condition.value === "NEW" ? "Sıfır" : "İkinci el";
  }
  if (result.preferences.mileagePreference?.value === "LOW") {
    out.mileagePreference = "düşük km";
  }

  // Manual overrides always win
  for (const [k, v] of Object.entries(manualValues)) {
    if (v?.trim()) out[k] = v.trim();
  }

  return out;
}

export function strategyResolutionFromUnderstanding(
  result: RequestUnderstandingResult,
): PriceStrategyResolution {
  return {
    strategy: (result.strategy.value ?? "UNKNOWN") as PriceStrategyKey,
    strategyConfidence: result.strategy.confidence,
    strategyReasons: result.strategy.evidence ?? ["canonical-understanding"],
  };
}

export function completenessFromUnderstanding(
  result: RequestUnderstandingResult,
  extraFieldValues?: Record<string, string>,
) {
  const ctx = toStrategyContext(result);
  if (extraFieldValues) {
    for (const [k, v] of Object.entries(extraFieldValues)) {
      if (v?.trim() && !ctx.attributes[k]) ctx.attributes[k] = v.trim();
    }
  }
  return computeStrategyCompleteness({
    strategy: result.strategy.value ?? "UNKNOWN",
    attributes: ctx.attributes,
    brand: ctx.brand,
    model: ctx.model,
    semanticFields: ctx.semanticFields,
  });
}

export function budgetDisplayFromUnderstanding(
  result: RequestUnderstandingResult,
): string {
  if (!result.budget?.value) return "";
  const { min, max } = result.budget.value;
  const amount = max ?? min;
  if (amount == null) return "";
  return new Intl.NumberFormat("tr-TR").format(amount) + " TL";
}
