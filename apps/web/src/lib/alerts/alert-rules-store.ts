/**
 * Alert rules MVP — persisted in httpOnly cookie until AlertRule table ships.
 * Max ~20 rules; JSON size kept under cookie limits.
 */

export const ALERT_RULES_COOKIE = "talepo_alert_rules";

export type AlertRule = {
  id: string;
  categoryKeyword: string;
  cityKeyword: string;
  enabled: boolean;
  createdAt: string;
};

const MAX_RULES = 20;

export function parseAlertRules(raw: string | undefined | null): AlertRule[] {
  if (!raw?.trim()) return [];
  try {
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) return [];
    return parsed
      .filter(
        (item): item is AlertRule =>
          Boolean(item) &&
          typeof item === "object" &&
          typeof (item as AlertRule).id === "string" &&
          typeof (item as AlertRule).categoryKeyword === "string" &&
          typeof (item as AlertRule).cityKeyword === "string" &&
          typeof (item as AlertRule).enabled === "boolean" &&
          typeof (item as AlertRule).createdAt === "string",
      )
      .slice(0, MAX_RULES);
  } catch {
    return [];
  }
}

export function serializeAlertRules(rules: AlertRule[]): string {
  return JSON.stringify(rules.slice(0, MAX_RULES));
}

export function createAlertRule(input: {
  categoryKeyword: string;
  cityKeyword: string;
}): AlertRule {
  return {
    id: crypto.randomUUID(),
    categoryKeyword: input.categoryKeyword.trim(),
    cityKeyword: input.cityKeyword.trim(),
    enabled: true,
    createdAt: new Date().toISOString(),
  };
}

export function validateAlertRuleInput(input: {
  categoryKeyword?: string;
  cityKeyword?: string;
}): string | null {
  const category = input.categoryKeyword?.trim() ?? "";
  const city = input.cityKeyword?.trim() ?? "";
  if (!category && !city) {
    return "En az kategori veya şehir anahtar kelimesi girin.";
  }
  if (category.length > 80 || city.length > 80) {
    return "Anahtar kelime en fazla 80 karakter olabilir.";
  }
  return null;
}
