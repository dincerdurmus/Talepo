import { getCategoryById } from "@/lib/request-category-engine";

import type { KnowledgeResult, ParsedRequest } from "../types";

export function runKnowledgeEngine(
  request: ParsedRequest
): KnowledgeResult {
  const notes: string[] = [];
  const suggestions: string[] = [];
  const category = getCategoryById(request.categoryId);
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

  const completeness =
    55 +
    (commonFieldKeys.has("quantity") && request.quantity ? 8 : 0) +
    (commonFieldKeys.has("city") && request.city ? 8 : 0) +
    (commonFieldKeys.has("delivery") && request.deliveryDays ? 8 : 0) +
    (Object.keys(request.attributes).length >= 2 ? 12 : 0);

  return {
    categoryId: request.categoryId,
    confidence: Math.min(completeness, 98),
    notes,
    suggestions,
  };
}
