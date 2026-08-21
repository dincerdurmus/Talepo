/**
 * Build CanonicalRequestState from understandRequest() + optional browse bag.
 * Does not re-parse intent/category — maps RU output into hybrid field semantics.
 */

import {
  seedFieldValuesFromUnderstanding,
  resolveSchemaCategory,
} from "@/lib/request-understanding/activation-bridge";
import type { RequestUnderstandingResult } from "@/lib/request-understanding/types";
import {
  findTaxonomyTypeUnderSubcategory,
  getTaxonomyNode,
} from "@/lib/taxonomy";

import type { ConstraintBundle } from "@/lib/request-understanding/constraint-semantics";

import {
  applyAnyBindingsToFields,
  extractFieldScopedAny,
} from "./any-language";
import {
  cleanBrandToken,
  cleanModelToken,
  extractProductTypeHint,
  extractResolution,
  extractScreenSize,
} from "./attribute-hints";
import { isKnownAutomotiveModelName } from "@/lib/ai/parser/brand-catalog";
import { stripIncompatibleDomainFields } from "./request-transition";
import { sanitizeFactRoles } from "./v2/entity-roles";
import type {
  CanonicalFieldState,
  CanonicalRequestState,
  FieldProvenance,
  LastUserAction,
} from "./types";
import { FIELD_SENTINEL, isAnySentinel, isNotApplicableSentinel } from "./types";

/**
 * Map Phase 2 constraint bundle onto hybrid fields.
 * Does not re-parse text — consumes Single Brain constraints only.
 */
export function applyConstraintBundleToFields(
  fields: Record<string, CanonicalFieldState>,
  bundle: ConstraintBundle | undefined | null,
): Record<string, CanonicalFieldState> {
  if (!bundle) return fields;
  const next = { ...fields };

  for (const c of Object.values(bundle.byField)) {
    const existing = next[c.fieldKey];
    // Never overwrite EXPLICIT_BROWSE with text constraints
    if (existing?.provenance === "EXPLICIT_BROWSE") {
      next[c.fieldKey] = {
        ...existing,
        excludedValues: uniqueStrings([
          ...(existing.excludedValues ?? []),
          ...(c.excludedValues ?? []),
        ]),
        preferredValues: existing.preferredValues ?? c.preferredValues,
        allowedValues: existing.allowedValues ?? c.allowedValues,
        strength: existing.strength ?? c.strength,
        range: existing.range ?? c.range,
      };
      continue;
    }

    if (c.any) {
      next[c.fieldKey] = {
        kind: "ANY",
        value: null,
        provenance: "EXPLICIT_TEXT",
        confidence: c.confidence,
        evidence: c.evidence,
        strength: c.strength,
        preferredValues: c.preferredValues,
        allowedValues: c.allowedValues,
        excludedValues: c.excludedValues,
        range: c.range,
      };
      continue;
    }

    if (c.preferredValues && c.preferredValues.length >= 2 && !c.value) {
      next[c.fieldKey] = {
        kind: "UNKNOWN",
        value: null,
        provenance: "EXPLICIT_TEXT",
        confidence: c.confidence,
        evidence: c.evidence,
        strength: c.strength ?? "PREFERRED",
        preferredValues: c.preferredValues,
        allowedValues: c.allowedValues,
        excludedValues: c.excludedValues,
        range: c.range,
      };
      continue;
    }

    if (c.value) {
      const label =
        c.fieldKey === "condition" && c.value === "NEW"
          ? "Sıfır"
          : c.fieldKey === "condition" && c.value === "USED"
            ? "İkinci el"
            : c.fieldKey === "partPosition" && c.value === "RIGHT"
              ? "Sağ"
              : c.value;
      next[c.fieldKey] = {
        kind: "VALUE",
        value: label,
        provenance: "EXPLICIT_TEXT",
        confidence: c.confidence,
        evidence: c.evidence,
        strength: c.strength,
        preferredValues: c.preferredValues,
        allowedValues: c.allowedValues,
        excludedValues: c.excludedValues,
        range: c.range,
      };
      continue;
    }

    // Exclusion-only / range-only / preferred-empty
    if (
      c.excludedValues?.length ||
      c.range ||
      c.preferredValues?.length ||
      c.allowedValues?.length
    ) {
    const excludedFold = (c.excludedValues ?? []).map((v) =>
      v.toLocaleLowerCase("tr-TR"),
    );
    const existingValue = existing?.kind === "VALUE" ? existing.value : null;
    const valueIsExcluded =
      Boolean(existingValue) &&
      excludedFold.some(
        (e) => e === String(existingValue).toLocaleLowerCase("tr-TR"),
      );
    next[c.fieldKey] = {
      kind: valueIsExcluded
        ? "UNKNOWN"
        : existing?.kind === "VALUE"
          ? existing.kind
          : "UNKNOWN",
      value: valueIsExcluded
        ? null
        : existing?.kind === "VALUE"
          ? existing.value
          : null,
        provenance: "EXPLICIT_TEXT",
        confidence: c.confidence,
        evidence: c.evidence,
        strength: c.strength ?? existing?.strength,
        preferredValues: c.preferredValues ?? existing?.preferredValues,
        allowedValues: c.allowedValues ?? existing?.allowedValues,
        excludedValues: uniqueStrings([
          ...(existing?.excludedValues ?? []),
          ...(c.excludedValues ?? []),
        ]),
        range: c.range ?? existing?.range,
      };
    }
  }

  return next;
}

function uniqueStrings(values: string[]): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const v of values) {
    const key = v.toLocaleLowerCase("tr-TR");
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(v);
  }
  return out;
}

function mapRuProvenance(
  provenance: "EXPLICIT" | "INFERRED" | undefined,
  source?: string,
): FieldProvenance {
  if (source === "FUTURE_KNOWLEDGE" || source === "PRODUCT_IDENTITY") {
    if (provenance === "INFERRED") return "CATALOG_ENRICHED";
  }
  if (provenance === "EXPLICIT") return "EXPLICIT_TEXT";
  return "INFERRED";
}

function valueField(
  value: string,
  provenance: FieldProvenance,
  confidence?: number,
  evidence?: string[],
): CanonicalFieldState {
  return {
    kind: "VALUE",
    value,
    provenance,
    confidence,
    evidence,
  };
}

function unknownField(): CanonicalFieldState {
  return {
    kind: "UNKNOWN",
    value: null,
    provenance: "INFERRED",
    confidence: 0,
  };
}

function flattenUnknown(value: unknown): string {
  if (value == null) return "";
  if (typeof value === "object") {
    const obj = value as { value?: unknown; unit?: string };
    if (obj.value != null && obj.unit) return `${obj.value} ${obj.unit}`;
    if (obj.value != null) return String(obj.value);
  }
  return String(value);
}

/**
 * Convert understanding + raw text hints into hybrid field map.
 */
export function mapUnderstandingToFields(
  result: RequestUnderstandingResult,
): Record<string, CanonicalFieldState> {
  const fields: Record<string, CanonicalFieldState> = {};
  const raw = result.rawInput ?? "";

  const screenSize = extractScreenSize(raw);
  const resolution = extractResolution(raw);
  const productHint = extractProductTypeHint(raw);

  let brandRaw = cleanBrandToken(
    result.identity.brand?.value
      ? String(result.identity.brand.value)
      : result.requestSubject.parentEntity?.brand?.value
        ? String(result.requestSubject.parentEntity.brand.value)
        : null,
  );
  let modelRaw = cleanModelToken(
    result.identity.model?.value
      ? String(result.identity.model.value)
      : result.requestSubject.parentEntity?.model?.value
        ? String(result.requestSubject.parentEntity.model.value)
        : null,
    {
      screenSize,
      productType: result.attributes?.productType?.value
        ? String(result.attributes.productType.value)
        : result.attributes?.applianceType?.value
          ? String(result.attributes.applianceType.value)
          : null,
    },
  );
  // Common city shorthand must remain location context, never product model.
  if (
    modelRaw?.toLocaleLowerCase("tr-TR") === "ist" &&
    /\bist(?:anbul)?(?:['’]?(?:da|de|dan|den))?\b/iu.test(raw)
  ) {
    modelRaw = null;
  }
  if (brandRaw && isKnownAutomotiveModelName(brandRaw)) {
    if (
      !modelRaw ||
      modelRaw.toLocaleLowerCase("tr-TR") ===
        brandRaw.toLocaleLowerCase("tr-TR")
    ) {
      modelRaw = brandRaw;
    }
    brandRaw = null;
  }

  if (brandRaw && result.identity.brand) {
    fields.brand = valueField(
      brandRaw,
      mapRuProvenance(
        result.identity.brand.provenance,
        result.identity.brand.source,
      ),
      result.identity.brand.confidence,
      result.identity.brand.evidence,
    );
  } else if (brandRaw) {
    fields.brand = valueField(brandRaw, "INFERRED", 0.6);
  } else {
    fields.brand = unknownField();
  }

  if (modelRaw && result.identity.model) {
    fields.model = valueField(
      modelRaw,
      mapRuProvenance(
        result.identity.model.provenance,
        result.identity.model.source,
      ),
      result.identity.model.confidence,
      result.identity.model.evidence,
    );
  } else if (modelRaw) {
    fields.model = valueField(modelRaw, "INFERRED", 0.5);
  } else {
    fields.model = unknownField();
  }

  if (result.condition?.value && result.condition.value !== "UNKNOWN") {
    const label =
      result.condition.value === "NEW"
        ? "Sıfır"
        : result.condition.value === "USED"
          ? "İkinci el"
          : result.condition.value === "REFURBISHED"
            ? "Yenilenmiş"
            : String(result.condition.value);
    fields.condition = valueField(
      label,
      mapRuProvenance(result.condition.provenance, result.condition.source),
      result.condition.confidence,
    );
  } else {
    fields.condition = unknownField();
  }

  if (result.subject.productType?.value) {
    fields.productType = valueField(
      String(result.subject.productType.value),
      mapRuProvenance(
        result.subject.productType.provenance,
        result.subject.productType.source,
      ),
    );
  } else if (productHint) {
    fields.productType = valueField(
      productHint.productType,
      "EXPLICIT_TEXT",
      0.9,
      ["product-hint"],
    );
  } else {
    fields.productType = unknownField();
  }

  // Final entity-role gate: product span must not leak into brand/model
  {
    const productTypeValue =
      fields.productType?.kind === "VALUE"
        ? String(fields.productType.value ?? "")
        : productHint?.productType ?? null;
    const cleaned = sanitizeFactRoles({
      brand: fields.brand?.kind === "VALUE" ? String(fields.brand.value) : null,
      model: fields.model?.kind === "VALUE" ? String(fields.model.value) : null,
      productType: productTypeValue,
      rawInput: raw,
      categoryId: result.category.value,
    });
    if (!cleaned.brand) fields.brand = unknownField();
    else if (fields.brand.kind === "VALUE") {
      fields.brand = { ...fields.brand, value: cleaned.brand };
    }
    if (!cleaned.model) fields.model = unknownField();
    else if (fields.model.kind === "VALUE") {
      fields.model = { ...fields.model, value: cleaned.model };
    }
  }

  // Furniture product leaves → furnitureType (browse ↔ text)
  if (productHint?.taxonomyNodeId?.startsWith("tax:furniture:")) {
    fields.furnitureType = valueField(
      productHint.productType,
      "EXPLICIT_TEXT",
      0.9,
      ["furniture-hint"],
    );
  } else {
    fields.furnitureType = unknownField();
  }

  // Appliances product leaves → applianceType (browse ↔ text)
  if (productHint?.taxonomyNodeId?.startsWith("tax:appliances:")) {
    fields.applianceType = valueField(
      productHint.productType,
      "EXPLICIT_TEXT",
      0.9,
      ["appliance-hint"],
    );
  } else if (
    productHint?.productType === "supurge" ||
    /süpürge|supurge/i.test(productHint?.productType ?? "")
  ) {
    fields.applianceType = valueField(
      "Elektrikli Süpürge",
      "EXPLICIT_TEXT",
      0.85,
      ["appliance-vacuum-hint"],
    );
  } else {
    fields.applianceType = unknownField();
  }

  if (screenSize) {
    fields.screenSize = valueField(screenSize, "EXPLICIT_TEXT", 0.95, [
      `${screenSize} ekran`,
    ]);
  } else {
    fields.screenSize = unknownField();
  }

  if (resolution) {
    fields.resolution = valueField(resolution, "EXPLICIT_TEXT", 0.9, [
      resolution,
    ]);
  } else {
    fields.resolution = unknownField();
  }

  // Seed remaining attributes from RU
  for (const [key, uv] of Object.entries(result.attributes)) {
    if (fields[key]?.kind === "VALUE" || fields[key]?.kind === "ANY") continue;
    const flat = flattenUnknown(uv.value);
    if (!flat.trim()) continue;
    fields[key] = valueField(
      flat,
      mapRuProvenance(uv.provenance, uv.source),
      uv.confidence,
      uv.evidence,
    );
  }

  // part / position only for spare-part subjects — never dump vehicle name into part
  const subjectKind = result.requestSubject.kind.value;
  const isPartSubject = subjectKind === "PART" || subjectKind === "ACCESSORY";

  // Real-estate subject name → propertyType (concrete types only; not "gayrimenkul")
  if (
    subjectKind === "REAL_ESTATE" &&
    result.requestSubject.name?.value &&
    !fields.propertyType
  ) {
    const propName = String(result.requestSubject.name.value).trim();
    const generic = /^(gayrimenkul|emlak|konut|ev)$/i.test(propName);
    if (!generic) {
      fields.propertyType = valueField(
        propName,
        mapRuProvenance(
          result.requestSubject.name.provenance,
          result.requestSubject.name.source,
        ),
        result.requestSubject.name.confidence,
      );
    }
  }

  if (isPartSubject) {
    const rawPhrase = String(result.rawInput ?? "");
    const basePart = String(
      result.requestSubject.displayPhrase?.value ??
        result.requestSubject.name?.value ??
        "",
    ).trim();
    let partLabel = basePart;
    if (basePart && rawPhrase) {
      // Prefer fuller user wording: "nemlendirme pompası" over stem "pompa"
      const escaped = basePart.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
      const fuller = rawPhrase.match(
        new RegExp(
          `([\\p{L}][\\p{L}\\s]{0,40}?${escaped}[\\p{L}]*)`,
          "iu",
        ),
      );
      if (fuller?.[1] && fuller[1].trim().length > basePart.length) {
        partLabel = fuller[1]
          .trim()
          .replace(/^\s*için\s+/iu, "")
          .trim();
      }
    }
    partLabel = partLabel.replace(/^\s*için\s+/iu, "").trim();
    if (partLabel) {
      fields.part = valueField(
        partLabel,
        mapRuProvenance(
          result.requestSubject.displayPhrase?.provenance ??
            result.requestSubject.name?.provenance,
          result.requestSubject.displayPhrase?.source ??
            result.requestSubject.name?.source,
        ),
      );
    }

    if (result.requestSubject.position?.value) {
      fields.partPosition = valueField(
        String(result.requestSubject.position.value),
        mapRuProvenance(
          result.requestSubject.position.provenance,
          result.requestSubject.position.source,
        ),
      );
    }
  }

  if (result.quantity?.value?.value != null) {
    fields.quantity = valueField(
      String(result.quantity.value.value),
      mapRuProvenance(result.quantity.provenance, result.quantity.source),
    );
  } else {
    fields.quantity = fields.quantity ?? unknownField();
  }

  if (result.attributes.color) {
    fields.color = valueField(
      flattenUnknown(result.attributes.color.value),
      mapRuProvenance(
        result.attributes.color.provenance,
        result.attributes.color.source,
      ),
    );
  } else {
    fields.color = fields.color ?? unknownField();
  }

  // Field-scoped ANY post-process
  const bindings = extractFieldScopedAny(raw);
  let withAny = applyAnyBindingsToFields(fields, bindings);

  // Phase 2 — apply Single Brain constraint bundle (additive)
  withAny = applyConstraintBundleToFields(withAny, result.constraints);

  // If brand is ANY, drop conflicting concrete brand from weak identity
  if (withAny.brand?.kind === "ANY") {
    // keep ANY
  }

  // Technology hardware demand → needType/solutionType for Step-2 filters
  const taxId = productHint?.taxonomyNodeId ?? "";
  const pt =
    withAny.productType?.kind === "VALUE"
      ? String(withAny.productType.value)
      : productHint?.productType ?? "";
  const isTechHardware =
    taxId.startsWith("tax:technology:donanim:") ||
    /televizyon|\btv\b|laptop|dizüstü|dizustu|telefon|iphone|tablet|ipad|monitör|monitor/i.test(
      `${pt} ${raw}`,
    );
  if (isTechHardware) {
    if (
      !withAny.needType ||
      withAny.needType.kind === "UNKNOWN" ||
      (withAny.needType.kind === "VALUE" &&
        withAny.needType.value === "software" &&
        withAny.needType.provenance === "INFERRED")
    ) {
      withAny.needType = valueField("hardware", "INFERRED", 0.9, [
        "tech-hardware-seed",
      ]);
    }
    if (
      (!withAny.solutionType || withAny.solutionType.kind === "UNKNOWN") &&
      pt
    ) {
      withAny.solutionType = valueField(pt, "INFERRED", 0.85, [
        "tech-solution-seed",
      ]);
    }
  }

  // Furniture home leaf → usageArea Ev (publish/filter comfort)
  if (
    taxId.includes(":ev-mobilyasi:") ||
    (withAny.furnitureType?.kind === "VALUE" &&
      !/ofis|toplantı|makam|çalışma/i.test(
        String(withAny.furnitureType.value ?? ""),
      ))
  ) {
    if (!withAny.usageArea || withAny.usageArea.kind === "UNKNOWN") {
      withAny.usageArea = valueField("Ev", "INFERRED", 0.8, [
        "furniture-home-usage",
      ]);
    }
  } else if (
    taxId.includes(":ofis-mobilyalari:") &&
    (!withAny.usageArea || withAny.usageArea.kind === "UNKNOWN")
  ) {
    withAny.usageArea = valueField("Ofis", "INFERRED", 0.8, [
      "furniture-office-usage",
    ]);
  }

  // RE Residans spelling → Rezidans
  if (
    withAny.propertyType?.kind === "VALUE" &&
    /^residans$/i.test(String(withAny.propertyType.value ?? "").trim())
  ) {
    withAny.propertyType = {
      ...withAny.propertyType,
      value: "Rezidans",
    };
  }

  return withAny;
}

function taxonomyFromUnderstanding(
  result: RequestUnderstandingResult,
  fields: Record<string, CanonicalFieldState>,
): { categoryId: string | null; subcategorySlug: string | null; taxonomyNodeId: string | null } {
  const schema = resolveSchemaCategory(result);
  let categoryId =
    result.category.status !== "UNKNOWN" && result.category.value
      ? result.category.value
      : schema.confident && schema.categoryId
        ? schema.categoryId
        : null;

  const productHint = extractProductTypeHint(result.rawInput);
  let taxonomyNodeId = productHint?.taxonomyNodeId ?? null;
  let subcategorySlug: string | null = null;

  if (taxonomyNodeId) {
    const node = getTaxonomyNode(taxonomyNodeId);
    if (node) {
      categoryId = node.categoryId;
      subcategorySlug = node.subcategoryId ?? null;
    }
  } else if (fields.productType?.kind === "VALUE" && fields.productType.value) {
    // leave as-is
  }

  // Automotive subcategory from needType / subject (not always yedek-parça)
  if (categoryId === "automotive" && !subcategorySlug) {
    const need =
      fields.needType?.kind === "VALUE" && fields.needType.value
        ? fields.needType.value
        : null;
    const subject = result.requestSubject.kind.value;
    if (need === "part" || subject === "PART" || subject === "ACCESSORY") {
      subcategorySlug = "yedek-parca";
    } else if (need === "service" || subject === "SERVICE") {
      subcategorySlug = "arac-bakim";
    } else if (need === "tire") {
      subcategorySlug = "lastik-ve-jant";
    } else if (
      need === "vehicle" ||
      subject === "VEHICLE" ||
      result.intent.value === "BUY" ||
      result.intent.value === "SELL" ||
      result.intent.value === "RENT"
    ) {
      subcategorySlug = "arac-satin-alma";
    }
  }

  // Real-estate: listingType + property hint → subcategory / taxonomy leaf
  if (categoryId === "real-estate") {
    const listing = (
      fields.listingType?.kind === "VALUE" && fields.listingType.value
        ? fields.listingType.value
        : ""
    ).toLocaleLowerCase("tr-TR");
    const raw = (result.rawInput ?? "").toLocaleLowerCase("tr-TR");
    const propHint = (
      fields.propertyType?.kind === "VALUE" && fields.propertyType.value
        ? fields.propertyType.value
        : result.requestSubject.name?.value
          ? String(result.requestSubject.name.value)
          : ""
    ).toLocaleLowerCase("tr-TR");

    if (!subcategorySlug) {
      if (listing.includes("kiralık") || /\bkiralık\b/.test(raw)) {
        subcategorySlug = "kiralik-konut";
      } else if (listing.includes("satılık") || /\bsatılık\b/.test(raw)) {
        subcategorySlug = "satilik-konut";
      } else if (/\b(arsa|tarla)\b/.test(raw) || propHint.includes("arsa")) {
        subcategorySlug = "arsa";
      } else if (
        /\b(dükkan|dukkan|ofis|işyeri|isyeri|depo)\b/.test(raw) ||
        propHint.includes("ofis") ||
        propHint.includes("dükkan")
      ) {
        subcategorySlug = "ticari-gayrimenkul";
      } else if (
        /\b(daire|villa|rezidans|konut|ev|stüdyo|studyo|dubleks)\b/.test(raw) ||
        /\b(daire|villa|ev)\b/.test(propHint)
      ) {
        subcategorySlug =
          result.intent.value === "RENT" ? "kiralik-konut" : "satilik-konut";
      }
    }

    if (!taxonomyNodeId && subcategorySlug) {
      const typeToken =
        /\bdaire\b/.test(propHint) || /\bdaire\b/.test(raw)
          ? "daire"
          : /\brezidans\b/.test(propHint) || /\brezidans\b/.test(raw)
            ? "rezidans"
            : /\bvilla\b/.test(propHint) || /\bvilla\b/.test(raw)
              ? "villa"
              : /\bmüstakil\b/.test(raw)
                ? "müstakil ev"
                : /\byalı\b/.test(raw)
                  ? "yalı"
                  : propHint.trim() &&
                      !/^(gayrimenkul|emlak|konut)$/i.test(propHint.trim())
                    ? propHint.trim()
                    : null;
      if (typeToken) {
        const hit = findTaxonomyTypeUnderSubcategory(
          "real-estate",
          subcategorySlug,
          typeToken,
        );
        if (hit) taxonomyNodeId = hit.id;
      }
    }
  }

  // Appliances vacuum / appliance leaves → stay on appliances
  if (
    productHint?.taxonomyNodeId?.startsWith("tax:appliances:") ||
    productHint?.productType === "supurge"
  ) {
    categoryId = "appliances";
    if (!taxonomyNodeId && productHint.taxonomyNodeId) {
      taxonomyNodeId = productHint.taxonomyNodeId;
    }
    if (!subcategorySlug && productHint.taxonomyNodeId) {
      if (productHint.taxonomyNodeId.includes(":kucuk-ev-aletleri:")) {
        subcategorySlug = "kucuk-ev-aletleri";
      } else if (
        productHint.taxonomyNodeId.includes(":isitma-sogutma-ve-havalandirma:")
      ) {
        subcategorySlug = "isitma-sogutma-ve-havalandirma";
      } else if (productHint.taxonomyNodeId.includes(":beyaz-esya:")) {
        subcategorySlug = "beyaz-esya";
      }
    }
    if (!subcategorySlug && productHint.productType === "supurge") {
      subcategorySlug = "kucuk-ev-aletleri";
    }
  }

  return {
    categoryId: categoryId ?? null,
    subcategorySlug,
    taxonomyNodeId,
  };
}

/**
 * Merge optional browse field bag (__explicit__* markers) into hybrid fields.
 */
export function mergeBrowseFieldBag(
  fields: Record<string, CanonicalFieldState>,
  browseFields: Record<string, string> | undefined,
  lastUserAction: LastUserAction | undefined,
): Record<string, CanonicalFieldState> {
  if (!browseFields) return fields;
  const next = { ...fields };

  for (const [key, raw] of Object.entries(browseFields)) {
    if (key.startsWith("__explicit__")) continue;
    if (key.endsWith("Id")) continue;
    const explicit = (browseFields[`__explicit__${key}`] ?? "").trim();
    if (!raw?.trim() && !explicit) continue;

    if (isAnySentinel(raw) || raw === FIELD_SENTINEL.ANY) {
      next[key] = {
        kind: "ANY",
        value: null,
        provenance: "EXPLICIT_BROWSE",
        confidence: 1,
        evidence: ["browse:ANY"],
      };
      continue;
    }
    if (isNotApplicableSentinel(raw)) {
      next[key] = {
        kind: "NOT_APPLICABLE",
        value: null,
        provenance: "EXPLICIT_BROWSE",
        confidence: 1,
      };
      continue;
    }

    const incoming: CanonicalFieldState = {
      kind: "VALUE",
      value: raw.trim(),
      provenance: explicit ? "EXPLICIT_BROWSE" : "INFERRED",
      confidence: explicit ? 1 : 0.6,
      evidence: explicit ? ["browse"] : undefined,
    };

    const existing = next[key];
    if (!canApplyField(existing, incoming, lastUserAction ?? "browse")) {
      continue;
    }
    next[key] = incoming;
  }

  return next;
}

/**
 * Last explicit user action wins between EXPLICIT_TEXT and EXPLICIT_BROWSE.
 * Catalog/inferred never overwrite conflicting EXPLICIT.
 */
export function canApplyField(
  existing: CanonicalFieldState | undefined,
  incoming: CanonicalFieldState,
  lastUserAction: LastUserAction,
): boolean {
  if (!existing || existing.kind === "UNKNOWN") return true;

  if (
    incoming.provenance === "INFERRED" ||
    incoming.provenance === "CATALOG_ENRICHED"
  ) {
    if (
      existing.provenance === "EXPLICIT_TEXT" ||
      existing.provenance === "EXPLICIT_BROWSE"
    ) {
      return false;
    }
    if (existing.kind === "ANY" || existing.kind === "NOT_APPLICABLE") {
      return false;
    }
    return true;
  }

  // Incoming is EXPLICIT_*
  if (existing.kind === "ANY" || existing.kind === "NOT_APPLICABLE") {
    // Explicit concrete value may replace ANY
    return incoming.kind === "VALUE" || incoming.kind === "ANY";
  }

  if (
    existing.provenance === "INFERRED" ||
    existing.provenance === "CATALOG_ENRICHED"
  ) {
    return true;
  }

  // Both explicit — last action wins
  if (
    existing.provenance === "EXPLICIT_TEXT" &&
    incoming.provenance === "EXPLICIT_BROWSE"
  ) {
    return lastUserAction === "browse";
  }
  if (
    existing.provenance === "EXPLICIT_BROWSE" &&
    incoming.provenance === "EXPLICIT_TEXT"
  ) {
    return lastUserAction === "text";
  }

  return true;
}

/**
 * Progressive text rebuild: keep EXPLICIT_BROWSE only.
 * Previous EXPLICIT_TEXT / INFERRED / CATALOG come from the new understanding
 * (stale text-inferred values must not survive when the user deletes them).
 */
export function mergePreservedBrowseFields(
  fromUnderstanding: Record<string, CanonicalFieldState>,
  previous: Record<string, CanonicalFieldState> | undefined,
  lastUserAction: LastUserAction,
): Record<string, CanonicalFieldState> {
  if (!previous) return fromUnderstanding;

  const next = { ...fromUnderstanding };
  for (const [key, prevField] of Object.entries(previous)) {
    if (prevField.provenance !== "EXPLICIT_BROWSE") continue;
    if (prevField.kind === "UNKNOWN") continue;

    const incoming = next[key];
    if (!incoming || incoming.kind === "UNKNOWN") {
      next[key] = prevField;
      continue;
    }

    // Incoming may not overwrite browse explicit (e.g. weak inference)
    if (!canApplyField(prevField, incoming, lastUserAction)) {
      next[key] = prevField;
    }
  }
  return next;
}

export function buildCanonicalRequestState(input: {
  understanding: RequestUnderstandingResult;
  browseFields?: Record<string, string>;
  lastUserAction?: LastUserAction;
  previous?: CanonicalRequestState | null;
  /**
   * When rebuilding from new text: drop stale inferred/EXPLICIT_TEXT from previous,
   * but preserve EXPLICIT_BROWSE unless the new text explicitly conflicts.
   */
  progressiveReset?: boolean;
}): CanonicalRequestState {
  const lastAction =
    input.lastUserAction ?? input.previous?.lastUserAction ?? "text";
  const mapped = mapUnderstandingToFields(input.understanding);
  let fields = mergeBrowseFieldBag(mapped, input.browseFields, lastAction);

  // Progressive text path: preserve browse pins; never keep stale text inference
  if (input.progressiveReset && input.previous?.fields) {
    fields = mergePreservedBrowseFields(
      fields,
      input.previous.fields,
      lastAction,
    );
  }

  const tax = taxonomyFromUnderstanding(input.understanding, fields);

  // Browse-selected taxonomy leaf survives progressive text if still same category
  let taxonomyNodeId = tax.taxonomyNodeId;
  let subcategorySlug = tax.subcategorySlug;
  let categoryId = tax.categoryId;
  if (
    input.progressiveReset &&
    input.previous?.taxonomyNodeId &&
    !taxonomyNodeId &&
    (!tax.categoryId ||
      !input.previous.categoryId ||
      tax.categoryId === input.previous.categoryId)
  ) {
    taxonomyNodeId = input.previous.taxonomyNodeId;
    subcategorySlug = subcategorySlug ?? input.previous.subcategorySlug;
    categoryId = categoryId ?? input.previous.categoryId;
  }

  fields = stripIncompatibleDomainFields(fields, categoryId);

  return {
    version: "hybrid-v1",
    understanding: input.understanding,
    fields,
    categoryId,
    subcategorySlug,
    taxonomyNodeId,
    lastUserAction: input.lastUserAction ?? input.previous?.lastUserAction,
    naturalTextDirty: true,
    lastComposedText: input.previous?.lastComposedText,
    syncGeneration: (input.previous?.syncGeneration ?? 0) + 1,
  };
}

/** Field bag for question resolver / schema (sentinels for ANY/NA). */
export function toResolverFieldBag(
  state: CanonicalRequestState,
): Record<string, string> {
  const seeded = seedFieldValuesFromUnderstanding(state.understanding);
  const out: Record<string, string> = { ...seeded };

  for (const [key, field] of Object.entries(state.fields)) {
    if (field.kind === "ANY") {
      out[key] = FIELD_SENTINEL.ANY;
      out[`__explicit__${key}`] = state.lastUserAction === "browse" ? "browse" : "text";
    } else if (field.kind === "NOT_APPLICABLE") {
      out[key] = FIELD_SENTINEL.NOT_APPLICABLE;
      out[`__explicit__${key}`] = "text";
    } else if (field.kind === "VALUE" && field.value) {
      out[key] = field.value;
      if (
        field.provenance === "EXPLICIT_TEXT" ||
        field.provenance === "EXPLICIT_BROWSE"
      ) {
        out[`__explicit__${key}`] =
          field.provenance === "EXPLICIT_BROWSE" ? "browse" : "text";
      }
    }
  }

  if (state.categoryId === "automotive" && !out.needType) {
    if (state.understanding.requestSubject.kind.value === "PART") {
      out.needType = "part";
    }
  }

  return out;
}

export function getFieldKind(
  state: CanonicalRequestState,
  key: string,
): CanonicalFieldState["kind"] {
  return state.fields[key]?.kind ?? "UNKNOWN";
}
