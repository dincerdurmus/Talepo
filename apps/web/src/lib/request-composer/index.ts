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
  isGenericCompatibilityNoun,
  stripRequestedItemClause,
} from "./attribute-hints";

export {
  mapUnderstandingToFields,
  mergeBrowseFieldBag,
  mergePreservedBrowseFields,
  applyConstraintBundleToFields,
  canApplyField,
  buildCanonicalRequestState,
  toResolverFieldBag,
  getFieldKind,
} from "./build-state";

export { resolveBrowsePath } from "./resolve-browse-path";

export {
  applyBrowseSelectionToState,
  applyBrowseSelectionsToState,
  pinBrowseSemanticContext,
  type BrowseSelectionInput,
} from "./apply-browse";

export {
  resolveBrowseSemanticRole,
  isCompatibilityBrowseRole,
  type BrowseSemanticRole,
} from "./browse-semantic-role";

export {
  composeNaturalRequestText,
  composeTextFromBrowseStack,
} from "./compose-text";

export {
  syncFromText,
  syncFromBrowse,
  createBrowseOnlyState,
  createTextOnlyState,
  type SyncFromTextResult,
  type SyncFromBrowseResult,
} from "./sync";

export {
  isMaterialRequestTransition,
  resolveTextSyncAuthority,
  shouldCarryBrowseNeedPin,
  isFieldCompatibleWithCategory,
  stripIncompatibleDomainFields,
  shouldSkipTextWalkRealign,
  type RequestSyncAuthority,
} from "./request-transition";

export {
  resolveHybridQuestions,
  type HybridQuestionResult,
  type ResolveHybridQuestionsOptions,
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
  understoodFactsToSummaryChips,
  softFillFromComposerState,
  buildQuickSelectGroups,
  createBrowseWalkState,
  listBrowseOptions,
  listBrowseCascadeColumns,
  advanceBrowseWalk,
  selectBrowseWalkAtColumn,
  browseWalkFromPath,
  runHybridUiAcceptancePath,
  applyTextThenBrowse,
  filterRenderableCandidates,
  resolveQuestionDraftPresentation,
  isUnconfirmedInferredValue,
  buildPublishFieldValues,
  type PublishFieldValuesInput,
} from "./ui-helpers";
