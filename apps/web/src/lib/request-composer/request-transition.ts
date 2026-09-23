/**
 * Text vs browse authority for a single CanonicalRequestState.
 *
 * Text and manual browse are two INPUT METHODS, not two competing truths.
 * A browse pin is current only while the user is still in that commercial
 * request. When free text resolves a different request, stale browse-derived
 * category / needType / domain fields must not remain authoritative.
 */

import type { RequestUnderstandingResult } from "@/lib/request-understanding/types";
import { isAutomotiveTireServiceProduct } from "./browse-semantic-role";

import type {
  BrowsePathStep,
  CanonicalFieldState,
  CanonicalRequestState,
} from "./types";

export type RequestSyncAuthority =
  | "TEXT_RESOLVED"
  | "EXPLICIT_CURRENT_BROWSE"
  | "STALE_BROWSE_CLEARED";

const AUTO_SUBJECTS = new Set([
  "PART",
  "VEHICLE",
  "ACCESSORY",
]);

const MACHINE_SUBJECTS = new Set([
  "PRODUCT",
  "INDUSTRIAL_EQUIPMENT",
  "MACHINE",
]);

/** Fields that belong to one commercial domain and must not leak into another. */
const FIELD_ALLOWED_CATEGORIES: Record<string, ReadonlySet<string>> = {
  propertyType: new Set(["real-estate"]),
  listingType: new Set(["real-estate"]),
  roomCount: new Set(["real-estate"]),
  floor: new Set(["real-estate"]),
  buildingAge: new Set(["real-estate"]),
  newBuildPreference: new Set(["real-estate"]),
  heating: new Set(["real-estate"]),
  deedStatus: new Set(["real-estate"]),
  parking: new Set(["real-estate"]),
  storefrontNeed: new Set(["real-estate"]),
  loadingAccess: new Set(["real-estate"]),
  ceilingHeight: new Set(["real-estate"]),
  industrialPower: new Set(["real-estate"]),
  lodgingPermit: new Set(["real-estate"]),
  businessActivity: new Set(["real-estate"]),
  transferScope: new Set(["real-estate"]),
  businessPermitStatus: new Set(["real-estate"]),
  outbuildingUsage: new Set(["real-estate"]),
  independentAccess: new Set(["real-estate"]),
  utilityInfrastructure: new Set(["real-estate"]),
  cooperativePurpose: new Set(["real-estate"]),
  cooperativeStage: new Set(["real-estate"]),
  cooperativeShareCount: new Set(["real-estate"]),
  cooperativePaymentPlan: new Set(["real-estate"]),
  tourismFacilityType: new Set(["real-estate"]),
  tourismOperationStatus: new Set(["real-estate"]),
  timeshareFacilityType: new Set(["real-estate"]),
  timesharePeriod: new Set(["real-estate"]),
  timeshareSeason: new Set(["real-estate"]),
  machineType: new Set(["machinery", "industrial"]),
  capacity: new Set(["machinery", "industrial"]),
  furnitureType: new Set(["furniture"]),
  applianceType: new Set(["appliances"]),
  mileage: new Set(["automotive"]),
  serviceDate: new Set(["automotive"]),
  fuel: new Set(["automotive"]),
  transmission: new Set(["automotive"]),
  bodyType: new Set(["automotive"]),
  bodyCondition: new Set(["automotive"]),
  vin: new Set(["automotive"]),
  oemNumber: new Set(["automotive", "appliances"]),
  partSystem: new Set(["automotive", "appliances", "machinery", "printing"]),
  partPosition: new Set(["automotive", "appliances", "machinery", "printing"]),
  part: new Set([
    "automotive",
    "appliances",
    "technology",
    "machinery",
    "printing",
  ]),
  screenSize: new Set(["technology", "appliances"]),
  resolution: new Set(["technology", "appliances"]),
  emptyHomeSize: new Set(["services"]),
  emptyHomeCondition: new Set(["services"]),
  emptyHomeSupplies: new Set(["services"]),
  paintArea: new Set(["services"]),
  paintPrep: new Set(["services"]),
  paintSupply: new Set(["services"]),
  balconySize: new Set(["services"]),
  balconySystem: new Set(["services"]),
  balconyGlass: new Set(["services"]),
  boilerBrand: new Set(["services"]),
  boilerServiceNeed: new Set(["services"]),
  boilerIssue: new Set(["services"]),
  boilerUrgency: new Set(["services"]),
  airConditionerBrand: new Set(["services"]),
  airConditionerNeed: new Set(["services"]),
  airConditionerIssue: new Set(["services"]),
  airConditionerType: new Set(["services", "appliances"]),
  drivingLicenseClass: new Set(["services"]),
  drivingLevel: new Set(["services"]),
  drivingSchedule: new Set(["services"]),
  wallDecorArea: new Set(["services"]),
  wallDecorType: new Set(["services"]),
  wallDecorPrep: new Set(["services"]),
  electricalWork: new Set(["services"]),
  electricalPlace: new Set(["services"]),
  electricalUrgency: new Set(["services"]),
  partialMoveItems: new Set(["services"]),
  partialMoveFloors: new Set(["services"]),
  partialMoveDate: new Set(["services"]),
  homeDecorScope: new Set(["services"]),
  homeDecorArea: new Set(["services"]),
  homeDecorDelivery: new Set(["services"]),
  homeCleaningSize: new Set(["services"]),
  homeCleaningFrequency: new Set(["services"]),
  homeCleaningSupplies: new Set(["services"]),
  movingHomeSize: new Set(["services"]),
  movingFloors: new Set(["services"]),
  movingPacking: new Set(["services"]),
  movingDate: new Set(["services"]),
  tileArea: new Set(["services"]),
  tileSpace: new Set(["services"]),
  tileRemoval: new Set(["services"]),
  tileSupply: new Set(["services"]),
  carpetLoad: new Set(["services"]),
  carpetPickup: new Set(["services"]),
  carpetIssue: new Set(["services"]),
  upholsterySeatCount: new Set(["services"]),
  upholsteryOnSite: new Set(["services"]),
  upholsteryIssue: new Set(["services"]),
  upholsteryFabric: new Set(["services"]),
  boxDimensions: new Set(["printing"]),
  boxMaterial: new Set(["printing"]),
  boxPrintCoverage: new Set(["printing"]),
  boxDieLine: new Set(["printing"]),
  boxDesignReady: new Set(["printing"]),
  labelDimensions: new Set(["printing"]),
  labelMaterial: new Set(["printing"]),
  labelAdhesive: new Set(["printing"]),
  labelFormat: new Set(["printing"]),
  labelDesignReady: new Set(["printing"]),
  publicationFormat: new Set(["printing"]),
  publicationPageCount: new Set(["printing"]),
  publicationBinding: new Set(["printing"]),
  publicationPaper: new Set(["printing"]),
  publicationDesignReady: new Set(["printing"]),
  flatPrintFormat: new Set(["printing"]),
  flatPrintSides: new Set(["printing"]),
  flatPrintPaperWeight: new Set(["printing"]),
  flatPrintFold: new Set(["printing"]),
  flatPrintDesignReady: new Set(["printing"]),
  cardFormat: new Set(["printing"]),
  cardStock: new Set(["printing"]),
  cardFinish: new Set(["printing"]),
  cardDesignReady: new Set(["printing"]),
  promoTextilePrintMethod: new Set(["printing"]),
  promoTextileSizing: new Set(["printing"]),
  promoTextilePlacement: new Set(["printing"]),
  promoDesignReady: new Set(["printing"]),
  promoObjectPrintMethod: new Set(["printing"]),
  promoObjectBrandingArea: new Set(["printing"]),
  promoObjectPackaging: new Set(["printing"]),
  largeFormatDimensions: new Set(["printing"]),
  largeFormatPlacement: new Set(["printing"]),
  largeFormatInstall: new Set(["printing"]),
  largeFormatDesignReady: new Set(["printing"]),
  customPrintSpecs: new Set(["printing"]),
  customPrintMaterial: new Set(["printing"]),
  customPrintDesignReady: new Set(["printing"]),
  medicalDeviceSetting: new Set(["health"]),
  medicalDeviceCondition: new Set(["health"]),
  medicalDeviceSpec: new Set(["health"]),
  medicalDeviceService: new Set(["health"]),
  clinicalEquipmentMode: new Set(["health"]),
  clinicalDimensions: new Set(["health"]),
  clinicalAccessories: new Set(["health"]),
  clinicalCondition: new Set(["health"]),
  labUseCase: new Set(["health"]),
  labDeviceSpec: new Set(["health"]),
  labCalibration: new Set(["health"]),
  labCondition: new Set(["health"]),
  supportProductUsage: new Set(["health"]),
  supportProductFit: new Set(["health"]),
  supportProductCondition: new Set(["health"]),
  supportProductRequirement: new Set(["health"]),
  homeCareSupportScope: new Set(["services"]),
  homeCareSchedule: new Set(["services"]),
  homeCareDuration: new Set(["services"]),
  homeCareStart: new Set(["services"]),
  interiorDesignScope: new Set(["services"]),
  interiorDesignArea: new Set(["services"]),
  interiorDesignDelivery: new Set(["services"]),
  interiorDesignStyle: new Set(["services"]),
};

const NEED_TYPE_CATEGORIES: Record<string, ReadonlySet<string>> = {
  machine: new Set(["machinery", "industrial"]),
  vehicle: new Set(["automotive"]),
  part: new Set([
    "automotive",
    "appliances",
    "technology",
    "machinery",
    "printing",
  ]),
  tire: new Set(["automotive"]),
};

function normalizeCategoryId(id: string | null | undefined): string | null {
  if (!id) return null;
  const trimmed = id.trim();
  if (!trimmed) return null;
  if (trimmed === "industrial") return "machinery";
  return trimmed;
}

function isResolvedCategoryStatus(
  status: string | null | undefined,
): boolean {
  return status === "CONFIDENT" || status === "TENTATIVE";
}

function isResolvedKind(kind: string | null | undefined): boolean {
  return Boolean(kind) && kind !== "UNKNOWN";
}

function compatibleSubjectKinds(
  previousKind: string,
  nextKind: string,
  previousCategoryId: string | null,
  nextCategoryId: string | null,
): boolean {
  if (previousKind === nextKind) {
    if (previousKind === "PRODUCT") {
      return (
        !previousCategoryId ||
        !nextCategoryId ||
        previousCategoryId === nextCategoryId
      );
    }
    return true;
  }

  if (AUTO_SUBJECTS.has(previousKind) && AUTO_SUBJECTS.has(nextKind)) {
    const cat = nextCategoryId || previousCategoryId;
    return !cat || cat === "automotive";
  }

  if (MACHINE_SUBJECTS.has(previousKind) && MACHINE_SUBJECTS.has(nextKind)) {
    const cat = nextCategoryId || previousCategoryId;
    return !cat || cat === "machinery";
  }

  return false;
}

/**
 * True when the new text-native understanding is a different commercial
 * request than the previous canonical state.
 */
export function isMaterialRequestTransition(
  previous: CanonicalRequestState | null | undefined,
  native: RequestUnderstandingResult,
): boolean {
  if (!previous) return false;

  const prevCat = normalizeCategoryId(
    previous.categoryId ?? previous.understanding.category.value,
  );
  const nextCat = normalizeCategoryId(native.category.value);
  const nextOk = isResolvedCategoryStatus(native.category.status);

  if (prevCat && nextCat && nextOk && prevCat !== nextCat) {
    return true;
  }

  const prevKind = previous.understanding.requestSubject.kind.value ?? null;
  const nextKind = native.requestSubject.kind.value ?? null;
  // An explicit part/accessory target replaces vehicle shopping. Keeping the
  // vehicle pin here would reparse "Civic için fren balatası" as a vehicle
  // request and carry mileage/fuel/transmission into the spare-part form.
  // The reverse direction still allows a part flow to be enriched with a
  // vehicle identity without treating that identity alone as a new purchase.
  if (
    prevCat === "automotive" && nextCat === "automotive" && nextOk &&
    previous.fields.needType?.value === "vehicle" &&
    (nextKind === "PART" || nextKind === "ACCESSORY")
  ) {
    return true;
  }
  if (
    isResolvedKind(prevKind) &&
    isResolvedKind(nextKind) &&
    prevKind &&
    nextKind &&
    !compatibleSubjectKinds(prevKind, nextKind, prevCat, nextCat)
  ) {
    return true;
  }

  return false;
}

export function resolveTextSyncAuthority(input: {
  previous: CanonicalRequestState | null | undefined;
  native: RequestUnderstandingResult;
  rawText: string;
  callerStructuredCategoryId?: string | null;
}): RequestSyncAuthority {
  if (input.callerStructuredCategoryId?.trim()) {
    return "EXPLICIT_CURRENT_BROWSE";
  }
  if (!input.previous) return "TEXT_RESOLVED";
  if (!input.rawText.trim()) return "STALE_BROWSE_CLEARED";
  if (isMaterialRequestTransition(input.previous, input.native)) {
    return "STALE_BROWSE_CLEARED";
  }
  return "TEXT_RESOLVED";
}

export function shouldCarryBrowseNeedPin(
  previous: CanonicalRequestState | null | undefined,
  authority: RequestSyncAuthority,
): boolean {
  if (authority === "STALE_BROWSE_CLEARED") return false;
  if (authority === "EXPLICIT_CURRENT_BROWSE") return true;
  return previous?.fields.needType?.provenance === "EXPLICIT_BROWSE";
}

export function isFieldCompatibleWithCategory(
  fieldKey: string,
  categoryId: string | null | undefined,
): boolean {
  const cat = normalizeCategoryId(categoryId);
  if (!cat) return true;

  if (fieldKey === "needType") return true;

  const allowed = FIELD_ALLOWED_CATEGORIES[fieldKey];
  if (!allowed) return true;
  return allowed.has(cat);
}

function clearedField(reason: string): CanonicalFieldState {
  return {
    kind: "UNKNOWN",
    value: null,
    provenance: "INFERRED",
    confidence: 0,
    evidence: [reason],
  };
}

function fieldValue(
  fields: Record<string, CanonicalFieldState>,
  key: string,
): string {
  const field = fields[key];
  return field?.kind === "VALUE" ? String(field.value ?? "").trim() : "";
}

function clearField(
  fields: Record<string, CanonicalFieldState>,
  key: string,
  reason: string,
): void {
  const field = fields[key];
  if (!field || field.kind === "UNKNOWN") return;
  fields[key] = clearedField(reason);
}

function isJantProduct(value: string): boolean {
  return /(?:^|\s)(?:jant|çelik jant|celik jant|alaşım jant|alasim jant|forged jant)(?:$|\s)/iu.test(
    value,
  );
}

function isAutomotivePpfProduct(value: string): boolean {
  return /koruma filmi|kaplama|ppf|wrapping/iu.test(value);
}

/**
 * Drop category-exclusive fields that cannot belong to the current domain.
 * Brand/model/city/condition stay unless they are exclusive (they are not).
 *
 * `preserveExplicitText` (98+ Faz I, 2026-09-01): AYNI metin çözümünden
 * gelen açık kullanıcı beyanı bu temizlikte SİLİNEMEZ. Ölçüldü: "Bebek
 * arabası için tekerlek arıyorum" — beyin part=tekerlek üretiyor, kategori
 * baby olduğu için izin tablosu alanı temizliyor ve kullanıcının yazdığı
 * parça state'ten kayboluyordu. Temizliğin amacı ESKİ domain'in bayat
 * kalıntılarını düşürmektir; kullanıcının şu anki cümlesindeki beyan bayat
 * değildir. Browse-geçiş çağrıları eski davranışı korur (bayrak geçmez).
 */
export function stripIncompatibleDomainFields(
  fields: Record<string, CanonicalFieldState>,
  categoryId: string | null | undefined,
  options?: {
    preserveExplicitText?: boolean;
    /** Run product-family cleanup for an explicit family switch. */
    automotiveFamilyTransition?: boolean;
    /** Distinguish an existing wheel diameter from a previous tire size. */
    previousFields?: Record<string, CanonicalFieldState>;
  },
): Record<string, CanonicalFieldState> {
  const cat = normalizeCategoryId(categoryId);
  if (!cat) return fields;

  const next = { ...fields };
  for (const [key, field] of Object.entries(next)) {
    if (!field || field.kind === "UNKNOWN") continue;
    /**
     * Koruma yalnız ÇOK-domain'li alanlar içindir (izin tablosundan
     * türetilir, ada özel değildir): "part" gibi birden çok kategoride
     * yaşayan bir kavramda kullanıcının beyanı tek kanaldır ve silinirse
     * KAYBOLUR. listingType/roomCount gibi TEK domain'e özel kanallar ise
     * kendi domain'i dışında yaşayamaz; oradaki bilgi kendi ekseninde
     * (intent, kind) zaten taşınır ve temizlik kayıp üretmez (ölçüldü:
     * health'te listingType, services'te roomCount hayalet kalıyordu).
     */
    const allowedSet = FIELD_ALLOWED_CATEGORIES[key];
    if (
      options?.preserveExplicitText &&
      field.provenance === "EXPLICIT_TEXT" &&
      (allowedSet?.size ?? 0) > 1
    ) {
      continue;
    }
    if (!isFieldCompatibleWithCategory(key, cat)) {
      next[key] = clearedField(`cleared-on-domain-switch:${cat}`);
    }
  }

  const need = next.needType;
  if (need?.kind === "VALUE" && need.value) {
    const allowed = NEED_TYPE_CATEGORIES[String(need.value).toLowerCase()];
    if (allowed && !allowed.has(cat)) {
      next.needType = clearedField(`cleared-needType-on-domain-switch:${cat}`);
    }
  }

  /**
   * Product-family changes inside Otomotiv are also request transitions.
   * Browse answers are intentionally preserved across text edits, but a
   * previous Lastik flow must not resurrect Mevsim when the user changes to
   * Jant (or to a service/PPF flow). The same boundary removes stale service
   * answers from a purchase flow.
   */
  if (cat === "automotive" && options?.automotiveFamilyTransition !== false) {
    const clearFamilyField = (key: string, reason: string) => {
      // A fresh text/browse answer belongs to the new family. Only stale
      // values from the previous family may be removed here.
      if (
        options?.preserveExplicitText &&
        next[key]?.provenance === "EXPLICIT_TEXT"
      ) {
        return;
      }
      clearField(next, key, reason);
    };
    const resolvedNeed = fieldValue(next, "needType");
    const product =
      fieldValue(next, "productType") || fieldValue(next, "tireItemType");
    const previousFields = options?.previousFields;
    const previousProduct = previousFields
      ? fieldValue(previousFields, "productType") || fieldValue(previousFields, "tireItemType")
      : "";
    if (
      product && resolvedNeed === "service" &&
      isAutomotivePpfProduct(previousProduct) && !isAutomotivePpfProduct(product)
    ) {
      clearFamilyField("color", "cleared-on-ppf-to-maintenance-switch");
    }
    if (resolvedNeed !== "tire") {
      for (const key of ["tireItemType", "tireSize", "tireSeason", "tireQuantity", "serviceDate"]) {
        clearFamilyField(key, `cleared-on-automotive-family-switch:${resolvedNeed || "unknown"}`);
      }
    } else if (isAutomotiveTireServiceProduct(product)) {
      for (const key of ["tireItemType", "tireSize", "tireSeason"]) {
        clearFamilyField(key, "cleared-on-tire-service-family-switch");
      }
    } else if (isJantProduct(product)) {
      // tireSize holds a diameter once the user is already in the wheel
      // flow. Rebuilding that request must not erase its browse answer.
      if (!isJantProduct(previousProduct)) {
        clearFamilyField("tireSize", "cleared-on-jant-family-switch");
      }
      for (const key of ["tireSeason", "serviceDate", "serviceType"]) {
        clearFamilyField(key, "cleared-on-jant-family-switch");
      }
    } else {
      if (product && isJantProduct(previousProduct)) {
        clearFamilyField("tireSize", "cleared-on-tire-purchase-family-switch");
      }
      for (const key of ["serviceDate", "serviceType"]) {
        clearFamilyField(key, "cleared-on-tire-purchase-family-switch");
      }
    }
  }

  return next;
}

/**
 * After a browse click, skip one text→walk realign only when the new path
 * still lives under the same walk category. A later text replace that jumps
 * domains must realign the cascade.
 */
export function shouldSkipTextWalkRealign(input: {
  skipOnce: boolean;
  walkCategoryId: string;
  path: BrowsePathStep[];
}): boolean {
  if (!input.skipOnce) return false;
  const pathRoot = input.path[0]?.id ?? "";
  const walkRoot = input.walkCategoryId.trim();
  if (!walkRoot || !pathRoot) return true;
  return (
    pathRoot === walkRoot ||
    pathRoot.startsWith(`${walkRoot}/`) ||
    walkRoot === pathRoot
  );
}
