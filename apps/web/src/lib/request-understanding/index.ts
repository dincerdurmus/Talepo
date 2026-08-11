export type * from "./types";
export {
  understandRequest,
  emptyRequestUnderstanding,
  getUnderstandCallCount,
  resetUnderstandCallCount,
} from "./understand-request";
export type { UnderstandRequestInput } from "./understand-request";
export {
  extractConstraintSemantics,
  toConstraintMatchContract,
  toConstraintFilterContract,
  type ConstraintStrength,
  type FieldConstraintSemantics,
  type ConstraintBundle,
  type ConstraintMatchContract,
  type ConstraintFilterContract,
} from "./constraint-semantics";
export {
  toStrategyContext,
  toProductIdentityInput,
  toLegacyFormHints,
} from "./adapters";
export {
  resolveSchemaCategory,
  seedFieldValuesFromUnderstanding,
  buildUnderstandingSummary,
  safeDraftAttributes,
  strategyResolutionFromUnderstanding,
  completenessFromUnderstanding,
} from "./activation-bridge";
export {
  toMatchingEstimateInput,
  toPriceCanonicalHints,
  type CanonicalRequestContext,
  type MatchingEstimateInput,
} from "./consumer-adapters";
export {
  resolveSemanticSubject,
  reconcileParentIdentityTokens,
  dedupeAdjacentTokens,
  relationshipLabel,
} from "./semantic-subject";
export { classifyNumbers } from "./number-role";
export { collectIntentSignals, resolveIntentFromSignals } from "./intent-signals";
export { normalizeUnderstandingInput } from "./normalize";
