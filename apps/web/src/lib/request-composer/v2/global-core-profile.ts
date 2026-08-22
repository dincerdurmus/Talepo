/**
 * Global core questions — apply to EVERY category.
 * Category profiles may add questions; they must never suppress these.
 */

import type { QuestionProfileDef } from "./question-profile-types";
import {
  budgetBasisForListing,
  budgetPromptForListing,
  budgetSummaryLabelForListing,
} from "./listing-budget-basis";

export const GLOBAL_CORE_FIELD_KEYS = ["budget", "city", "delivery"] as const;

export type GlobalLocationStatus =
  | "city_district"
  /** İl seçildi, ilçe "Tümü" — il geneli geçerli cevaptır (kurucu, 2026-08-23). */
  | "city_wide"
  | "nationwide"
  | "remote"
  | "no_location_preference"
  | "unknown"
  | "missing";

export type GlobalBudgetStatus =
  | "specified"
  | "open_to_offers"
  | "unknown"
  | "no_preference"
  | "missing";

export function globalCoreQuestionProfiles(
  categoryId: string,
  extras?: { listingType?: string | null },
): QuestionProfileDef[] {
  const isRealEstate = categoryId === "real-estate";
  const isServiceLike =
    categoryId === "services" || categoryId === "health";

  const locationPrompt = isRealEstate
    ? "Hangi il ve ilçede arıyorsunuz?"
    : isServiceLike
      ? "Hizmet nerede verilecek?"
      : "Nereye teslim edilecek?";

  const listingRaw = extras?.listingType ?? null;
  const reBasis = isRealEstate ? budgetBasisForListing(listingRaw) : null;

  return [
    {
      fieldKey: "budget",
      prompt: isRealEstate
        ? budgetPromptForListing(listingRaw, { isRealEstate: true })
        : "Bütçeniz nedir?",
      summaryLabel: isRealEstate
        ? budgetSummaryLabelForListing(listingRaw, { isRealEstate: true })
        : "Bütçe",
      // Kuzey yıldızı: bütçe + il/ilçe yayın için zorunlu tek iki alandır.
      importance: "publish_required",
      rank: 92,
      inputHint: "budget",
      allowUnknown: true,
      allowDontCare: true,
      // Unknown RE listing → no invented monthly/total basis
      budgetBasis: isRealEstate ? (reBasis ?? undefined) : "total",
    },
    {
      fieldKey: "city",
      prompt: locationPrompt,
      summaryLabel: "Konum",
      importance: "publish_required",
      rank: 90,
      inputHint: "location",
      allowUnknown: true,
      allowDontCare: true,
    },
    {
      fieldKey: "delivery",
      prompt: isRealEstate
        ? "Ne zamana kadar taşınmak istiyorsunuz?"
        : "Ne zamana kadar ihtiyacınız var?",
      summaryLabel: "Zaman",
      importance: "quote_critical",
      rank: 55,
      allowUnknown: true,
      allowDontCare: true,
    },
  ];
}

export function parseLocationStatus(
  value: string | null | undefined,
): GlobalLocationStatus | null {
  if (!value?.trim()) return null;
  const fold = value.trim().toLocaleLowerCase("tr-TR");
  if (
    fold === "nationwide" ||
    fold === "türkiye geneli" ||
    fold === "turkiye geneli" ||
    fold === "kargo uygun" ||
    fold === "türkiye" ||
    fold === "turkiye"
  ) {
    return "nationwide";
  }
  if (
    fold === "remote" ||
    fold === "uzaktan" ||
    fold === "uzaktan uygun" ||
    fold === "online"
  ) {
    return "remote";
  }
  if (
    fold === "no_preference" ||
    fold === "no_location_preference" ||
    fold === "fark etmez" ||
    fold === "farketmez" ||
    fold === "fark-etmez" ||
    fold === "konum fark etmez"
  ) {
    return "no_location_preference";
  }
  if (
    fold === "unknown" ||
    fold === "bilmiyorum" ||
    fold === "henüz bilmiyorum"
  ) {
    return "unknown";
  }
  // Concrete city_district only when il + ilçe are both present
  if (value.includes("/")) {
    const [il, ilce] = value.split("/").map((p) => p.trim());
    if (il && ilce) return "city_district";
    return null;
  }
  return null;
}

export function parseBudgetStatus(
  value: string | null | undefined,
): GlobalBudgetStatus | null {
  if (!value?.trim()) return null;
  const fold = value.trim().toLocaleLowerCase("tr-TR");
  if (
    fold === "open_to_offers" ||
    fold === "teklifleri görmek istiyorum" ||
    fold === "teklif bekliyorum"
  ) {
    return "open_to_offers";
  }
  if (
    fold === "unknown" ||
    fold === "bilmiyorum" ||
    fold === "henüz bilmiyorum"
  ) {
    return "unknown";
  }
  if (
    fold === "no_preference" ||
    fold === "fark etmez" ||
    fold === "farketmez" ||
    fold === "fark-etmez"
  ) {
    return "no_preference";
  }
  // Numeric / range text
  if (/\d/.test(fold) || /tl|₺|bin/.test(fold)) return "specified";
  if (fold.length > 0) return "specified";
  return null;
}

export function isBudgetSatisfiedForPublish(
  value: string | null | undefined,
): boolean {
  // Kurucu: ya bütçe girilir ya "teklifleri görmek istiyorum" denir.
  const status = parseBudgetStatus(value);
  return status === "specified" || status === "open_to_offers";
}

export function isLocationSatisfiedForPublish(input: {
  cityValue?: string | null;
  locationMode?: string | null;
  realEstateComplete?: boolean;
  categoryId?: string | null;
  districtValue?: string | null;
}): boolean {
  if (input.categoryId === "real-estate") {
    return input.realEstateComplete === true;
  }
  const fromCity = parseLocationStatus(input.cityValue);
  if (
    fromCity === "nationwide" ||
    fromCity === "remote" ||
    fromCity === "no_location_preference"
  ) {
    return true;
  }
  if (fromCity === "city_district") {
    const raw = (input.cityValue ?? "").trim();
    if (raw.includes("/")) {
      const [il, ilce] = raw.split("/").map((p) => p.trim());
      return Boolean(il && ilce);
    }
    return Boolean(raw && input.districtValue?.trim());
  }
  // Kurucu (2026-08-23): il seçili + ilçe "Tümü" (yalın il / il listesi)
  // il geneli anlamına gelir ve yayın kapısını tatmin eder.
  if (
    fromCity !== "unknown" &&
    fromCity !== "missing" &&
    (input.cityValue ?? "").trim().length > 0
  ) {
    return true;
  }
  const mode = parseLocationStatus(input.locationMode);
  if (mode === "remote" || mode === "nationwide" || mode === "no_location_preference") {
    return true;
  }
  return false;
}
