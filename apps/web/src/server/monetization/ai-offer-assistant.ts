/**
 * AI Offer Assistant — provider boundary (no external LLM in this phase).
 */
export type OfferAssistantInput = {
  requestTitle: string;
  requestDescription: string;
  categoryName?: string;
  existingDraft?: string;
};

export type OfferAssistantResult = {
  ok: boolean;
  draft?: string;
  pricingHint?: string;
  provider: "rule-based-stub";
  message?: string;
};

export interface OfferAssistantProvider {
  generateDraft(input: OfferAssistantInput): Promise<OfferAssistantResult>;
}

class RuleBasedOfferAssistant implements OfferAssistantProvider {
  async generateDraft(
    input: OfferAssistantInput,
  ): Promise<OfferAssistantResult> {
    const intro = input.existingDraft?.trim()
      ? input.existingDraft.trim()
      : `${input.requestTitle} talebiniz için hazırladığımız teklif:`;

    return {
      ok: true,
      draft: `${intro}\n\n• Kapsam: ${input.categoryName ?? "Genel"} kategorisinde talep edilen iş/ürün\n• Teslim: Talep detaylarına göre planlanır\n• Not: Fiyat ve süre firmanızın operasyonel koşullarına göre güncellenmelidir.`,
      pricingHint:
        "Gerçek AI fiyat önerisi bir sonraki fazda devreye alınacak. Şimdilik kategori ve talep metnine dayalı şablon üretildi.",
      provider: "rule-based-stub",
    };
  }
}

let provider: OfferAssistantProvider = new RuleBasedOfferAssistant();

export function setOfferAssistantProvider(next: OfferAssistantProvider) {
  provider = next;
}

export async function runOfferAssistant(
  input: OfferAssistantInput,
): Promise<OfferAssistantResult> {
  return provider.generateDraft(input);
}
