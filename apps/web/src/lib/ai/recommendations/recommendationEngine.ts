import { isValidRealEstateLocation, parseRealEstateCity } from "@/lib/geo/turkey-districts";
import { getCategoryById } from "@/lib/request-category-engine";

import type { ParsedRequest, Recommendation } from "../types";

export function createRecommendations(
  request: ParsedRequest
): Recommendation[] {
  const recommendations: Recommendation[] = [];
  const category = getCategoryById(request.categoryId);
  const commonFieldKeys = new Set(category.commonFields.map((field) => field.key));

  if (commonFieldKeys.has("city")) {
    const needsRealEstateLocation =
      request.categoryId === "real-estate" &&
      (() => {
        const parsed = parseRealEstateCity(request.city);
        return !parsed || !isValidRealEstateLocation(parsed.il, parsed.ilce);
      })();

    if (needsRealEstateLocation) {
      recommendations.push({
        id: "add-city",
        title: "İl ve ilçe seçin",
        description: "Listeden il ve ilçe seçmeniz gerekir.",
        reason: "Emlak taleplerinde konum eşleşmesi için il ve ilçe zorunludur.",
        field: "city",
      });
    } else if (request.categoryId !== "real-estate" && !request.city) {
      recommendations.push({
        id: "add-city",
        title: "Teslimat şehrini ekleyin",
        description: "Firmaların lojistik maliyetini doğru hesaplamasını sağlar.",
        reason: "Konum bilgisi teklif fiyatını ve uygun firma sayısını etkiler.",
        field: "city",
      });
    }
  }

  if (commonFieldKeys.has("delivery") && !request.deliveryDays) {
    recommendations.push({
      id: "add-delivery",
      title:
        request.categoryId === "technology"
          ? "Proje süresini belirtin"
          : "Teslim süresini belirtin",
      description: "Örneğin 10 gün veya 3 hafta yazabilirsiniz.",
      reason: "Üretim planı uygun olmayan firmaların elenmesini sağlar.",
      field: "deliveryDays",
      suggestedValue: 14,
    });
  }

  if (commonFieldKeys.has("quantity") && !request.quantity) {
    recommendations.push({
      id: "add-quantity",
      title: "Miktarı belirtin",
      description: "Örneğin 50 adet veya 5.000 kg.",
      reason: "Miktar, teklif fiyatını ve uygun firma sayısını doğrudan etkiler.",
      field: "quantity",
    });
  }

  if (
    commonFieldKeys.has("budget") &&
    request.budget == null &&
    !request.budgetDisplay
  ) {
    recommendations.push({
      id: "add-budget",
      title: "Bütçe aralığı ekleyin",
      description: "Örneğin 50.000 TL veya 10–50 bin.",
      reason: "Bütçe bilgisi firmaların daha uygun teklif vermesini sağlar.",
      field: "budget",
    });
  }

  if (request.categoryId === "printing" && !request.attributes.dimensions) {
    recommendations.push({
      id: "printing-dimensions",
      title: "Ürün ölçüsünü ekleyin",
      description: "Örneğin 35x25x8 cm.",
      reason: "Kâğıt tüketimi ve kesim maliyeti ölçüye göre hesaplanır.",
      field: "dimensions",
    });
  }

  if (request.categoryId === "automotive") {
    const needType = String(request.attributes.needType ?? "vehicle");

    if (!request.attributes.modelYear) {
      recommendations.push({
        id: "automotive-year",
        title: "Model yılını ekleyin",
        description:
          needType === "part" || needType === "tire"
            ? "Parça uyumluluğunu belirgin şekilde artırır."
            : "Doğru araç ilanlarıyla eşleşmeyi hızlandırır.",
        reason:
          needType === "part" || needType === "tire"
            ? "Aynı modelin farklı yıllarında parça kodları değişebilir."
            : "Yıl bilgisi fiyat ve stok filtresini netleştirir.",
        field: "modelYear",
      });
    }

    if (
      (needType === "part" || needType === "tire") &&
      !request.attributes.part
    ) {
      recommendations.push({
        id: "automotive-part",
        title: "Parça adını ekleyin",
        description: "Örneğin ön tampon veya lastik ebatı.",
        reason: "Parça adı olmadan doğru tedarikçi eşleşmesi zorlaşır.",
        field: "part",
      });
    }
  }

  if (request.categoryId === "real-estate") {
    if (!request.attributes.location) {
      recommendations.push({
        id: "real-estate-location",
        title: "Konum veya adres ekleyin",
        description: "Örneğin Bahar Cd, Bağcılar.",
        reason: "Emlak taleplerinde doğru konum en kritik filtrelerden biridir.",
        field: "location",
      });
    }

    if (!request.attributes.roomCount) {
      recommendations.push({
        id: "real-estate-rooms",
        title: "Oda sayısını belirtin",
        description: "Örneğin 2+1 veya 3+1.",
        reason: "Oda sayısı uygun ilan eşleşmesini hızlandırır.",
        field: "roomCount",
      });
    }
  }

  if (request.categoryId === "furniture") {
    if (!request.attributes.furnitureType) {
      recommendations.push({
        id: "furniture-type",
        title: "Ürün türünü seçin",
        description: "Örneğin ofis sandalyesi veya çalışma masası.",
        reason: "Doğru ürün türü uygun mobilya firmalarını getirir.",
        field: "furnitureType",
      });
    }

    if (!request.attributes.usageArea) {
      recommendations.push({
        id: "furniture-usage",
        title: "Kullanım alanını belirtin",
        description: "Ofis, ev, kafe gibi.",
        reason: "Kullanım alanı malzeme ve model önerisini değiştirir.",
        field: "usageArea",
      });
    }

    if (!request.attributes.features && !request.attributes.dimensions) {
      recommendations.push({
        id: "furniture-details",
        title: "Ölçü veya özellik ekleyin",
        description: "Örn. 140x70 cm, kolluklu, tekerlekli, bel destekli.",
        reason: "Ölçü ve özellikler fiyat aralığını netleştirir.",
        field: "features",
      });
    }
  }

  return recommendations;
}
