/**
 * Text vs browse authority for a single CanonicalRequestState.
 *
 * Text and manual browse are two INPUT METHODS, not two competing truths.
 * A browse pin is current only while the user is still in that commercial
 * request. When free text resolves a different request, stale browse-derived
 * category / needType / domain fields must not remain authoritative.
 */

import type { RequestUnderstandingResult } from "@/lib/request-understanding/types";

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
  heating: new Set(["real-estate"]),
  deedStatus: new Set(["real-estate"]),
  machineType: new Set(["machinery", "industrial"]),
  capacity: new Set(["machinery", "industrial"]),
  furnitureType: new Set(["furniture"]),
  applianceType: new Set(["appliances"]),
  mileage: new Set(["automotive"]),
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

/**
 * Drop category-exclusive fields that cannot belong to the current domain.
 * Brand/model/city/condition stay unless they are exclusive (they are not).
 */
export function stripIncompatibleDomainFields(
  fields: Record<string, CanonicalFieldState>,
  categoryId: string | null | undefined,
): Record<string, CanonicalFieldState> {
  const cat = normalizeCategoryId(categoryId);
  if (!cat) return fields;

  const next = { ...fields };
  for (const [key, field] of Object.entries(next)) {
    if (!field || field.kind === "UNKNOWN") continue;
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
