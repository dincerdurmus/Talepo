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
 * Skips re-parse when input equals last composed output (loop prevention).
 */
export function syncFromText(
  previous: CanonicalRequestState | null | undefined,
  rawText: string,
  opts?: { structured?: UnderstandRequestInput["structured"] },
): SyncFromTextResult {
  const text = rawText ?? "";
  if (
    previous?.lastComposedText &&
    normalizeComparable(text) === normalizeComparable(previous.lastComposedText)
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

  const understanding = understandRequest({
    rawInput: text,
    structured: opts?.structured,
  });

  const state = buildCanonicalRequestState({
    understanding,
    lastUserAction: "text",
    previous: previous ?? null,
    progressiveReset: true,
  });

  // Progressive: obsolete inferred cleared by full rebuild from new understanding
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
