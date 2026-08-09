import type { ParsedRequest } from "../types";
import { detectCategoryId } from "./category";
import {
  detectAttributes,
  detectBudget,
  detectCity,
  detectDeliveryDays,
  detectQuantity,
} from "./entity";

export function parseRequest(text: string): ParsedRequest {
  const categoryId = detectCategoryId(text);
  const quantity = detectQuantity(text, categoryId);
  const attributes = detectAttributes(text, categoryId);

  if (categoryId === "automotive" && !attributes.needType) {
    attributes.needType = "vehicle";
  }
  if (categoryId === "machinery" && !attributes.needType) {
    attributes.needType = "machine";
  }
  if (categoryId === "technology" && !attributes.needType) {
    attributes.needType = "software";
  }

  return {
    rawText: text,
    categoryId,
    subcategory: resolveSubcategory(categoryId, attributes),
    quantity: quantity.quantity,
    unit: quantity.unit,
    city: detectCity(text),
    deliveryDays: detectDeliveryDays(text, categoryId),
    budget: detectBudget(text),
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
