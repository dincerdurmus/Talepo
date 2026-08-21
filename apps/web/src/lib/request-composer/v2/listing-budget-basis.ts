/**
 * Canonical listing-type → budget-basis authority for composer v2.
 * Never invent monthly/total when listing type is unknown.
 */

export type ComposerListingKind = "sale" | "rent" | "daily" | "unknown";

export type ComposerBudgetBasis =
  | "total"
  | "monthly"
  | "daily"
  | "per_unit"
  | "service";

export function normalizeListingKind(
  raw: string | null | undefined,
): ComposerListingKind {
  if (!raw?.trim()) return "unknown";
  const fold = raw.trim().toLocaleLowerCase("tr-TR");
  if (
    fold === "sale" ||
    fold === "satılık" ||
    fold === "satilik" ||
    fold === "sell" ||
    fold.includes("satılık") ||
    fold.includes("satilik") ||
    fold === "satilik-konut" ||
    fold === "satılık-konut"
  ) {
    return "sale";
  }
  if (
    fold === "rent" ||
    fold === "kiralık" ||
    fold === "kiralik" ||
    fold === "kira" ||
    fold.includes("kiralık") ||
    fold.includes("kiralik") ||
    fold === "kiralik-konut" ||
    fold === "kiralık-konut"
  ) {
    return "rent";
  }
  if (
    fold === "daily" ||
    fold === "günlük" ||
    fold === "gunluk" ||
    fold.includes("günlük") ||
    fold.includes("gunluk")
  ) {
    return "daily";
  }
  return "unknown";
}

/**
 * Single authority: sale→total, rent→monthly, daily→daily, unknown→null (no invented basis).
 */
export function budgetBasisForListing(
  raw: string | null | undefined,
): ComposerBudgetBasis | null {
  const kind = normalizeListingKind(raw);
  if (kind === "sale") return "total";
  if (kind === "rent") return "monthly";
  if (kind === "daily") return "daily";
  return null;
}

export function budgetSummaryLabelForListing(
  raw: string | null | undefined,
  opts?: { isRealEstate?: boolean },
): string {
  const basis = budgetBasisForListing(raw);
  if (basis === "monthly") return "Aylık bütçe";
  if (basis === "total") return "Toplam bütçe";
  if (basis === "daily") return "Günlük bütçe";
  return opts?.isRealEstate ? "Bütçe" : "Bütçe";
}

export function budgetPromptForListing(
  raw: string | null | undefined,
  opts?: { isRealEstate?: boolean },
): string {
  const basis = budgetBasisForListing(raw);
  if (basis === "monthly") return "Aylık bütçeniz nedir?";
  if (basis === "total") return "Toplam bütçeniz nedir?";
  if (basis === "daily") return "Günlük bütçeniz nedir?";
  return opts?.isRealEstate ? "Bütçeniz nedir?" : "Bütçeniz nedir?";
}
