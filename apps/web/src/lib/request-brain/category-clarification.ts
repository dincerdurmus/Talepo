import type { ClarificationOption } from "@/components/request/TalepoAiPanel";

/**
 * Generic clarification prompts when category detection is not confident.
 * Options are category-level (not brand-specific production hacks).
 */
export function buildCategoryClarification(input: {
  rawText: string;
  categoryId: string;
  categoryConfident: boolean;
}): { prompt: string; options: ClarificationOption[] } | null {
  if (input.categoryConfident) return null;

  const text = input.rawText.toLocaleLowerCase("tr-TR");
  const purchaseIntent =
    /arıyorum|ariyorum|lazım|lazim|bakıyorum|bakiyorum|istiyorum|gerek/.test(
      text,
    );

  if (!purchaseIntent && input.categoryId === "services") {
    return {
      prompt: "Ne aradığınızı bir seçenekle netleştirebilir misiniz?",
      options: [
        { id: "product", label: "Bir ürün", categoryId: "appliances" },
        { id: "service", label: "Bir hizmet", categoryId: "services" },
        { id: "vehicle", label: "Araç", categoryId: "automotive" },
        { id: "estate", label: "Emlak", categoryId: "real-estate" },
        { id: "other", label: "Diğer", categoryId: "services" },
      ],
    };
  }

  // Product-seeking without clear family
  if (purchaseIntent) {
    return {
      prompt:
        "Bir ürün aradığınızı anladım. Hangisine daha yakın?",
      options: [
        {
          id: "floorcare",
          label: "Dikey / robot süpürge",
          categoryId: "appliances",
        },
        {
          id: "appliance",
          label: "Beyaz eşya",
          categoryId: "appliances",
        },
        {
          id: "kitchen",
          label: "Mutfak / kahve",
          categoryId: "home-kitchen",
        },
        {
          id: "tech",
          label: "Telefon / bilgisayar",
          categoryId: "technology",
        },
        {
          id: "baby",
          label: "Bebek ürünü",
          categoryId: "baby",
        },
        { id: "other", label: "Diğer", categoryId: "appliances" },
      ],
    };
  }

  return {
    prompt: "Talebinizi hangi alana yakın görüyorsunuz?",
    options: [
      { id: "service", label: "Hizmet", categoryId: "services" },
      { id: "product", label: "Ürün", categoryId: "appliances" },
      { id: "estate", label: "Emlak", categoryId: "real-estate" },
      { id: "print", label: "Matbaa / ambalaj", categoryId: "printing" },
      { id: "machine", label: "Makine", categoryId: "machinery" },
    ],
  };
}
