import type { DynamicField } from "@/lib/request-category-engine";
import type { PriceStrategyKey } from "@/lib/price-intelligence/price-strategy-registry";
import type { QuestionCandidate } from "./types";

/** How a missing field should surface in conversational UX */
export type HumanFieldClass =
  | "REQUIRED_TO_PUBLISH"
  | "HIGH_VALUE"
  | "OPTIONAL"
  | "INFERABLE"
  | "EXPERT_ONLY"
  | "IRRELEVANT";

export type HumanizedQuestion = QuestionCandidate & {
  fieldClass: HumanFieldClass;
  humanPrompt: string;
  escapeChoices?: { label: string; value: string }[];
};

const EXPERT_ONLY_KEYS = new Set([
  "specs",
  "technicalSpecs",
  "chassis",
  "vin",
  "sku",
  "oem",
  "partNumber",
]);

const OPTIONAL_KEYS = new Set([
  "delivery",
  "deliveryDays",
  "frequency",
  "duration",
  "notes",
  "description",
  "neighborhoods",
]);

const HUMAN_PROMPTS: Record<string, string> = {
  condition: "Tercihiniz var mı?",
  brand: "Marka tercihiniz var mı?",
  model: "Model konusunda esnek misiniz?",
  modelYear: "Hangi model yılı ve üzeri olsun?",
  mileage: "Kilometre üst sınırı var mı?",
  fuel: "Yakıt tercihiniz?",
  transmission: "Vites tercihiniz?",
  city: "Teklifleri hangi şehirden almak istersiniz?",
  budget: "Bütçeniz nedir?",
  quantity: "Kaç adet gerekiyor?",
  area: "Yaklaşık metrekare?",
  roomCount: "Oda sayısı?",
  listingType: "Kiralık mı, satılık mı?",
  propertyType: "Konut tipi?",
  serviceType: "Ne tür bir hizmet arıyorsunuz?",
  scope: "İşin kapsamı nedir?",
  dimensions: "Ölçüleri biliyor musunuz?",
  material: "Malzeme tercihiniz var mı?",
  printType: "Baskı türü tercihiniz?",
  specs: "Önemli bir tercihiniz var mı?",
};

const ESCAPE = [
  { label: "Fark etmez", value: "fark-etmez" },
  { label: "Bilmiyorum", value: "bilmiyorum" },
];

export function classifyHumanField(
  fieldKey: string,
  input: {
    strategy: PriceStrategyKey | null | undefined;
    requiredDynamicKeys: string[];
    isFilled: boolean;
  },
): HumanFieldClass {
  if (input.isFilled) return "INFERABLE";
  if (EXPERT_ONLY_KEYS.has(fieldKey)) return "EXPERT_ONLY";
  if (OPTIONAL_KEYS.has(fieldKey)) return "OPTIONAL";
  if (fieldKey === "budget" || input.requiredDynamicKeys.includes(fieldKey)) {
    return "REQUIRED_TO_PUBLISH";
  }
  if (fieldKey === "city" || fieldKey === "title") return "REQUIRED_TO_PUBLISH";
  if (
    fieldKey === "brand" ||
    fieldKey === "model" ||
    fieldKey === "condition" ||
    fieldKey === "modelYear" ||
    fieldKey === "mileage" ||
    fieldKey === "area" ||
    fieldKey === "roomCount" ||
    fieldKey === "quantity" ||
    fieldKey === "dimensions"
  ) {
    return "HIGH_VALUE";
  }
  return "OPTIONAL";
}

function humanizeLabel(fieldKey: string, fallback: string): string {
  const map: Record<string, string> = {
    specs: "Tercihler",
    technicalSpecs: "Tercihler",
    condition: "Durum tercihi",
    serviceType: "Hizmet türü",
    scope: "Kapsam",
  };
  return map[fieldKey] ?? fallback;
}

function quickChoicesForField(
  fieldKey: string,
  existing?: { label: string; value: string }[],
): { label: string; value: string }[] | undefined {
  if (existing?.length) return existing;
  if (fieldKey === "condition") {
    return [
      { label: "Sıfır", value: "sıfır" },
      { label: "İkinci el", value: "ikinci el" },
      { label: "Fark etmez", value: "fark-etmez" },
    ];
  }
  if (fieldKey === "model") {
    return [
      { label: "Yalnız bu model", value: "exact" },
      { label: "Benzer modeller olabilir", value: "flexible" },
      { label: "Fark etmez", value: "fark-etmez" },
    ];
  }
  return undefined;
}

/**
 * Map ranked next-best fields into human conversational questions.
 * Drops EXPERT_ONLY / IRRELEVANT from primary surface.
 */
export function toHumanQuestions(
  questions: QuestionCandidate[],
  input: {
    strategy: PriceStrategyKey | null | undefined;
    requiredDynamicKeys: string[];
    dynamicFields: DynamicField[];
    maxVisible?: number;
  },
): HumanizedQuestion[] {
  const maxVisible = input.maxVisible ?? 3;
  const out: HumanizedQuestion[] = [];
  const blockedKeys = new Set([
    "solutionType",
    "productName",
    "specs",
    "technicalSpecs",
    "title",
  ]);
  const blockedLabelRe = /çözüm\s*\/\s*ürün|ürün\s*adı|teknik\s*özellik/i;

  for (const q of questions) {
    if (blockedKeys.has(q.fieldKey)) continue;
    if (blockedLabelRe.test(q.label)) continue;

    const fieldClass = classifyHumanField(q.fieldKey, {
      strategy: input.strategy,
      requiredDynamicKeys: input.requiredDynamicKeys,
      isFilled: false,
    });

    if (fieldClass === "IRRELEVANT" || fieldClass === "EXPERT_ONLY") {
      continue;
    }
    if (fieldClass === "OPTIONAL" && out.length >= 2) {
      continue;
    }

    const humanPrompt =
      HUMAN_PROMPTS[q.fieldKey] ??
      (fieldClass === "REQUIRED_TO_PUBLISH"
        ? `${humanizeLabel(q.fieldKey, q.label)} bilgisini ekleyelim.`
        : `${humanizeLabel(q.fieldKey, q.label)} eklemek ister misiniz?`);

    out.push({
      ...q,
      label: humanizeLabel(q.fieldKey, q.label),
      fieldClass,
      humanPrompt,
      quickChoices: quickChoicesForField(q.fieldKey, q.quickChoices),
      escapeChoices: fieldClass === "REQUIRED_TO_PUBLISH" ? undefined : ESCAPE,
    });

    if (out.length >= maxVisible) break;
  }

  return out;
}

export function budgetPromptForStrategy(
  strategy: PriceStrategyKey | null | undefined,
): { title: string; helper: string } {
  switch (strategy) {
    case "REAL_ESTATE_RENT":
      return {
        title: "Aylık bütçeniz nedir?",
        helper: "Talebinizi yayınlamak için aylık bütçenizi belirtin.",
      };
    case "REAL_ESTATE_SALE":
      return {
        title: "Satın alma bütçeniz nedir?",
        helper: "Talebinizi yayınlamak için bütçenizi belirtin.",
      };
    case "VEHICLE":
      return {
        title: "Araç için bütçeniz nedir?",
        helper: "Talebinizi yayınlamak için bütçenizi belirtin.",
      };
    case "CUSTOM_MANUFACTURING":
      return {
        title: "Toplam veya birim bütçeniz nedir?",
        helper: "Yaklaşık bir bütçe teklif kalitesini yükseltir.",
      };
    case "SERVICE_SCOPE":
      return {
        title: "Bu iş için bütçeniz nedir?",
        helper: "Talebinizi yayınlamak için bütçenizi belirtin.",
      };
    default:
      return {
        title: "Bütçeniz nedir?",
        helper:
          "Talebinizi yayınlamak için son bir bilgiye ihtiyacımız var — bütçenizi belirtin.",
      };
  }
}
