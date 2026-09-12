import { getBuiltInCategoryById, type RequestCategory } from "@/lib/request-category-engine";
import { withoutRejectedRequestClauses } from "@/lib/ai/parser/negation";
import type { CanonicalRequestState } from "./types";

const common = new Set(["title", "city", "budget", "quantity", "delivery"]);
const fold = (value: string) => value.toLocaleLowerCase("tr-TR").normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/ı/g, "i");

/** Apply operational availability after language understanding, without mutating
 * the global taxonomy. Custom categories use the existing minimal question schema. */
export function applyCategoryAvailability(state: CanonicalRequestState | null, categories?: readonly RequestCategory[], selectedId?: string | null): CanonicalRequestState | null {
  if (!state || !categories) return state;
  const selected = categories.find((category) => category.id === selectedId);
  const text = ` ${fold(withoutRejectedRequestClauses(state.understanding.rawInput)).replace(/[^a-z0-9]+/g, " ")} `;
  const matches = categories.filter((category) => !getBuiltInCategoryById(category.id) && text.includes(` ${fold(category.label).replace(/[^a-z0-9]+/g, " ")} `));
  const current = categories.find((category) => category.id === state.categoryId);
  const explicit = selected ?? (state.lastUserAction === "browse" ? current : undefined);
  const custom = explicit ? (!getBuiltInCategoryById(explicit.id) ? explicit : null) : matches.length === 1 ? matches[0] : null;
  if (!custom && (!state.categoryId || categories.some((category) => category.id === state.categoryId))) return state;
  const id = custom?.id ?? "";
  const fields = Object.fromEntries(Object.entries(state.fields).filter(([key]) => common.has(key)));
  return {
    ...state, fields, categoryId: id || null, subcategorySlug: null, taxonomyNodeId: null,
    lastComposedText: state.understanding.rawInput,
    understanding: {
      ...state.understanding,
      category: { value: id, status: id ? "CONFIDENT" : "UNKNOWN", confidence: id ? 1 : 0, evidence: ["public-category-availability"] },
      subject: { kind: { value: "UNKNOWN", status: "UNKNOWN", confidence: 0, evidence: [] } },
      requestSubject: { kind: { value: "UNKNOWN", status: "UNKNOWN", confidence: 0, evidence: [] } },
      attributes: {}, identity: {}, resolvedEntities: [], preferences: {}, constraints: undefined, condition: undefined,
    },
  };
}
