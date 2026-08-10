import { normalizeCasualTurkish } from "@/lib/ai/parser/normalize-casual-tr";

/** Light normalization — preserves model tokens; does not invent meaning. */
export function normalizeUnderstandingInput(raw: string): string {
  return normalizeCasualTurkish(raw).replace(/\s+/g, " ").trim();
}
