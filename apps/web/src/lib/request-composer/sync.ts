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
import { buildCanonicalRequestState } from "./build-state";
import { composeNaturalRequestText } from "./compose-text";
import type { CanonicalRequestState } from "./types";

export type SyncFromTextResult = {
  state: CanonicalRequestState;
  skipped: boolean;
  reason?: string;
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
  const browseNeed =
    previous?.fields.needType?.provenance === "EXPLICIT_BROWSE" &&
    previous.fields.needType.kind === "VALUE" &&
    previous.fields.needType.value
      ? String(previous.fields.needType.value).toLowerCase()
      : null;
  const subjectKind =
    previous?.understanding.requestSubject.kind.value ?? null;
  const subjectMatchesBrowseNeed = (() => {
    if (!browseNeed) return true;
    if (browseNeed === "part" || browseNeed === "tire") {
      return subjectKind === "PART" || subjectKind === "ACCESSORY";
    }
    if (browseNeed === "vehicle") return subjectKind === "VEHICLE";
    if (browseNeed === "service") return subjectKind === "SERVICE";
    if (browseNeed === "machine") {
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
    };
  }

  // Carry EXPLICIT_BROWSE needType / category into the sole brain so
  // brand+model sentences cannot collapse PART → VEHICLE.
  const structured: UnderstandRequestInput["structured"] = {
    ...opts?.structured,
    categoryId:
      opts?.structured?.categoryId ?? previous?.categoryId ?? undefined,
    fieldValues: {
      ...opts?.structured?.fieldValues,
      ...(browseNeed
        ? { needType: browseNeed }
        : {}),
    },
  };

  const understanding = understandRequest({
    rawInput: text,
    structured,
  });

  let state = buildCanonicalRequestState({
    understanding,
    lastUserAction: "text",
    previous: previous ?? null,
    progressiveReset: true,
  });

  // Keep browse-pinned subcategory + needType authoritative after re-parse.
  if (previous?.fields.needType?.provenance === "EXPLICIT_BROWSE") {
    state = {
      ...state,
      subcategorySlug: previous.subcategorySlug ?? state.subcategorySlug,
      categoryId: previous.categoryId ?? state.categoryId,
      taxonomyNodeId: previous.taxonomyNodeId ?? state.taxonomyNodeId,
      fields: {
        ...state.fields,
        needType: previous.fields.needType,
      },
    };
  }

  return { state, skipped: false };
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
