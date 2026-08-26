/**
 * /TALEP SAYFA GİRDİLERİNİN TEK KURUCUSU — DOĞRULAYICI ORTAK KÜTÜPHANESİ
 * (D3c-a, 2026-08-27).
 *
 * Neden tek modül: bu kurulum daha önce
 * `verify-inference-confirmation-priority-v1` içinde private
 * `productionInputs` olarak duruyordu. Yayın kanalı doğrulayıcısı da aynı
 * kuruluma ihtiyaç duyunca iki seçenek vardı: kopyalamak ya da çıkarmak.
 * Kopyalanan kurulum iki doğrulayıcının sessizce ayrışmasına yol açardı —
 * soru dalgası yürüyücüsünde (`question-wave-walk-v1`) yaşanan durumun aynısı.
 * Bu yüzden mantık buraya taşındı; iki doğrulayıcı da BURAYI kullanır ve
 * ikinci kopya bırakılmaz. Taşıma sırasında davranış DEĞİŞTİRİLMEMİŞTİR.
 *
 * Burada hiçbir seçim, sıralama ya da görünürlük kararı ÜRETİLMEZ; her satır
 * `page.tsx`in çağırdığı üretim fonksiyonunun aynısını çağırır:
 *
 *   strategy            ← `strategyResolutionFromUnderstanding(...).strategy`
 *   completeness        ← `completenessFromUnderstanding(...)`
 *   dynamicFields       ← `getVisibleCategoryFields(...)`
 *   requiredDynamicKeys ← `isFieldRequired(...)` süzgeci
 *
 * Değer torbası da elle kurulmaz: besteci durumundan `softFillFromComposerState`
 * ile okunur ve `withCategoryFieldDefaults` ile tamamlanır — ikisi de üretim
 * fonksiyonudur. Bu ölçüm SERBEST METİNden gelen talebi modeller: kullanıcının
 * elle yazdığı form değerleri, gezinme seçimi ve kategori kilidi yoktur, bu
 * yüzden `page.tsx`in bu üç kaynağı birleştiren React katmanı devrede değildir.
 */

import type {
  HybridQuestionResult,
  ResolveHybridQuestionsOptions,
} from "../../src/lib/request-composer/questions";
import {
  softFillFromComposerState,
  type RenderableCandidateInput,
} from "../../src/lib/request-composer/ui-helpers";
import type { CanonicalRequestState } from "../../src/lib/request-composer/types";
import {
  getVisibleCategoryFields,
  isFieldRequired,
  resolveRequestCategory,
  withCategoryFieldDefaults,
  type DynamicField,
} from "../../src/lib/request-category-engine";
import {
  completenessFromUnderstanding,
  strategyResolutionFromUnderstanding,
} from "../../src/lib/request-understanding/activation-bridge";

export type TalepProductionInputs = {
  options: ResolveHybridQuestionsOptions;
  /** `page.tsx`in `filterRenderableCandidates`e geçirdiği girdiyi kurar. */
  renderInputWithout: (result: HybridQuestionResult) => RenderableCandidateInput;
  /** Üretim değer torbası (`dynamicValues` eşleniği) — serbest metin modeli. */
  values: Record<string, string>;
  /** Kategorinin o anki görünür dinamik alanları. */
  dynamicFields: DynamicField[];
  categoryId: string | null;
};

export function productionInputs(
  state: CanonicalRequestState,
  requestText: string,
): TalepProductionInputs {
  const understanding = state.understanding;
  const categoryId =
    state.categoryId ?? understanding.category.value ?? null;
  const category = resolveRequestCategory(categoryId);
  const values = withCategoryFieldDefaults(
    categoryId ?? "",
    softFillFromComposerState(state),
  );
  const dynamicFields = getVisibleCategoryFields(
    category.fields,
    values,
    categoryId ?? undefined,
    {
      subcategorySlug: state.subcategorySlug,
      taxonomyNodeId: state.taxonomyNodeId,
    },
  );
  const strategy = strategyResolutionFromUnderstanding(understanding).strategy;
  const visibleCommonFieldKeys = new Set(
    category.commonFields.map((field) =>
      typeof field === "string" ? field : (field as { key: string }).key,
    ),
  );
  const understandingCity = understanding.location?.city?.value ?? "";
  const isRealEstate = categoryId === "real-estate";
  return {
    options: {
      strategy,
      completeness: completenessFromUnderstanding(understanding, values),
      dynamicFields,
      requiredDynamicKeys: dynamicFields
        .filter((field) => isFieldRequired(field, values))
        .map((field) => field.key),
    },
    renderInputWithout: (result) => ({
      hybridQuestionResult: result,
      visibleDynamicFields: dynamicFields,
      missingFields: dynamicFields.filter(
        (field) =>
          isFieldRequired(field, values) && !values[field.key]?.trim(),
      ),
      dynamicValues: values,
      requestText,
      activeCategoryId: categoryId ?? "",
      isRealEstate,
      realEstateLocationMissing: false,
      visibleCommonFieldKeys,
      mergedCommonDraft: { city: understandingCity },
      understandingCity,
      budgetRequired: visibleCommonFieldKeys.has("budget"),
      hasBudget: false,
      strategy,
      canonicalFields: state.fields,
    }),
    values,
    dynamicFields,
    categoryId: typeof categoryId === "string" ? categoryId : null,
  };
}
