import type { ParsedRequest } from "../types";
import { detectCategoryResult } from "./category";
import { extractBudgetFromText } from "./budget";
import {
  detectAttributes,
  detectCity,
  detectDeliveryDays,
  detectQuantity,
} from "./entity";
import { normalizeCasualTurkish } from "./normalize-casual-tr";

/**
 * @deprecated Prefer `understandRequest()` for request workflows.
 * Remaining use: offer-assistant paste parsing (non-canonical product path).
 */
export function parseRequest(text: string): ParsedRequest {
  const normalizedText = normalizeCasualTurkish(text);
  const detection = detectCategoryResult(normalizedText);
  const categoryId = detection.categoryId;
  const quantity = detectQuantity(normalizedText, categoryId);
  const attributes = detectAttributes(normalizedText, categoryId);
  const budget = extractBudgetFromText(normalizedText);

  if (categoryId === "automotive" && !attributes.needType) {
    attributes.needType = "vehicle";
  }
  if (categoryId === "machinery" && !attributes.needType) {
    attributes.needType = "machine";
  }
  if (categoryId === "technology" && !attributes.needType) {
    // Free-text purchase phrases are usually hardware, not software projects
    const purchaseIntent =
      /arıyorum|ariyorum|lazım|lazim|bakıyorum|bakiyorum|istiyorum/.test(
        normalizedText,
      );
    attributes.needType = purchaseIntent ? "hardware" : "software";
  }

  return {
    rawText: text,
    categoryId,
    categoryScore: detection.score,
    categoryConfident: detection.confident,
    subcategory: resolveSubcategory(categoryId, attributes),
    quantity: quantity.quantity,
    unit: quantity.unit,
    city: detectCity(normalizedText),
    deliveryDays: detectDeliveryDays(normalizedText, categoryId),
    budget: budget?.amount,
    budgetDisplay: budget?.display,
    attributes,
  };
}

function resolveSubcategory(
  categoryId: string,
  attributes: Record<string, string | number | boolean>,
): string | undefined {
  const needType = String(attributes.needType ?? "");

  if (categoryId === "automotive") {
    if (needType === "vehicle") return "Araç Satın Alma";
    if (needType === "part") return "Yedek Parça";
    if (needType === "service") return "Araç Bakım";
    if (needType === "tire") return "Lastik ve Jant";
  }

  if (categoryId === "machinery") {
    if (needType === "machine") return "Üretim Makinesi";
    if (needType === "part") return "Yedek Parça";
    if (needType === "service") return "Diğer";
  }

  if (categoryId === "technology") {
    if (needType === "software") return "Yazılım Geliştirme";
    if (needType === "hardware") return "Donanım";
    if (needType === "service") return "Sistem ve Altyapı";
  }

  return undefined;
}
