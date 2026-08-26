/**
 * Bidirectional sync with generation token + loop prevention.
 * Text path always goes through understandRequest() (sole brain).
 */

import { understandRequest } from "@/lib/request-understanding/understand-request";
import type { UnderstandRequestInput } from "@/lib/request-understanding/understand-request";

import {
  applyBrowseSelectionToState,
  type BrowseSelectionInput,
} from "./apply-browse";
import { isInferenceOnlyAnswer } from "./answer-authority";
import { buildCanonicalRequestState } from "./build-state";
import { composeNaturalRequestText } from "./compose-text";
import {
  resolveTextSyncAuthority,
  shouldCarryBrowseNeedPin,
  stripIncompatibleDomainFields,
  type RequestSyncAuthority,
} from "./request-transition";
import type { CanonicalRequestState } from "./types";

export type SyncFromTextResult = {
  state: CanonicalRequestState;
  skipped: boolean;
  reason?: string;
  authority?: RequestSyncAuthority;
  /** True when a previous browse/category pin was dropped for a new request. */
  clearedStaleBrowse?: boolean;
};

export type SyncFromBrowseResult = {
  state: CanonicalRequestState;
  composedText: string;
};

function normalizeComparable(text: string): string {
  return text
    .normalize("NFC")
    .trim()
    .replace(/\s+/g, " ")
    .replace(/[.!?]+$/g, "")
    .toLocaleLowerCase("tr-TR");
}

/** tr-TR duyarsız karşılaştırma — etiket/slug farkı yükseltmeyi engellemesin. */
function foldSelection(value: string): string {
  return value.trim().toLocaleLowerCase("tr-TR").replace(/[\s_-]+/g, " ");
}

function withUserSelectedProvenance(
  state: CanonicalRequestState,
  fieldValues: Record<string, string | null | undefined> | undefined,
): CanonicalRequestState {
  if (!fieldValues) return state;
  let changed = false;
  const fields = { ...state.fields };
  for (const [key, selected] of Object.entries(fieldValues)) {
    const picked = (selected ?? "").trim();
    if (!picked) continue;
    const field = fields[key];
    if (!field || field.kind !== "VALUE") continue;
    if (!isInferenceOnlyAnswer(field)) continue;
    const current = String(field.value ?? "");
    const canonical = String(field.canonicalValue ?? "");
    if (
      foldSelection(current) !== foldSelection(picked) &&
      foldSelection(canonical) !== foldSelection(picked)
    ) {
      continue;
    }
    fields[key] = {
      ...field,
      provenance: "EXPLICIT_BROWSE",
      evidence: [...(field.evidence ?? []), "user-selected:structured"],
    };
    changed = true;
  }
  return changed ? { ...state, fields } : state;
}

/**
 * TEXT → Single Brain → CanonicalRequestState.
 * Skips re-parse when input equals last composed output (loop prevention),
 * but NEVER when browse-pinned needType disagrees with requestSubject
 * (browse compose can update text without refreshing understanding).
 */
export function syncFromText(
  previous: CanonicalRequestState | null | undefined,
  rawText: string,
  opts?: { structured?: UnderstandRequestInput["structured"]; force?: boolean },
): SyncFromTextResult {
  const text = rawText ?? "";
  const previousBrowseNeed =
    previous?.fields.needType?.provenance === "EXPLICIT_BROWSE" &&
    previous.fields.needType.kind === "VALUE" &&
    previous.fields.needType.value
      ? String(previous.fields.needType.value).toLowerCase()
      : null;
  const subjectKind =
    previous?.understanding.requestSubject.kind.value ?? null;
  const subjectMatchesBrowseNeed = (() => {
    if (!previousBrowseNeed) return true;
    if (previousBrowseNeed === "part" || previousBrowseNeed === "tire") {
      return subjectKind === "PART" || subjectKind === "ACCESSORY";
    }
    if (previousBrowseNeed === "vehicle") return subjectKind === "VEHICLE";
    if (previousBrowseNeed === "service") return subjectKind === "SERVICE";
    if (previousBrowseNeed === "machine") {
      return (
        subjectKind === "INDUSTRIAL_EQUIPMENT" || subjectKind === "PRODUCT"
      );
    }
    return true;
  })();

  if (
    !opts?.force &&
    previous?.lastComposedText &&
    normalizeComparable(text) ===
      normalizeComparable(previous.lastComposedText) &&
    subjectMatchesBrowseNeed
  ) {
    return {
      state: {
        ...previous,
        naturalTextDirty: false,
      },
      skipped: true,
      reason: "composed-text-echo",
      authority: "EXPLICIT_CURRENT_BROWSE",
    };
  }

  // Parse text-native first. Never inject previous.categoryId as a structured
  // override — that lock is what kept Makine pinned over a new request.
  const native = understandRequest({
    rawInput: text,
    structured: opts?.structured,
  });

  const authority = resolveTextSyncAuthority({
    previous,
    native,
    rawText: text,
    callerStructuredCategoryId: opts?.structured?.categoryId,
  });
  const clearedStaleBrowse = authority === "STALE_BROWSE_CLEARED";
  const carryBrowsePin = shouldCarryBrowseNeedPin(previous, authority);

  let understanding = native;
  if (
    carryBrowsePin &&
    previousBrowseNeed &&
    !opts?.structured?.fieldValues?.needType
  ) {
    // Same-domain enrichment: keep PART/VEHICLE/machine browse role so
    // brand+model sentences cannot collapse the current request.
    const structured: UnderstandRequestInput["structured"] = {
      ...opts?.structured,
      categoryId:
        opts?.structured?.categoryId ?? previous?.categoryId ?? undefined,
      fieldValues: {
        ...opts?.structured?.fieldValues,
        needType: previousBrowseNeed,
      },
    };
    understanding = understandRequest({
      rawInput: text,
      structured,
    });
  }

  let state = buildCanonicalRequestState({
    understanding,
    lastUserAction: "text",
    previous: clearedStaleBrowse ? null : previous ?? null,
    progressiveReset: !clearedStaleBrowse,
  });

  // Current browse pin stays authoritative only for the same request.
  if (carryBrowsePin && previous && !clearedStaleBrowse) {
    const categoryId = previous.categoryId ?? state.categoryId;
    state = {
      ...state,
      subcategorySlug: previous.subcategorySlug ?? state.subcategorySlug,
      categoryId,
      taxonomyNodeId: previous.taxonomyNodeId ?? state.taxonomyNodeId,
      fields: stripIncompatibleDomainFields(
        {
          ...state.fields,
          ...(previous.fields.needType?.provenance === "EXPLICIT_BROWSE"
            ? { needType: previous.fields.needType }
            : {}),
        },
        categoryId,
      ),
    };
  }

  /**
   * KULLANICININ KENDİ SEÇİMİ ÇIKARIM DEĞİLDİR (KB-17).
   *
   * `structured.fieldValues` çağıranın taşıdığı KULLANICI seçimidir (yapısal
   * form / rol seçimi). Anlama katmanı bu değeri bir attribute olarak geri
   * verirken `INFERRED` etiketliyor; etiket, değerin nereden geldiğini
   * kaybediyor. Cevap otoritesi artık soruyu kapatıp kapatmayacağına bu
   * etikete bakarak karar verdiği için, kullanıcının seçtiği rol ona yeniden
   * sorulur hâle geliyordu.
   *
   * Yükseltme YALNIZ değer birebir çakıştığında yapılır: anlama katmanı
   * seçimi başka bir değere dönüştürdüyse ortada kullanıcının onayladığı bir
   * değer yoktur ve uydurulmaz.
   */
  state = withUserSelectedProvenance(state, opts?.structured?.fieldValues);

  const composed = composeNaturalRequestText(state);
  return {
    state: {
      ...state,
      lastComposedText: composed,
      naturalTextDirty: false,
      syncGeneration: (previous?.syncGeneration ?? 0) + 1,
    },
    skipped: false,
    authority,
    clearedStaleBrowse,
  };
}

/**
 * BROWSE → CanonicalRequestState → Natural Text.
 */
export function syncFromBrowse(
  previous: CanonicalRequestState,
  selection: BrowseSelectionInput,
): SyncFromBrowseResult {
  const state = applyBrowseSelectionToState(previous, selection);
  const composedText =
    state.lastComposedText ?? composeNaturalRequestText(state);
  return {
    state: {
      ...state,
      lastComposedText: composedText,
      naturalTextDirty: false,
    },
    composedText,
  };
}

/**
 * Bootstrap browse-only state without free text (empty understanding shell).
 */
export function createBrowseOnlyState(
  selections: BrowseSelectionInput[],
  seedText = "",
): CanonicalRequestState {
  const understanding = understandRequest({
    rawInput: seedText || " ",
  });
  let state = buildCanonicalRequestState({
    understanding,
    lastUserAction: "browse",
    progressiveReset: true,
  });

  for (const sel of selections) {
    state = applyBrowseSelectionToState(state, sel);
  }

  // Ensure product type for TV browse-only demos when selected via taxonomy id
  const composed = composeNaturalRequestText(state);
  return {
    ...state,
    lastComposedText: composed,
    naturalTextDirty: false,
  };
}

/**
 * Text-only: understand + build (no browse).
 */
export function createTextOnlyState(rawText: string): CanonicalRequestState {
  const { state } = syncFromText(null, rawText);
  const composed = composeNaturalRequestText(state);
  return {
    ...state,
    lastComposedText: composed,
    naturalTextDirty: false,
  };
}
