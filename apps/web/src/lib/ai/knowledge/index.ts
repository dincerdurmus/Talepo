import {
  resolveRequestCategory,
  getVisibleCategoryFields,
  withCategoryFieldDefaults,
} from "@/lib/request-category-engine";

import type { KnowledgeResult, ParsedRequest } from "../types";

export function runKnowledgeEngine(
  request: ParsedRequest
): KnowledgeResult {
  const notes: string[] = [];
  const suggestions: string[] = [];
  const category = resolveRequestCategory(request.categoryId);
  const commonFieldKeys = new Set(category.commonFields.map((field) => field.key));

  if (request.categoryId === "printing") {
    notes.push("Matbaa taleplerinde ölçü, malzeme ve baskı türü fiyatı doğrudan etkiler.");

    if (!request.attributes.dimensions) {
      suggestions.push("Net fiyat için ürün ölçüsünü ekleyin.");
    }

    if (!request.attributes.material) {
      suggestions.push("Karton veya kâğıt türünü belirtin.");
    }
  }

  if (request.categoryId === "automotive") {
    const needType = String(request.attributes.needType ?? "vehicle");

    if (needType === "part" || needType === "tire") {
      notes.push(
        "Yedek parça taleplerinde model yılı ve şasi bilgisi uyumluluk riskini azaltır.",
      );
      if (!request.attributes.part) {
        suggestions.push("Aradığınız parçayı açıkça belirtin.");
      }
    } else if (needType === "service") {
      notes.push("Servis taleplerinde marka, model ve yapılacak işlem netleştikçe teklifler hızlanır.");
      if (!request.attributes.serviceType) {
        suggestions.push("İstediğiniz bakım / servis işlemini yazın.");
      }
    } else {
      notes.push(
        "Araç satın alma taleplerinde marka, model, yıl ve kasa durumu eşleşmeyi güçlendirir.",
      );
      if (!request.attributes.condition && !request.attributes.bodyCondition) {
        suggestions.push("Sıfır / ikinci el veya kasa durumunu belirtin.");
      }
    }

    if (!request.attributes.modelYear) {
      suggestions.push("Araç model yılını ekleyin.");
    }
  }

  if (request.categoryId === "real-estate") {
    notes.push("Emlak taleplerinde konum, oda sayısı ve ilan türü eşleşmeyi belirler.");

    if (!request.attributes.location) {
      suggestions.push("Mahalle, cadde veya semt bilgisini ekleyin.");
    }

    if (!request.attributes.listingType) {
      suggestions.push("Kiralık mı satılık mı olduğunu belirtin.");
    }
  }

  if (request.categoryId === "furniture") {
    notes.push(
      "Mobilya taleplerinde ürün türü, adet, malzeme ve montaj bilgisi teklif kalitesini yükseltir."
    );

    if (!request.attributes.furnitureType) {
      suggestions.push("Masa, sandalye veya diğer ürün türünü seçin.");
    }

    if (!request.attributes.material) {
      suggestions.push("Malzeme tercihini belirtin (MDFLAM, mesh, metal…).");
    }

    if (!request.attributes.assembly) {
      suggestions.push("Montajın dahil olup olmayacağını yazın.");
    }
  }

  if (commonFieldKeys.has("city") && !request.city) {
    suggestions.push(
      request.categoryId === "real-estate"
        ? "Şehir veya ilçe bilgisini ekleyin."
        : "Teslimat şehrini ekleyin."
    );
  }

  if (commonFieldKeys.has("delivery") && !request.deliveryDays) {
    suggestions.push(
      request.categoryId === "technology"
        ? "Proje süresini belirtin."
        : "İstenen teslim süresini belirtin."
    );
  }

  const attrValues = withCategoryFieldDefaults(
    request.categoryId,
    Object.fromEntries(
      Object.entries(request.attributes).map(([key, value]) => [
        key,
        value == null ? "" : String(value),
      ]),
    ),
  );
  const visibleFields = getVisibleCategoryFields(
    category.fields,
    attrValues,
    request.categoryId,
  );

  const signals: boolean[] = [];

  if (commonFieldKeys.has("quantity")) {
    signals.push(Boolean(request.quantity));
  }
  if (commonFieldKeys.has("city")) {
    signals.push(Boolean(request.city?.trim()));
  }
  if (commonFieldKeys.has("delivery")) {
    signals.push(Boolean(request.deliveryDays));
  }
  if (commonFieldKeys.has("budget")) {
    signals.push(
      request.budget != null || Boolean(request.budgetDisplay?.trim()),
    );
  }

  for (const field of visibleFields) {
    signals.push(Boolean(attrValues[field.key]?.trim()));
  }

  const confidence =
    signals.length === 0
      ? request.rawText.trim().length >= 8
        ? 70
        : 20
      : Math.round(
          (signals.filter(Boolean).length / signals.length) * 100,
        );

  const capped =
    request.categoryConfident === false
      ? Math.min(confidence, 35)
      : confidence;

  if (request.categoryConfident === false) {
    notes.push(
      "Kategori henüz net değil — birkaç seçenekle birlikte netleştirebiliriz.",
    );
  }

  return {
    categoryId: request.categoryId,
    confidence: Math.min(100, Math.max(0, capped)),
    notes,
    suggestions,
  };
}
