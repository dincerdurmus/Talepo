import type { CompletenessBreakdown } from "@/lib/price-intelligence/strategy-completeness";

export type RequestReadinessState = "READY" | "ENRICHABLE" | "BLOCKED";

export type RequestReadiness = {
  state: RequestReadinessState;
  message: string;
  blockedReason?: string;
};

export function computeRequestReadiness(input: {
  hasTitle: boolean;
  budgetRequired: boolean;
  hasBudget: boolean;
  locationBlocked: boolean;
  locationBlockedReason?: string;
  missingRequiredPublishFields: string[];
  enrichableCount: number;
  completeness: CompletenessBreakdown | null;
}): RequestReadiness {
  if (!input.hasTitle) {
    return {
      state: "BLOCKED",
      message: "Talebinizi yayınlamak için bir bilgiye daha ihtiyacımız var.",
      blockedReason: "Talep başlığı gerekli",
    };
  }

  if (input.budgetRequired && !input.hasBudget) {
    return {
      state: "BLOCKED",
      message: "Talebinizi yayınlamak için bir bilgiye daha ihtiyacımız var.",
      blockedReason: "Bütçenizi belirtmeniz yeterli",
    };
  }

  if (input.locationBlocked) {
    return {
      state: "BLOCKED",
      message: "Talebinizi yayınlamak için bir bilgiye daha ihtiyacımız var.",
      blockedReason: input.locationBlockedReason ?? "Konum bilgisi gerekli",
    };
  }

  if (input.missingRequiredPublishFields.length > 0) {
    return {
      state: "BLOCKED",
      message: "Talebinizi yayınlamak için bir bilgiye daha ihtiyacımız var.",
      blockedReason: input.missingRequiredPublishFields[0],
    };
  }

  if (input.enrichableCount > 0) {
    return {
      state: "ENRICHABLE",
      message:
        "Talebiniz hazır. Birkaç detay daha ekleyerek daha iyi teklifler alabilirsiniz.",
    };
  }

  return {
    state: "READY",
    message: "Talebiniz yayına hazır.",
  };
}
