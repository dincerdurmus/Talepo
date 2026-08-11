/**
 * Browse → canonical state. EXPLICIT_BROWSE with last-action precedence.
 */

import { applyBrowseSelection } from "@/lib/knowledge/browse";

import { canApplyField } from "./build-state";
import { composeNaturalRequestText } from "./compose-text";
import type {
  CanonicalFieldState,
  CanonicalRequestState,
} from "./types";
import { FIELD_SENTINEL, isAnySentinel } from "./types";

export type BrowseSelectionInput = {
  key: string;
  value: string;
  entityId?: string;
  /** When true, value is the ANY sentinel / Farketmez option */
  isAny?: boolean;
};

/**
 * Apply one browse selection onto hybrid state.
 * May replace INFERRED / ANY; conflicting older EXPLICIT only if last action is browse.
 */
export function applyBrowseSelectionToState(
  state: CanonicalRequestState,
  selection: BrowseSelectionInput,
): CanonicalRequestState {
  const isAny =
    selection.isAny ||
    isAnySentinel(selection.value) ||
    selection.value === FIELD_SENTINEL.ANY;

  const incoming: CanonicalFieldState = isAny
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

  // Keep a parallel bag for knowledge applyBrowseSelection / enrichment guards
  const bag = applyBrowseSelection(
    {},
    {
      key: selection.key,
      value: isAny ? FIELD_SENTINEL.ANY : selection.value,
      entityId: selection.entityId,
    },
  );

  const next: CanonicalRequestState = {
    ...state,
    fields,
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
 * Apply multiple browse selections (e.g. browse-only flow).
 */
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
