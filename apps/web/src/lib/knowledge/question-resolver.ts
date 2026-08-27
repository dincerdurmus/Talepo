/**
 * Dynamic question resolver — WHAT TO ASK NEXT.
 * Does not invent intent; reads schema + current explicit/known values.
 * ANY / NOT_APPLICABLE sentinels are treated as filled (not missing).
 */

import { isExplicitBrowseField } from "./browse";
import { isInferenceOnlyInBag } from "./inference-marker";
import {
  getConditionalFields,
  getMissingRequiredFields,
  getNextMissingFields,
  getOptionalFields,
  getRequiredFields,
  resolveRequestSchema,
  type ResolveRequestSchemaInput,
} from "./request-schema";
import type { KnowledgeField } from "./types";

export type QuestionResolverState = ResolveRequestSchemaInput & {
  /** Keys filled by free-text EXPLICIT extraction (Single Brain). */
  explicitKeys?: string[];
};

export type QuestionResolverResult = {
  known: string[];
  missingRequired: KnowledgeField[];
  optionalUseful: KnowledgeField[];
  conditionalActive: KnowledgeField[];
  next: KnowledgeField[];
};

/**
 * DEĞER TAŞIMAYAN CEVAP BURADA YENİDEN TANIMLANMAZ (D3f Dilim 1).
 *
 * Burada eskiden `isAnyOrNa` adlı üçüncü bir "cevap sayılır mı" listesi
 * vardı ve kararı SENTINEL DİZESİNDEN ("__ANY__", "farketmez") veriyordu.
 * O liste kanonik durumdan bağımsızdı: açık kullanıcı kaynaklı `UNKNOWN` —
 * yani "Bilmiyorum" — hiçbir dizeye karşılık gelmediği için burada asla
 * cevap sayılamıyordu.
 *
 * Karar artık tek kanonik yardımcıda (`isDeliberateNonValueAnswer`) verilir
 * ve buraya İKİ mevcut kanaldan ulaşır: çağıran `explicitKeys` listesiyle,
 * ya da torbadaki açık-cevap işaretiyle (`__explicit__<key>`). Bu modül
 * kanonik alan durumunu görmez, bu yüzden kendi kopyasını kurmaz.
 */
function isKnown(
  values: Record<string, string | undefined>,
  key: string,
  explicitKeys: Set<string>,
): boolean {
  if (explicitKeys.has(key)) return true;
  if (isExplicitBrowseField(values, key)) return true;
  const v = values[key];
  // Çıkarımla dolmuş alan BİLİNİYOR sayılmaz (KB-17): değer koşullar için
  // torbada kalır, ama soruyu kapatacak cevap yerine geçemez.
  if (isInferenceOnlyInBag(values, key)) return false;
  return v != null && String(v).trim().length > 0;
}

export function resolveNextQuestions(
  state: QuestionResolverState,
): QuestionResolverResult {
  const values = state.values ?? {};
  const explicitKeys = new Set(state.explicitKeys ?? []);
  const schema = resolveRequestSchema(state);

  const known = schema.fields
    .filter((f) => isKnown(values, f.key, explicitKeys))
    .map((f) => f.key);

  // Treat explicit (text or browse) + ANY/NA as filled so they are not re-asked
  const valuesWithExplicit: Record<string, string | undefined> = { ...values };
  for (const key of known) {
    if (!valuesWithExplicit[key]?.trim()) {
      valuesWithExplicit[key] = values[key] ?? "__KNOWN__";
    }
  }

  const input: ResolveRequestSchemaInput = {
    ...state,
    values: valuesWithExplicit,
  };

  const missingRequired = getMissingRequiredFields(input);
  const optionalUseful = getOptionalFields(input).filter(
    (f) => !isKnown(values, f.key, explicitKeys),
  );
  // Return a small ranking pool; the UI authority performs the final top-3
  // selection. Limiting here hid useful category fields such as automotive
  // fuel and transmission before they could be prioritized.
  /* Değer taşımayan cevaplar `known` üzerinden zaten `__KNOWN__` işaretiyle
   * doldurulmuş torbaya girer; `getNextMissingFields` onları eksik saymaz.
   * Burada ikinci bir sentinel süzgeci tutulmaz. */
  const next = getNextMissingFields(input, 8);

  return {
    known,
    missingRequired,
    optionalUseful,
    conditionalActive: getConditionalFields(input),
    next,
  };
}

export {
  resolveRequestSchema,
  getRequiredFields,
  getOptionalFields,
  getMissingRequiredFields,
  getNextMissingFields,
  getConditionalFields,
};
