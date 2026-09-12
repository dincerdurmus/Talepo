/**
 * Browse → canonical state. EXPLICIT_BROWSE with last-action precedence.
 */

import { applyBrowseSelection } from "@/lib/knowledge/browse";

import {
  resolveBrowseSemanticRole,
  type BrowseSemanticRole,
} from "./browse-semantic-role";
import { canApplyField } from "./build-state";
import { composeNaturalRequestText } from "./compose-text";
import { stripIncompatibleDomainFields } from "./request-transition";
import type {
  CanonicalFieldState,
  CanonicalRequestState,
  FieldValueKind,
} from "./types";
import { FIELD_SENTINEL, isAnySentinel } from "./types";

export type BrowseSelectionInput = {
  key: string;
  value: string;
  entityId?: string;
  /** When true, value is the ANY sentinel / Farketmez option */
  isAny?: boolean;
  /**
   * DEĞER TAŞIMAYAN CEVABIN KANONİK MODU (D3f Dilim 1, 2026-08-27).
   *
   * `isAny` yalnız TEK bir değer taşımayan cevabı ifade edebiliyordu. Bu
   * yüzden "Bilmiyorum" seçimi kanonik bir mod bulamıyor ve üretimde
   * yerelleştirilmiş ETİKET (`"Belirtilmedi"` / `"Henüz bilmiyorum"`) bir
   * DEĞER olarak yazılıyordu: alan `kind: "VALUE"` oluyor, `attributes`
   * torbasına giriyor ve matching onu ürün özelliği sayıyordu.
   *
   * `kind` verildiğinde `value` YALNIZ kullanıcıya gösterilen etikettir ve
   * kanonik kayda YAZILMAZ. `isAny` geriye uyumluluk için korunur ve
   * `kind: "ANY"` ile aynı şeyi söyler.
   */
  kind?: FieldValueKind;
};

function applyRoleFixedFields(
  fields: Record<string, CanonicalFieldState>,
  role: BrowseSemanticRole,
  subcategorySlug: string | null,
) {
  for (const [key, value] of Object.entries(role.fixedFields ?? {})) {
    fields[key] = {
      kind: "VALUE",
      value,
      provenance: "EXPLICIT_BROWSE",
      confidence: 1,
      evidence: [`browse-role:${subcategorySlug}`, `browse-fixed:${key}`],
    };
  }
}

/**
 * Apply one browse selection onto hybrid state.
 * May replace INFERRED / ANY; conflicting older EXPLICIT only if last action is browse.
 */
export function applyBrowseSelectionToState(
  state: CanonicalRequestState,
  selection: BrowseSelectionInput,
): CanonicalRequestState {
  const isAny =
    selection.kind === "ANY" ||
    selection.isAny ||
    isAnySentinel(selection.value) ||
    selection.value === FIELD_SENTINEL.ANY;

  /**
   * DEĞER TAŞIMAYAN MOD ETİKETİ KAYDA YAZMAZ (D3f Dilim 1).
   *
   * Kullanıcı "Bilmiyorum" ya da "Uygulanamaz" seçtiğinde ekranda bir metin
   * görür, ama o metin bir ürün özelliği DEĞİLDİR. Kanonik kayda mod yazılır,
   * etiket yazılmaz — böylece etiket `attributes` torbasına ve oradan
   * matching'e sızamaz.
   */
  const nonValueKind =
    selection.kind === "UNKNOWN" || selection.kind === "NOT_APPLICABLE"
      ? selection.kind
      : null;

  const incoming: CanonicalFieldState = nonValueKind
    ? {
        kind: nonValueKind,
        value: null,
        provenance: "EXPLICIT_BROWSE",
        confidence: 1,
        evidence: [`browse:${nonValueKind}`],
      }
    : isAny
      ? {
          kind: "ANY",
          value: null,
          provenance: "EXPLICIT_BROWSE",
          confidence: 1,
          evidence: ["browse:ANY"],
        }
      : {
          kind: "VALUE",
          value: selection.value,
          provenance: "EXPLICIT_BROWSE",
          confidence: 1,
          evidence: selection.entityId
            ? [`entity:${selection.entityId}`]
            : ["browse"],
        };

  const existing = state.fields[selection.key];
  if (!canApplyField(existing, incoming, "browse")) {
    return state;
  }

  const fields = {
    ...state.fields,
    [selection.key]: incoming,
  };

  // `tireItemType` is the user's product-family choice. Keep the canonical
  // product context in lockstep with it; otherwise an older `productType:
  // Lastik` can win the scheduler's fallback chain after the user switches to
  // Jant, leaving the old season question visible.
  if (
    selection.key === "tireItemType" &&
    !isAny &&
    !nonValueKind &&
    selection.value.trim()
  ) {
    fields.productType = {
      ...incoming,
      evidence: [
        ...(incoming.evidence ?? []),
        "product-context:tireItemType",
      ],
    };
  }

  // Furniture leaf: drop bogus category brands like "Ev"
  if (selection.key === "furnitureType" && !isAny && !nonValueKind) {
    const brand = fields.brand;
    if (
      brand?.kind === "VALUE" &&
      /^(ev|mobilya|ev mobilyası|ofis)$/i.test(String(brand.value ?? "").trim())
    ) {
      fields.brand = {
        kind: "UNKNOWN",
        value: null,
        provenance: "INFERRED",
        confidence: 0,
      };
    }
  }

  // Appliances leaf: drop bogus category brands like "Beyaz"
  if (selection.key === "applianceType" && !isAny && !nonValueKind) {
    const brand = fields.brand;
    if (
      brand?.kind === "VALUE" &&
      /^(beyaz|eşya|beyaz eşya|klima)$/i.test(String(brand.value ?? "").trim())
    ) {
      fields.brand = {
        kind: "UNKNOWN",
        value: null,
        provenance: "INFERRED",
        confidence: 0,
      };
    }
  }

  // Keep a parallel bag for knowledge applyBrowseSelection / enrichment guards
  const bag = applyBrowseSelection(
    {},
    {
      key: selection.key,
      /* Etiket bu torbaya da girmez — mod kendi sentinel'iyle taşınır. */
      value: nonValueKind
        ? nonValueKind === "NOT_APPLICABLE"
          ? FIELD_SENTINEL.NOT_APPLICABLE
          : ""
        : isAny
          ? FIELD_SENTINEL.ANY
          : selection.value,
      entityId: selection.entityId,
    },
  );

  let categoryId = state.categoryId;
  let subcategorySlug = state.subcategorySlug;
  let taxonomyNodeId = state.taxonomyNodeId;

  // Automotive service changes are product-family changes too. Keep the
  // selected service leaf and the canonical product context synchronized so
  // "Periyodik bakım → Fren bakımı" updates the final summary.
  if (
    selection.key === "serviceType" &&
    (categoryId === "automotive" || state.categoryId === "automotive") &&
    !isAny &&
    !nonValueKind &&
    selection.value.trim()
  ) {
    fields.productType = {
      ...incoming,
      evidence: [
        ...(incoming.evidence ?? []),
        "product-context:serviceType",
      ],
    };
  }

  if (selection.key === "furnitureType") {
    categoryId = "furniture";
    if (selection.entityId?.startsWith("tax:furniture:")) {
      taxonomyNodeId = selection.entityId;
      if (selection.entityId.includes(":ev-mobilyasi:")) {
        subcategorySlug = "ev-mobilyasi";
      } else if (selection.entityId.includes(":ofis-mobilyalari:")) {
        subcategorySlug = "ofis-mobilyalari";
      }
    } else if (!subcategorySlug) {
      subcategorySlug = "ev-mobilyasi";
    }
  }

  if (selection.key === "applianceType") {
    categoryId = "appliances";
    if (selection.entityId?.startsWith("tax:appliances:")) {
      taxonomyNodeId = selection.entityId;
      if (selection.entityId.includes(":kucuk-ev-aletleri:")) {
        subcategorySlug = "kucuk-ev-aletleri";
      } else if (
        selection.entityId.includes(":isitma-sogutma-ve-havalandirma:")
      ) {
        subcategorySlug = "isitma-sogutma-ve-havalandirma";
      } else if (selection.entityId.includes(":beyaz-esya:")) {
        subcategorySlug = "beyaz-esya";
      } else if (selection.entityId.includes(":diger:")) {
        subcategorySlug = "diger";
      }
    } else if (!subcategorySlug) {
      subcategorySlug = "beyaz-esya";
    }
  }

  // Pin automotive (and similar) commercial subject from subcategory context.
  // Brand/model under Yedek Parça must not collapse into vehicle purchase.
  const role = resolveBrowseSemanticRole({
    categoryId,
    subcategorySlug,
    taxonomyNodeId,
    productType: fields.productType?.value ?? fields.serviceType?.value ?? null,
  });
  if (role.needType) {
    const existingNeed = fields.needType;
    const pinNeed: CanonicalFieldState = {
      kind: "VALUE",
      value: role.needType,
      provenance: "EXPLICIT_BROWSE",
      confidence: 1,
      evidence: [`browse-role:${subcategorySlug}`],
    };
    // A common answer (budget, city, delivery, …) must not re-apply the
    // subcategory's default role over an explicit text intent.  The role is
    // established by a semantic browse selection itself; after that, ordinary
    // answers only update their own field.
    const semanticSelection = new Set([
      "needType",
      "productType",
      "machineType",
      "applianceType",
      "furnitureType",
      "babyProductType",
      "kitchenProductType",
      "tireItemType",
      "serviceType",
    ]).has(selection.key);
    const canPinRole =
      semanticSelection ||
      !existingNeed ||
      existingNeed.provenance === "INFERRED" ||
      existingNeed.provenance === "CATALOG_ENRICHED";
    if (canPinRole && canApplyField(existingNeed, pinNeed, "browse")) {
      fields.needType = pinNeed;
    }
  }
  applyRoleFixedFields(fields, role, subcategorySlug);

  // Bütün-ürün satın alma yaprağı seçildiğinde eski parça/aksesuar bağlamı
  // yaşayamaz: "Cep Telefonu & Aksesuar" gibi ara grup metinlerinin ürettiği
  // PART kalıntısı, telefon ALMAK isteyeni yedek parçaya düşürüyordu
  // (kurucu, 2026-08-23).
  const isWholeProductLeafKey =
    selection.key === "productType" ||
    selection.key === "applianceType" ||
    selection.key === "kitchenProductType" ||
    selection.key === "furnitureType" ||
    selection.key === "babyProductType" ||
    selection.key === "machineType";
  if (
    isWholeProductLeafKey &&
    role.needType !== "part" &&
    role.needType !== "tire"
  ) {
    for (const key of ["part", "partSystem", "partPosition", "oemNumber"]) {
      const f = fields[key];
      if (f && f.kind !== "UNKNOWN") {
        fields[key] = {
          kind: "UNKNOWN",
          value: null,
          provenance: "INFERRED",
          confidence: 0,
          evidence: ["cleared-on-whole-product-leaf"],
        };
      }
    }
    if (
      fields.needType?.kind === "VALUE" &&
      (fields.needType.value === "part" || fields.needType.value === "tire") &&
      fields.needType.provenance !== "EXPLICIT_BROWSE"
    ) {
      fields.needType = {
        kind: "UNKNOWN",
        value: null,
        provenance: "INFERRED",
        confidence: 0,
        evidence: ["cleared-on-whole-product-leaf"],
      };
    }
  }

  // Product-family selection is the only moment where old tire answers are
  // invalidated. A later `tireSize` answer must pass through untouched.
  if (
    categoryId === "automotive" &&
    (selection.key === "tireItemType" || selection.key === "productType")
  ) {
    for (const key of ["tireSize", "tireSeason", "tireQuantity", "serviceDate", "serviceType"]) {
      const field = fields[key];
      if (field && field.kind !== "UNKNOWN") {
        fields[key] = {
          kind: "UNKNOWN",
          value: null,
          provenance: "INFERRED",
          confidence: 0,
          evidence: ["cleared-on-automotive-family-selection"],
        };
      }
    }
  }

  const next: CanonicalRequestState = {
    ...state,
    categoryId,
    subcategorySlug,
    taxonomyNodeId,
    fields: stripIncompatibleDomainFields(fields, categoryId, {
      automotiveFamilyTransition: selection.key === "serviceType",
      previousFields: state.fields,
    }),
    lastUserAction: "browse",
    naturalTextDirty: true,
    syncGeneration: state.syncGeneration + 1,
  };

  // Stash bag markers onto a synthetic attribute for consumers that read field bags
  void bag;

  const composed = composeNaturalRequestText(next);
  return {
    ...next,
    lastComposedText: composed,
    naturalTextDirty: false,
  };
}

/**
 * Pin category + subcategory semantic role as EXPLICIT_BROWSE (no leaf field).
 */
export function pinBrowseSemanticContext(
  state: CanonicalRequestState,
  input: {
    categoryId: string | null;
    subcategorySlug: string | null;
    taxonomyNodeId?: string | null;
  },
): CanonicalRequestState {
  const categoryId = input.categoryId ?? state.categoryId;
  const subcategorySlug = input.subcategorySlug ?? state.subcategorySlug;
  const taxonomyNodeId =
    input.taxonomyNodeId ?? state.taxonomyNodeId ?? null;
  const role = resolveBrowseSemanticRole({
    categoryId,
    subcategorySlug,
    taxonomyNodeId,
    productType:
      state.fields.applianceType?.value ??
      state.fields.productType?.value ??
      state.fields.machineType?.value ??
      null,
  });

  const fields = { ...state.fields };
  if (role.needType) {
    fields.needType = {
      kind: "VALUE",
      value: role.needType,
      provenance: "EXPLICIT_BROWSE",
      confidence: 1,
      evidence: [`browse-role:${subcategorySlug}`],
    };
  } else if (!subcategorySlug) {
    fields.needType = {
      kind: "UNKNOWN",
      value: null,
      provenance: "INFERRED",
      confidence: 0,
      evidence: ["category-root-no-intent"],
    };
  }
  applyRoleFixedFields(fields, role, subcategorySlug);

  // Subject switch: drop fields that are only valid for the previous subject.
  // Brand/model may survive; vehicle-purchase condition must not bleed into PART.
  const clearField = (key: string) => {
    const f = fields[key];
    if (!f || f.kind === "UNKNOWN") return;
    fields[key] = {
      kind: "UNKNOWN",
      value: null,
      provenance: "INFERRED",
      confidence: 0,
      evidence: [`cleared-on-subject-switch:${role.needType}`],
    };
  };
  if (role.needType === "part" || role.needType === "tire") {
    for (const key of [
      "condition",
      "mileage",
      "damageStatus",
      "bodyType",
      "bodyCondition",
    ]) {
      clearField(key);
    }
  }
  if (role.needType === "vehicle" || role.needType === "machine") {
    for (const key of ["part", "partSystem", "partPosition", "oemNumber"]) {
      clearField(key);
    }
  }

  const next: CanonicalRequestState = {
    ...state,
    categoryId,
    subcategorySlug,
    taxonomyNodeId,
    fields: stripIncompatibleDomainFields(fields, categoryId),
    lastUserAction: "browse",
    naturalTextDirty: true,
    syncGeneration: state.syncGeneration + 1,
  };
  const composed = composeNaturalRequestText(next);
  return {
    ...next,
    lastComposedText: composed,
    naturalTextDirty: false,
  };
}

/** Apply multiple browse selections (e.g. browse-only flow). */
export function applyBrowseSelectionsToState(
  state: CanonicalRequestState,
  selections: BrowseSelectionInput[],
): CanonicalRequestState {
  let next = state;
  for (const sel of selections) {
    next = applyBrowseSelectionToState(next, sel);
  }
  return next;
}
