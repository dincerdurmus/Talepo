/**
 * AI Offer Assistant — provider boundary (no external LLM in this phase).
 *
 * TEK INTELLIGENCE CORE (FD-3 kurucu kararı, 2026-08-31): taslak ve fiyat
 * mantığı `@/lib/ai/offer-assistant` çekirdeğinden TÜRER. Bu sağlayıcı
 * yalnız teklif-bağlamı giriş yüzeyinin uyarlayıcısıdır; ikinci bir şablon
 * ya da ayrı fiyat metni kuramaz (verify-offer-draft-lock-v1 bunu ölçer).
 * Panel bağlamının canonical yüzeyi /api/ai/offer-assistant aynı çekirdeği
 * kullanır; UI bağlama göre farklı kalabilir, beyin tektir.
 */
import {
  formatTry,
  generateOfferAssistantDraft,
} from "@/lib/ai/offer-assistant";

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
    const core = generateOfferAssistantDraft({
      title: input.requestTitle,
      description: input.requestDescription,
      // Teklif bağlamı slug taşımaz; çekirdek kategori bilinmediğinde
      // temkinli genel tabanıyla üretir — ikinci bir fiyat kuralı yazılmaz.
      categorySlug: "",
      categoryName: input.categoryName ?? "Genel",
    });

    const draft = input.existingDraft?.trim()
      ? `${input.existingDraft.trim()}\n\n${core.description}`
      : core.description;

    return {
      ok: true,
      draft,
      pricingHint: `${core.pricingExplanation} Önerilen aralık: ${formatTry(core.priceMin)} – ${formatTry(core.priceMax)}.`,
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
