import type { QuestionCandidate } from "./types";

/** Strategy-driven smart nudge — no hardcoded product names */
export function buildSmartNudge(question: QuestionCandidate | null): string | null {
  if (!question) return null;

  const templates: Record<string, string> = {
    modelYear: "Model yılını eklerseniz araç teklifleri daha doğru eşleşebilir.",
    mileage: "Kilometre tercihiniz satıcıların doğru teklif vermesine yardımcı olur.",
    condition: "Durum bilgisi fiyat karşılaştırmasını daha doğru hale getirir.",
    specs: "Teknik özellikler teklif kalitesini artırabilir.",
    solutionType: "Ürün detayı satıcıların ihtiyacınızı daha iyi anlamasına yardımcı olur.",
    dimensions: "Ölçü bilgisi fiyat tekliflerini ciddi şekilde netleştirir.",
    material: "Malzeme tercihi baskı tekliflerinin doğruluğunu artırır.",
    quantity: "Miktar bilgisi toplu fiyat tekliflerini kolaylaştırır.",
    area: "Metrekare bilgisi emlak tekliflerini daha isabetli hale getirir.",
    roomCount: "Oda sayısı eşleşen ilanları daha doğru filtreler.",
    scope: "Kapsam detayı hizmet tekliflerinin netliğini artırır.",
    city: "Konum bilgisi size yakın satıcılardan teklif almanızı sağlar.",
  };

  return (
    templates[question.fieldKey] ??
    `${question.label} eklemek daha doğru teklifler almanıza yardımcı olabilir.`
  );
}
