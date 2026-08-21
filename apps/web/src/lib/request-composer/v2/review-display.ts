/**
 * Canonical review / soft-status display for composer v2.
 * Soft location/budget answers are resolved answers — not uncertainties.
 */

import {
  parseBudgetStatus,
  parseLocationStatus,
  type GlobalBudgetStatus,
  type GlobalLocationStatus,
} from "./global-core-profile";

export function locationDisplayLabel(
  cityValue: string | null | undefined,
): string | null {
  if (!cityValue?.trim()) return null;
  const status = parseLocationStatus(cityValue);
  if (status === "nationwide") return "Türkiye geneli";
  if (status === "remote") return "Uzaktan";
  if (status === "no_location_preference") return "Konum fark etmez";
  if (status === "unknown") return "Henüz bilmiyorum";
  return cityValue.trim();
}

export function budgetDisplayLabel(
  budgetValue: string | null | undefined,
): string | null {
  if (!budgetValue?.trim()) return null;
  const status = parseBudgetStatus(budgetValue);
  if (status === "open_to_offers") return "Teklifleri görmek istiyorum";
  if (status === "unknown") return "Henüz bilmiyorum";
  if (status === "no_preference") return "Fark etmez";
  return budgetValue.trim();
}

export function isSoftLocationAnswer(
  value: string | null | undefined,
): boolean {
  const s = parseLocationStatus(value);
  return (
    s === "nationwide" ||
    s === "remote" ||
    s === "no_location_preference" ||
    s === "unknown"
  );
}

export function isSoftBudgetAnswer(value: string | null | undefined): boolean {
  const s = parseBudgetStatus(value);
  return (
    s === "open_to_offers" ||
    s === "unknown" ||
    s === "no_preference"
  );
}

/** City/district is only complete when both parts are present. */
export function isCityDistrictComplete(
  cityValue: string | null | undefined,
  districtValue?: string | null,
): boolean {
  if (isSoftLocationAnswer(cityValue)) return false;
  const raw = (cityValue ?? "").trim();
  if (!raw) return false;
  if (raw.includes("/")) {
    const [il, ilce] = raw.split("/").map((p) => p.trim());
    return Boolean(il && ilce);
  }
  return Boolean(raw && districtValue?.trim());
}

export function resolveLocationStatus(input: {
  cityValue?: string | null;
  districtValue?: string | null;
  locationMode?: string | null;
}): GlobalLocationStatus {
  const soft =
    parseLocationStatus(input.cityValue) ??
    parseLocationStatus(input.locationMode);
  if (
    soft === "nationwide" ||
    soft === "remote" ||
    soft === "no_location_preference" ||
    soft === "unknown"
  ) {
    return soft;
  }
  if (isCityDistrictComplete(input.cityValue, input.districtValue)) {
    return "city_district";
  }
  if ((input.cityValue ?? "").trim()) {
    // Province selected without district — still missing
    return "missing";
  }
  return "missing";
}

export function resolveBudgetStatus(
  value: string | null | undefined,
): GlobalBudgetStatus {
  return parseBudgetStatus(value) ?? "missing";
}

export function filterReviewPreferences(input: {
  preferences: Array<{ label: string; value: string; key?: string }>;
  location: string | null;
  budget: string | null;
}): Array<{ label: string; value: string }> {
  const loc = (input.location ?? "").toLocaleLowerCase("tr-TR");
  const bud = (input.budget ?? "").toLocaleLowerCase("tr-TR");
  return input.preferences
    .filter((p) => {
      const key = (p.key ?? "").toLowerCase();
      if (key === "city" || key === "location" || key === "budget") return false;
      const fold = p.value.toLocaleLowerCase("tr-TR");
      if (loc && fold === loc) return false;
      if (bud && fold === bud) return false;
      // Bare soft tokens without field context
      if (
        fold === "fark etmez" ||
        fold === "türkiye geneli" ||
        fold === "turkiye geneli" ||
        fold === "konum fark etmez" ||
        fold === "uzaktan" ||
        fold === "teklifleri görmek istiyorum" ||
        fold === "henüz bilmiyorum"
      ) {
        return false;
      }
      return true;
    })
    .map(({ label, value }) => ({ label, value }));
}

export function filterReviewUncertainties(input: {
  items: Array<{ key: string; label: string; tone: "check" | "unsure" }>;
  cityValue?: string | null;
  budgetValue?: string | null;
}): Array<{ key: string; label: string; tone: "check" | "unsure" }> {
  const locSoft = isSoftLocationAnswer(input.cityValue);
  const locComplete = isCityDistrictComplete(input.cityValue);
  const budSoft = isSoftBudgetAnswer(input.budgetValue);
  const budSpecified = resolveBudgetStatus(input.budgetValue) === "specified";

  return input.items.filter((item) => {
    if (item.key === "city" || item.key === "location") {
      if (locSoft || locComplete) return false;
    }
    if (item.key === "budget") {
      if (budSoft || budSpecified) return false;
    }
    return true;
  });
}

/** Compact Anlaşılanlar line — labeled, no orphan soft tokens. */
export function compactUnderstoodPreview(
  facts: Array<{ key: string; label: string; displayValue: string }>,
  categoryLabel?: string | null,
): string {
  const parts: string[] = [];
  if (categoryLabel) parts.push(categoryLabel);
  for (const f of facts.slice(0, 4)) {
    if (f.key === "city" || f.key === "budget") {
      const fold = f.displayValue.toLocaleLowerCase("tr-TR");
      if (
        fold === "fark etmez" ||
        fold === "türkiye geneli" ||
        fold === "konum fark etmez"
      ) {
        continue;
      }
      parts.push(`${f.label}: ${f.displayValue}`);
      continue;
    }
    const fold = f.displayValue.toLocaleLowerCase("tr-TR");
    if (fold === "fark etmez") continue;
    parts.push(f.displayValue);
  }
  return parts.filter(Boolean).join(" · ");
}
