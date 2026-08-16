export type OfferCopilotStrategy = "CONSERVATIVE" | "BALANCED" | "AGGRESSIVE";
export type OfferCopilotContext = "PERSONAL" | "WORKSPACE";

export type OfferCopilotPrice = {
  low: number | null;
  target: number | null;
  high: number | null;
  confidence: number | null;
  reason: string;
};

export type OfferCopilotInput = {
  context: OfferCopilotContext;
  title: string;
  description: string;
  fields?: Record<string, string | number | boolean | null | undefined>;
  isUrgent?: boolean;
  opportunity?: { fit?: string; reasons?: string[]; risks?: string[]; recommendedAction?: string; inventoryFit?: string };
  price?: { marketBand?: { low: number; high: number; median?: number | null }; confidence?: number; pricePosition?: string; suggestedOfferBand?: { low: number; target: number; high: number } | null; strategy?: string; warnings?: string[] };
  inventory?: { available: boolean; fitSummary?: string; items?: string[] };
};

export type OfferCopilotResult = {
  strategy: OfferCopilotStrategy;
  fitSummary: string;
  buyerPriorities: string[];
  offerPositioning: string[];
  recommendedPrice: OfferCopilotPrice;
  scope: { included: string[]; excluded: string[] };
  delivery: { state: "KNOWN" | "ESTIMATED" | "NEEDS_CONFIRMATION"; estimate: string | null; assumptions: string[] };
  risks: string[];
  missingInformation: string[];
  draft: { title: string; message: string; price: number | null; deliveryTime: string | null; notes: string };
  confidence: number | null;
  nextBestAction: string;
  context: OfferCopilotContext;
};

function fieldText(input: OfferCopilotInput) {
  return Object.entries(input.fields ?? {}).filter(([, value]) => value != null && value !== "").map(([key, value]) => `${key}: ${value}`).join(" | ");
}

export function buildOfferCopilot(input: OfferCopilotInput): OfferCopilotResult {
  const text = `${input.title} ${input.description} ${fieldText(input)}`.toLocaleLowerCase("tr-TR");
  const priorities: string[] = [];
  if (input.isUrgent || /acil|hemen|bugün|yarın/.test(text)) priorities.push("urgent");
  if (/ucuz|bütçe|ekonomik|uygun fiyat/.test(text)) priorities.push("price-sensitive");
  if (/marka|model|seri|tam olarak/.test(text)) priorities.push("brand/model exactness");
  if (/teslim|termin|gün içinde/.test(text)) priorities.push("delivery speed");
  if (/garanti|teknik|özellik|sertifika/.test(text)) priorities.push("technical specification");
  if (/adet|quantity|miktar/.test(text)) priorities.push("quantity");

  const price = input.price?.suggestedOfferBand ?? null;
  const confidence = input.price?.confidence ?? null;
  const lowConfidence = confidence == null || confidence < 0.55;
  let strategy: OfferCopilotStrategy = input.isUrgent ? "AGGRESSIVE" : "BALANCED";
  if (lowConfidence && strategy === "AGGRESSIVE") strategy = "BALANCED";
  if (input.opportunity?.fit === "WEAK") strategy = "CONSERVATIVE";

  const deliveryKnown = Object.keys(input.fields ?? {}).some((key) => /teslim|termin|delivery/i.test(key));
  const delivery = deliveryKnown
    ? { state: "KNOWN" as const, estimate: String(Object.entries(input.fields ?? {}).find(([key]) => /teslim|termin|delivery/i.test(key))?.[1] ?? ""), assumptions: [] }
    : { state: "NEEDS_CONFIRMATION" as const, estimate: null, assumptions: ["Teslim süresi kullanıcı tarafından doğrulanmalı."] };
  const risks = [...(input.opportunity?.risks ?? []), ...(input.price?.warnings ?? [])];
  if (!input.inventory?.available && input.context === "WORKSPACE") risks.push("Uygun şirket envanteri doğrulanmadı.");
  const missing = [...(price ? [] : ["Teklif fiyatı için doğrulanmış piyasa verisi yok."]), ...(!deliveryKnown ? ["Teslim süresi"] : [])];
  const included = ["Talepte açıkça belirtilen ürün/hizmet", ...(input.inventory?.items ?? [])];
  const excluded = ["Talepte belirtilmeyen ek işler, garanti veya sertifikalar"];
  const target = price?.target ?? null;
  const reason = price ? `Piyasa bandı ${price.low}–${price.high}; mevcut güven skoru ${Math.round((confidence ?? 0) * 100)}%.` : "Fiyat uydurulmadı; doğrulanmış fiyat bilgisi gerekiyor.";
  const message = target == null
    ? `Merhaba, “${input.title}” talebiniz için kapsamı inceledim. Net fiyat ve teslim süresini doğrulamak için birkaç bilgiyi teyit etmem gerekiyor.`
    : `Merhaba, “${input.title}” talebiniz için ${strategy.toLocaleLowerCase("tr-TR")} bir teklif hazırladım. Talepte belirtilen kapsam dahildir; ek işler ayrıca teyit edilir.`;
  return {
    strategy, fitSummary: input.opportunity?.fit ? `Fırsat uyumu: ${input.opportunity.fit}.` : "Fırsat sinyali mevcut değil; değerlendirme sınırlı.",
    buyerPriorities: priorities, offerPositioning: [strategy === "CONSERVATIVE" ? "Riski ve kapsam belirsizliğini koru" : strategy === "AGGRESSIVE" ? "Hızlı ve rekabetçi aksiyon öner" : "Piyasa uyumu ile kabul olasılığını dengele"],
    recommendedPrice: { low: price?.low ?? null, target, high: price?.high ?? null, confidence, reason },
    scope: { included, excluded }, delivery, risks, missingInformation: missing,
    draft: { title: `Teklif: ${input.title}`, message, price: target, deliveryTime: delivery.estimate, notes: [...excluded, ...risks].join(" ") },
    confidence, nextBestAction: missing.length ? "Eksik bilgileri doğrula ve taslağı kullanıcı onayına sun." : "Taslağı gözden geçirip teklif formuna uygula.", context: input.context,
  };
}
