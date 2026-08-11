/**
 * TALEPO Hybrid Request Composer
 *
 * Bidirectional TEXT ↔ BROWSE over a single CanonicalRequestState.
 * understandRequest() remains the sole understanding authority.
 */

export type {
  FieldValueKind,
  FieldProvenance,
  LastUserAction,
  CanonicalFieldState,
  BrowsePathStep,
  CanonicalRequestState,
} from "./types";

export {
  FIELD_SENTINEL,
  isAnySentinel,
  isNotApplicableSentinel,
} from "./types";

export {
  extractFieldScopedAny,
  applyAnyBindingsToFields,
} from "./any-language";

export {
  extractScreenSize,
  extractResolution,
  extractProductTypeHint,
  cleanBrandToken,
  cleanModelToken,
} from "./attribute-hints";

export {
  mapUnderstandingToFields,
  mergeBrowseFieldBag,
  canApplyField,
  buildCanonicalRequestState,
  toResolverFieldBag,
  getFieldKind,
} from "./build-state";

export { resolveBrowsePath } from "./resolve-browse-path";

export {
  applyBrowseSelectionToState,
  applyBrowseSelectionsToState,
  type BrowseSelectionInput,
} from "./apply-browse";

export { composeNaturalRequestText } from "./compose-text";

export {
  syncFromText,
  syncFromBrowse,
  createBrowseOnlyState,
  createTextOnlyState,
  type SyncFromTextResult,
  type SyncFromBrowseResult,
} from "./sync";

export {
  resolveHybridQuestions,
  type HybridQuestionResult,
} from "./questions";

export {
  type UnderstoodFact,
  type QuickSelectOption,
  type QuickSelectGroup,
  type BrowseWalkState,
  fieldLabel,
  browseKindToFieldKey,
  browseNodeToSelection,
  buildUnderstoodFacts,
  softFillFromComposerState,
  buildQuickSelectGroups,
  createBrowseWalkState,
  listBrowseOptions,
  advanceBrowseWalk,
  runHybridUiAcceptancePath,
  applyTextThenBrowse,
} from "./ui-helpers";
