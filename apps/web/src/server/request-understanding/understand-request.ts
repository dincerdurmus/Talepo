/**
 * Server entry for canonical request understanding.
 * Re-exports the pure orchestrator for future API / server consumers.
 */
export {
  understandRequest,
  type UnderstandRequestInput,
} from "@/lib/request-understanding/understand-request";
export {
  toStrategyContext,
  toProductIdentityInput,
  toLegacyFormHints,
} from "@/lib/request-understanding/adapters";
export type { RequestUnderstandingResult } from "@/lib/request-understanding/types";
