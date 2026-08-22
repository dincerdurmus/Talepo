/**
 * Category-aware question profiles built on REQUEST_CATEGORIES field keys.
 * Single authority for prompts / importance / soft-answer policy.
 */

import type { QuestionProfileDef } from "./question-profile-types";

/** Shared Talepo Standard keys — evaluated for every active category when relevant. */
const STANDARD: QuestionProfileDef[] = [
  {
    fieldKey: "needType",
    prompt: "Ne tür bir talep bu?",
    summaryLabel: "Talep türü",
    importance: "routing_critical",
    categories: ["automotive", "machinery"],
    rank: 100,
    allowDontCare: false,
    allowUnknown: false,
    inputHint: "select",
  },
  {
    fieldKey: "listingType",
    prompt: "Kiralık mı, satılık mı?",
    summaryLabel: "İşlem",
    importance: "routing_critical",
    categories: ["real-estate"],
    rank: 98,
    allowDontCare: false,
  },
  {
    fieldKey: "propertyType",
    prompt: "Konut tipi nedir?",
    summaryLabel: "Konut tipi",
    importance: "routing_critical",
    categories: ["real-estate"],
    rank: 96,
  },
  {
    fieldKey: "city",
    prompt: "Hangi ilde arıyorsunuz?",
    summaryLabel: "Konum",
    importance: "publish_required",
    categories: ["real-estate"],
    rank: 94,
    inputHint: "location",
    allowUnknown: false,
    allowDontCare: false,
  },
  {
    fieldKey: "city",
    prompt: "Nereye teslim edilecek / hangi il?",
    summaryLabel: "Teslimat ili",
    importance: "quote_critical",
    categories: [
      "technology",
      "appliances",
      "printing",
      "automotive",
      "furniture",
      "machinery",
      "baby",
      "home-kitchen",
    ],
    rank: 70,
    inputHint: "location",
    allowUnknown: true,
  },
  {
    fieldKey: "locationMode",
    prompt: "Uzaktan hizmet sizin için uygun mu?",
    summaryLabel: "Hizmet şekli",
    importance: "routing_critical",
    categories: ["services"],
    rank: 88,
    inputHint: "select",
    allowUnknown: false,
    allowDontCare: false,
  },
  {
    fieldKey: "city",
    prompt: "Hizmet nerede verilecek?",
    summaryLabel: "Hizmet yeri",
    importance: "quote_critical",
    categories: ["services", "health"],
    rank: 68,
    inputHint: "location",
    allowUnknown: true,
    allowDontCare: true,
  },
  {
    fieldKey: "budget",
    prompt: "Bütçeniz nedir?",
    summaryLabel: "Bütçe",
    importance: "quote_critical",
    rank: 60,
    inputHint: "budget",
    allowUnknown: true,
    allowDontCare: true,
    budgetBasis: "total",
  },
  {
    fieldKey: "quantity",
    prompt: "Kaç adet arıyorsunuz?",
    summaryLabel: "Adet",
    importance: "quote_critical",
    categories: ["printing", "technology", "furniture"],
    rank: 75,
    inputHint: "number",
    allowUnknown: true,
  },
  {
    fieldKey: "quantity",
    prompt: "Kaç adet arıyorsunuz?",
    summaryLabel: "Adet",
    importance: "optional",
    categories: ["appliances", "home-kitchen", "baby"],
    rank: 35,
    inputHint: "number",
    allowUnknown: true,
    allowDontCare: true,
  },
  {
    fieldKey: "delivery",
    prompt: "Ne zamana kadar ihtiyacınız var?",
    summaryLabel: "Zaman",
    importance: "quote_critical",
    rank: 55,
    allowUnknown: true,
    allowDontCare: true,
  },
  {
    fieldKey: "condition",
    prompt: "Ürün durumu tercihiniz var mı?",
    summaryLabel: "Durum",
    importance: "optional",
    categories: [
      "technology",
      "appliances",
      "automotive",
      "furniture",
      "machinery",
      "baby",
      "home-kitchen",
    ],
    rank: 50,
    allowDontCare: true,
    allowUnknown: true,
  },
  {
    fieldKey: "brand",
    prompt: "Marka tercihiniz var mı?",
    summaryLabel: "Marka",
    importance: "optional",
    rank: 48,
    allowDontCare: true,
    allowUnknown: true,
  },
  {
    fieldKey: "model",
    prompt: "Model tercihiniz var mı?",
    summaryLabel: "Model",
    importance: "optional",
    rank: 46,
    allowDontCare: true,
    allowUnknown: true,
  },
  {
    fieldKey: "dimensions",
    prompt: "Ölçüleri biliyor musunuz?",
    summaryLabel: "Ölçü",
    importance: "quote_critical",
    categories: ["printing"],
    rank: 80,
    allowUnknown: true,
  },
  {
    fieldKey: "material",
    prompt: "Malzeme / kâğıt tercihiniz?",
    summaryLabel: "Malzeme",
    importance: "optional",
    categories: ["printing"],
    rank: 40,
    allowUnknown: true,
    allowDontCare: true,
  },
  {
    fieldKey: "designReady",
    prompt: "Tasarım dosyanız hazır mı?",
    summaryLabel: "Tasarım",
    importance: "quote_critical",
    categories: ["printing"],
    rank: 72,
    allowUnknown: true,
  },
  {
    fieldKey: "roomCount",
    prompt: "Oda sayısı tercihiniz?",
    summaryLabel: "Oda",
    importance: "quote_critical",
    categories: ["real-estate"],
    rank: 72,
    allowUnknown: true,
  },
  {
    fieldKey: "area",
    prompt: "Yaklaşık metrekare?",
    summaryLabel: "m²",
    importance: "optional",
    categories: ["real-estate"],
    rank: 45,
    allowUnknown: true,
  },
  {
    fieldKey: "modelYear",
    prompt: "Hangi model yılı ve üzeri olsun?",
    summaryLabel: "Yıl",
    importance: "quote_critical",
    categories: ["automotive"],
    whenNeedTypes: ["vehicle"],
    rank: 78,
    allowUnknown: true,
  },
  {
    fieldKey: "fuel",
    prompt: "Yakıt tercihiniz?",
    summaryLabel: "Yakıt",
    importance: "optional",
    categories: ["automotive"],
    whenNeedTypes: ["vehicle"],
    rank: 42,
    allowDontCare: true,
  },
  {
    fieldKey: "transmission",
    prompt: "Vites tercihiniz?",
    summaryLabel: "Vites",
    importance: "optional",
    categories: ["automotive"],
    whenNeedTypes: ["vehicle"],
    rank: 41,
    allowDontCare: true,
  },
  {
    fieldKey: "mileage",
    prompt: "Kilometre üst sınırı var mı?",
    summaryLabel: "Kilometre",
    importance: "optional",
    categories: ["automotive"],
    whenNeedTypes: ["vehicle"],
    rank: 40,
    allowDontCare: true,
    allowUnknown: true,
  },
  {
    fieldKey: "screenSize",
    prompt: "Ekran boyutu tercihiniz?",
    summaryLabel: "Ekran",
    importance: "optional",
    // technology only: TVs resolve to technology, and appliances (hava
    // temizleyicisi, süpürge…) must never be asked a screen size.
    categories: ["technology"],
    rank: 44,
    allowDontCare: true,
    allowUnknown: true,
  },
];

function matchesCategory(
  def: QuestionProfileDef,
  categoryId: string,
): boolean {
  if (!def.categories || def.categories.length === 0) return true;
  return def.categories.includes(categoryId);
}

function matchesNeedType(
  def: QuestionProfileDef,
  needType: string | null | undefined,
): boolean {
  if (!def.whenNeedTypes || def.whenNeedTypes.length === 0) return true;
  if (!needType) return true;
  return def.whenNeedTypes.includes(needType);
}

/**
 * Resolve the active profile definition for a field in a category context.
 * More specific (category-scoped) defs win over generic ones.
 */
export function resolveProfileForField(input: {
  fieldKey: string;
  categoryId: string;
  needType?: string | null;
}): QuestionProfileDef | null {
  const matches = STANDARD.filter(
    (d) =>
      d.fieldKey === input.fieldKey &&
      matchesCategory(d, input.categoryId) &&
      matchesNeedType(d, input.needType),
  );
  if (matches.length === 0) return null;
  // Prefer category-specific over global
  matches.sort((a, b) => {
    const as = a.categories?.length ? 1 : 0;
    const bs = b.categories?.length ? 1 : 0;
    if (as !== bs) return bs - as;
    return (b.rank ?? 0) - (a.rank ?? 0);
  });
  return matches[0]!;
}

export function listProfilesForCategory(input: {
  categoryId: string;
  needType?: string | null;
}): QuestionProfileDef[] {
  const byKey = new Map<string, QuestionProfileDef>();
  for (const def of STANDARD) {
    if (!matchesCategory(def, input.categoryId)) continue;
    if (!matchesNeedType(def, input.needType)) continue;
    const existing = byKey.get(def.fieldKey);
    if (!existing) {
      byKey.set(def.fieldKey, def);
      continue;
    }
    const preferNew =
      (def.categories?.length ? 1 : 0) > (existing.categories?.length ? 1 : 0);
    if (preferNew) byKey.set(def.fieldKey, def);
  }
  return [...byKey.values()].sort(
    (a, b) => (b.rank ?? 0) - (a.rank ?? 0),
  );
}

export function importanceRank(importance: QuestionProfileDef["importance"]): number {
  switch (importance) {
    case "publish_required":
      return 400;
    case "routing_critical":
      return 300;
    case "quote_critical":
      return 200;
    case "optional":
      return 100;
  }
}

export function isCriticalImportance(
  importance: QuestionProfileDef["importance"],
): boolean {
  return importance !== "optional";
}
