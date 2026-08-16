import { resolveFieldOptionLabel } from "@/lib/field-display";
import type { DynamicField } from "@/lib/request-category-engine";
import { normalizeCasualTurkish } from "@/lib/ai/parser/normalize-casual-tr";

type CommonDraft = {
  title?: string;
  quantity?: string;
  city?: string;
  delivery?: string;
  budget?: string;
};

type CommonField = {
  key: string;
  label: string;
};

export type ComposeRequestTextInput = {
  categoryId: string;
  rawText: string;
  attributes?: Record<string, string | number | boolean>;
  city?: string;
  budget?: number;
  deliveryDays?: number;
  quantity?: number;
  unit?: string;
  fields?: DynamicField[];
  fieldValues?: Record<string, string>;
  commonDraft?: CommonDraft;
  commonFields?: CommonField[];
};

const OFFER_INSTRUCTIONS: Record<string, string> = {
  "real-estate":
    "Tekliflerde kira/satış bedeli, depozito, aidat ve taşınmazın genel durumu ayrı ayrı belirtilmelidir.",
  technology:
    "Teklifte toplam fiyat, proje süresi, kapsam detayı ve destek koşulları ayrı ayrı belirtilmelidir.",
  furniture:
    "Teklifte birim fiyat, toplam tutar, teslim süresi, montaj ve garanti koşulları ayrı ayrı belirtilmelidir.",
  appliances:
    "Teklifte birim fiyat, toplam tutar, enerji sınıfı, kurulum/montaj ve garanti koşulları ayrı ayrı belirtilmelidir.",
  health:
    "Teklifte birim fiyat, belgelendirme (CE/ISO), teslim süresi ve garanti/servis koşulları ayrı ayrı belirtilmelidir.",
  baby:
    "Teklifte birim fiyat, yaş uygunluğu, güvenlik standartları, teslim süresi ve garanti koşulları ayrı ayrı belirtilmelidir.",
  "home-kitchen":
    "Teklifte birim fiyat, parça/kişilik bilgisi, malzeme, teslim süresi ve varsa ambalaj koşulları ayrı ayrı belirtilmelidir.",
  default:
    "Teklifte toplam fiyat, teslim süresi, ödeme koşulları ve varsa garanti bilgisi ayrı ayrı belirtilmelidir.",
};

const KNOWN_CITIES = [
  "İstanbul",
  "Ankara",
  "İzmir",
  "Bursa",
  "Antalya",
  "Adana",
  "Konya",
  "Gaziantep",
  "Kocaeli",
  "Mersin",
];

export function composeRequestTitle(input: ComposeRequestTextInput): string {
  const values = mergeFieldValues(input);
  const cleanRaw = normalizeCasualTurkish(input.rawText);

  if (input.categoryId === "real-estate") {
    return composeRealEstateShortTitle(cleanRaw, values, input.city);
  }

  if (input.categoryId === "automotive") {
    const needType = values.needType || "vehicle";
    if (needType === "part" || needType === "tire") {
      const subject = [values.modelYear, values.brand, values.model]
        .filter(Boolean)
        .join(" ");
      const part = values.part?.trim();
      if (subject && part) {
        return `${subject} için ${part}`.replace(/\s+/g, " ").trim();
      }
      if (subject) return subject;
      if (part) return capitalizeTurkish(part);
    } else if (needType === "service") {
      const parts = [
        values.brand,
        values.model,
        values.serviceType || "servis",
      ].filter(Boolean);
      if (parts.length >= 2) {
        return parts.join(" ").replace(/\s+/g, " ").trim();
      }
    } else {
      const parts = [values.modelYear, values.brand, values.model].filter(
        Boolean,
      );
      if (parts.length >= 2) {
        return parts.join(" ").replace(/\s+/g, " ").trim();
      }
      if (parts.length === 1) {
        return String(parts[0]);
      }
    }
  }

  if (input.categoryId === "furniture") {
    const qty = resolveTitleQuantity(input, values);
    const type =
      values.furnitureType?.trim() || inferFurnitureTypeLabel(cleanRaw);
    if (type) {
      return [qty, type].filter(Boolean).join(" ");
    }
  }

  if (input.categoryId === "technology") {
    const subject =
      values.solutionType?.trim() ||
      values.brand?.trim() ||
      (values.needType === "hardware"
        ? "Donanım"
        : values.needType === "service"
          ? "IT destek"
          : "Yazılım");
    // Never fall back to slang raw text when we already have a structured product.
    return subject;
  }

  if (input.categoryId === "machinery") {
    const subject =
      values.machineType?.trim() ||
      values.part?.trim() ||
      (values.needType === "service" ? "Makine servisi" : "Makine");
    return capitalizeTurkish(subject);
  }

  if (input.categoryId === "services") {
    const rawSubject = cleanRaw
      .replace(
        /\b(?:arıyorum|ariyorum|istiyorum|yaptıracağım|yaptiracagim|yaptırmak|yaptirmak|yaptırıyorum|yaptiriyorum)\b/giu,
        " ",
      )
      .replace(/[.!?]+/g, " ")
      .replace(/\s+/g, " ")
      .trim();
    const serviceType = values.serviceType?.trim();
    const target = values.serviceLocation?.trim();
    const subject = rawSubject || [target, serviceType].filter(Boolean).join(" ");
    if (subject) {
      const alreadyService = /\b(?:hizmet|servis|bakım|bakim)\b/iu.test(subject);
      return `${capitalizeTurkish(subject)}${alreadyService ? "" : " hizmeti"} arıyorum`;
    }
  }

  if (input.categoryId === "printing") {
    const product =
      inferPrintingProductLabel(cleanRaw) ||
      values.printType?.trim() ||
      "Matbaa / baskı";
    const subject = [product, values.material?.trim()]
      .filter(Boolean)
      .join(" — ");
    const qty = resolveTitleQuantity(input, values);
    return [qty, subject].filter(Boolean).join(" ");
  }

  if (
    input.categoryId === "appliances" ||
    input.categoryId === "baby" ||
    input.categoryId === "home-kitchen" ||
    input.categoryId === "health"
  ) {
    const qty = resolveTitleQuantity(input, values);
    const type =
      values.applianceType?.trim() ||
      values.babyProductType?.trim() ||
      values.kitchenProductType?.trim() ||
      values.productName?.trim() ||
      values.healthProductType?.trim();
    const brand =
      values.brand?.trim() ||
      values.brandPreference?.trim();
    if (type || brand) {
      return [qty, brand, type].filter(Boolean).join(" ");
    }
  }

  const firstDetail = input.fields
    ?.map((field) => {
      if (field.key === "needType") return "";
      return values[field.key]?.trim();
    })
    .find(Boolean);

  if (firstDetail && input.categoryId !== "real-estate") {
    return capitalizeTurkish(firstDetail);
  }

  const fromRaw = deriveShortTitleFromRawText(input.rawText);
  if (fromRaw) return fromRaw;

  return "Yeni talep";
}

export function composeProfessionalDescription(
  input: ComposeRequestTextInput,
): string {
  const values = mergeFieldValues(input);
  const normalizedInput: ComposeRequestTextInput = {
    ...input,
    rawText: normalizeCasualTurkish(input.rawText),
  };
  const opening = composeOpeningSentence(normalizedInput, values);
  const detailLines = collectDetailLines(normalizedInput, values);
  const instruction = resolveOfferInstruction(input.categoryId, values);

  return [opening, detailLines.length ? detailLines.join("\n") : "", instruction]
    .filter(Boolean)
    .join("\n\n");
}

function resolveOfferInstruction(
  categoryId: string,
  values: Record<string, string>,
): string {
  if (categoryId === "technology" && values.needType === "hardware") {
    return "Teklifte birim/toplam fiyat, teslim süresi, garanti ve cihaz durumu ayrı ayrı belirtilmelidir.";
  }
  return OFFER_INSTRUCTIONS[categoryId] ?? OFFER_INSTRUCTIONS.default;
}

function composeOpeningSentence(
  input: ComposeRequestTextInput,
  values: Record<string, string>,
): string {
  if (input.categoryId === "real-estate") {
    const sentence = composeRealEstateTitle(input.rawText, values, input.city);
    return sentence.endsWith(".") ? sentence : `${sentence}.`;
  }

  if (input.categoryId === "furniture") {
    return composeFurnitureOpening(input, values);
  }

  if (input.categoryId === "automotive") {
    return composeAutomotiveOpening(input, values);
  }

  if (input.categoryId === "technology") {
    return composeTechnologyOpening(input, values);
  }

  if (input.categoryId === "machinery") {
    return composeMachineryOpening(input, values);
  }

  if (input.categoryId === "printing") {
    return composePrintingOpening(input, values);
  }

  if (
    input.categoryId === "appliances" ||
    input.categoryId === "health" ||
    input.categoryId === "baby" ||
    input.categoryId === "home-kitchen"
  ) {
    return composeProductCategoryOpening(input, values);
  }

  return composeGenericOpening(input, values);
}

function composeProductCategoryOpening(
  input: ComposeRequestTextInput,
  values: Record<string, string>,
): string {
  const type =
    values.applianceType?.trim() ||
    values.babyProductType?.trim() ||
    values.kitchenProductType?.trim() ||
    values.productName?.trim() ||
    values.healthProductType?.trim() ||
    "ürün";
  const brand =
    values.brand?.trim() || values.brandPreference?.trim() || "";
  const city = resolveCity(input, values);
  const qtyLabel = formatQuantityPhrase(input, values);
  const qtyPhrase = qtyLabel ? `${qtyLabel} ` : "";
  const cityPhrase = city ? `${city} içinde ` : "";
  const brandPhrase = brand ? `${brand} ` : "";
  const featureBits: string[] = [];
  const featureSource = [
    values.features,
    values.specs,
    input.rawText,
  ]
    .filter(Boolean)
    .join(" ")
    .toLocaleLowerCase("tr-TR");
  if (featureSource.includes("no-frost") || featureSource.includes("nofrost")) {
    featureBits.push("no-frost");
  }
  const featurePhrase = featureBits.length
    ? ` (${featureBits.join(", ")})`
    : "";

  return capitalizeTurkish(
    `${cityPhrase}${qtyPhrase}${brandPhrase}${lowerTurkish(type)}${featurePhrase} tedarik etmek istiyoruz.`,
  );
}

function composeFurnitureOpening(
  input: ComposeRequestTextInput,
  values: Record<string, string>,
): string {
  const type =
    values.furnitureType?.trim() ||
    inferFurnitureTypeLabel(input.rawText) ||
    "ofis mobilyası";
  const city = resolveCity(input, values);
  const purpose = extractFurniturePurpose(input.rawText, values);
  const qtyLabel = formatQuantityPhrase(input, values);

  let typePhrase = lowerTurkish(type);
  // Avoid "makam odası için makam / yönetici masa takımı…" redundancy.
  if (purpose?.includes("makam") && typePhrase.includes("makam")) {
    typePhrase = "yönetici masa takımı";
  }

  const purposePhrase = purpose ? `${purpose} için ` : "";
  const qtyPhrase = qtyLabel ? `${qtyLabel} ` : "";
  const cityPhrase = city ? `${city} içinde ` : "";

  return capitalizeTurkish(
    `${purposePhrase}${cityPhrase}${qtyPhrase}${typePhrase} tedarik etmek istiyoruz.`,
  );
}

function composeAutomotiveOpening(
  input: ComposeRequestTextInput,
  values: Record<string, string>,
): string {
  const city = resolveCity(input, values);
  const needType = values.needType || "vehicle";
  const citySuffix = city ? ` (${city})` : "";
  const year = formatModelYearPreference(values);

  if (needType === "part" || needType === "tire") {
    const subject = [year, values.brand, values.model]
      .filter(Boolean)
      .join(" ");
    const part = values.part || (needType === "tire" ? "lastik" : "yedek parça");
    if (subject) {
      return `${subject} için ${lowerTurkish(part)} tedarik talebi oluşturuyoruz${citySuffix}.`;
    }
    return `${capitalizeTurkish(part)} tedarik talebi oluşturuyoruz${citySuffix}.`;
  }

  if (needType === "service") {
    const subject = [values.brand, values.model].filter(Boolean).join(" ");
    const service = values.serviceType || "servis / bakım";
    if (subject) {
      return `${subject} için ${lowerTurkish(service)} hizmeti talep ediyoruz${citySuffix}.`;
    }
    return `${capitalizeTurkish(service)} hizmeti talep ediyoruz${citySuffix}.`;
  }

  const subject = [year, values.brand, values.model]
    .filter(Boolean)
    .join(" ");
  const condition = values.condition ? `, ${lowerTurkish(values.condition)}` : "";
  if (subject) {
    return `${subject}${condition} araç satın alma talebi oluşturuyoruz${citySuffix}.`;
  }

  return `Araç satın alma talebi oluşturuyoruz${citySuffix}.`;
}

function composeTechnologyOpening(
  input: ComposeRequestTextInput,
  values: Record<string, string>,
): string {
  const city = resolveCity(input, values);
  const citySuffix = city ? ` (${city})` : "";
  const needType = values.needType || "software";
  const solution =
    values.solutionType?.trim() ||
    (needType === "hardware"
      ? "donanım"
      : needType === "service"
        ? "bakım ve destek"
        : "yazılım çözümü");

  const preferenceClause = composeHardwarePreferenceClause(values);
  const subjectLabel = formatTechnologySubject(solution);

  if (needType === "hardware") {
    return `${subjectLabel} tedarik talebi oluşturuyoruz${citySuffix}.${preferenceClause}`;
  }
  if (needType === "service") {
    return `${subjectLabel} hizmeti talep ediyoruz${citySuffix}.`;
  }
  return `${subjectLabel} geliştirme / tedarik talebi oluşturuyoruz${citySuffix}.`;
}

/** Keep Apple-style casing (iPhone / iPad); otherwise Turkish-capitalize. */
function formatTechnologySubject(solution: string): string {
  if (/^i[A-ZÇĞİÖŞÜ]/.test(solution)) return solution;
  return capitalizeTurkish(solution);
}

/** Corporate preference sentence from structured specs (never echoes slang). */
function composeHardwarePreferenceClause(
  values: Record<string, string>,
): string {
  const specs = values.specs?.trim();
  if (!specs) return "";

  const parts: string[] = [];
  const lower = specs.toLocaleLowerCase("tr-TR");
  if (lower.includes("temiz") || lower.includes("iyi durumda")) {
    parts.push("temiz / iyi durumda");
  }
  if (lower.includes("uygun fiyat")) {
    parts.push("bütçeye uygun fiyatlı");
  }

  if (parts.length === 0) return "";
  return ` Tercihen ${parts.join(" ve ")} olmalıdır.`;
}

function composeMachineryOpening(
  input: ComposeRequestTextInput,
  values: Record<string, string>,
): string {
  const city = resolveCity(input, values);
  const citySuffix = city ? ` (${city})` : "";
  const needType = values.needType || "machine";
  const machine = values.machineType?.trim() || values.part?.trim();

  if (needType === "part") {
    return `${capitalizeTurkish(machine || "yedek parça")} tedarik talebi oluşturuyoruz${citySuffix}.`;
  }
  if (needType === "service") {
    return `Makine servis / bakım hizmeti talep ediyoruz${citySuffix}.`;
  }
  return `${capitalizeTurkish(machine || "üretim makinesi")} tedarik talebi oluşturuyoruz${citySuffix}.`;
}

function composePrintingOpening(
  input: ComposeRequestTextInput,
  values: Record<string, string>,
): string {
  const city = resolveCity(input, values);
  const citySuffix = city ? ` (${city})` : "";
  const qtyLabel = formatQuantityPhrase(input, values);
  const material = values.material?.trim();
  const printType = values.printType?.trim();
  const subject = [qtyLabel, material, printType || "matbaa / baskı işi"]
    .filter(Boolean)
    .join(" ");

  return `${capitalizeTurkish(subject)} için teklif talep ediyoruz${citySuffix}.`;
}

function composeGenericOpening(
  input: ComposeRequestTextInput,
  values: Record<string, string>,
): string {
  const city = resolveCity(input, values);
  const citySuffix = city ? ` (${city})` : "";
  const primary =
    input.fields
      ?.map((field) => values[field.key]?.trim())
      .find(Boolean) || input.commonDraft?.title?.trim();

  if (primary) {
    return `${capitalizeTurkish(primary)} tedarik talebi oluşturuyoruz${citySuffix}.`;
  }

  return `Kurumsal tedarik talebi oluşturuyoruz${citySuffix}.`;
}

function composeRealEstateTitle(
  rawText: string,
  values: Record<string, string>,
  city?: string,
): string {
  const short = composeRealEstateShortTitle(rawText, values, city);
  if (short === "Emlak talebi") {
    return "Gayrimenkul tedarik / kiralama talebi oluşturuyoruz.";
  }
  return short.endsWith(".")
    ? short
    : `${short} için teklif talep ediyoruz.`;
}

/** Compact listing title for the form field (no trailing "arıyorum"). */
function composeRealEstateShortTitle(
  rawText: string,
  values: Record<string, string>,
  city?: string,
): string {
  const normalized = rawText.toLocaleLowerCase("tr-TR");
  const listing =
    values.listingType?.toLocaleLowerCase("tr-TR") ||
    (normalized.includes("satılık") || normalized.includes("satilik")
      ? "satılık"
      : normalized.includes("kiralık") || normalized.includes("kirilik")
        ? "kiralık"
        : "");

  const property = (
    values.propertyType?.toLocaleLowerCase("tr-TR") ||
    (normalized.includes("daire")
      ? "daire"
      : normalized.includes("villa")
        ? "villa"
        : normalized.includes("ev") || normalized.includes("konut")
          ? "daire"
          : "gayrimenkul")
  ).toLocaleLowerCase("tr-TR");

  const district =
    extractDistrictFromCity(city) ||
    capitalizeTurkish(values.location || "") ||
    undefined;

  const room = values.roomCount?.trim();
  const roomPhrase = room ? `${room} ` : "";

  if (district && listing) {
    return `${formatDistrict(district)}'da ${listing} ${roomPhrase}${property}`
      .replace(/\s+/g, " ")
      .trim();
  }

  if (listing) {
    return `${capitalizeTurkish(listing)} ${roomPhrase}${property}`
      .replace(/\s+/g, " ")
      .trim();
  }

  if (room) {
    return `${room} ${property}`.replace(/\s+/g, " ").trim();
  }

  return "Emlak talebi";
}

function deriveShortTitleFromRawText(rawText: string): string | undefined {
  // Always normalize first so slang openers never become the title.
  const cleaned = normalizeCasualTurkish(rawText)
    .replace(
      /\b(ben|ne|arıyorum|ariyorum|arıyom|ariyom|arıyorm|lazım|lazim|lazm|istiyorum|istiyom|istiyorm|olsun|lütfen|lutfen|teşekkürler|tesekkurler|acil|uygun|fiyatlı|fiyatli|temiz|durumda|iyi|bütçeye|butceye)\b/gi,
      " ",
    )
    .replace(
      /\b(biliyo(?:r)?\s*musun|biliyosun|biliyor\s*musunuz|baba|abi|kanka|lan|moruk|kral|valla|vallahi|yani|işte|iste|şey|sey)\b/gi,
      " ",
    )
    .replace(/(?:^|\s)ya(?:\s|$)/gi, " ")
    .replace(/[.,;:!?'"]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();

  if (cleaned.length < 3) return undefined;

  const words = cleaned.split(" ").filter(Boolean).slice(0, 6);
  if (words.length === 0) return undefined;

  // Reject leftover conversational debris ("Ben ne …")
  if (
    words.some((word) =>
      /^(ben|biliyo|biliyosun|musun|baba|abi|kral|lan|şey)$/i.test(word),
    )
  ) {
    return undefined;
  }

  return capitalizeTurkish(words.join(" "));
}

function collectDetailLines(
  input: ComposeRequestTextInput,
  values: Record<string, string>,
): string[] {
  const lines: string[] = [];
  const seen = new Set<string>();

  const city = normalizeCityDisplay(
    input.commonDraft?.city?.trim() ||
      input.city?.trim() ||
      values.city?.trim(),
  );

  if (city) {
    const label =
      input.categoryId === "real-estate" ? "Konum" : "Şehir / Teslimat yeri";
    lines.push(`• ${label}: ${city}`);
    seen.add(normalizeKey(label));
    seen.add(normalizeKey("Şehir / İlçe"));
    seen.add(normalizeKey("Konum / Adres"));
  }

  if (input.categoryId === "furniture") {
    const purpose = extractFurniturePurpose(input.rawText, values);
    if (purpose) {
      lines.push(`• Kullanım amacı: ${capitalizeTurkish(purpose)}`);
      seen.add(normalizeKey("Kullanım amacı"));
    }
  }

  for (const field of input.fields ?? []) {
    const value =
      field.key === "modelYear"
        ? formatModelYearPreference(values)
        : values[field.key]?.trim();
    if (!value) continue;

    if (
      input.categoryId === "real-estate" &&
      field.key === "location" &&
      isRedundantLocation(value, city)
    ) {
      continue;
    }

    const normalizedLabel = normalizeKey(field.label);
    if (seen.has(normalizedLabel)) continue;

    lines.push(
      `• ${field.label}: ${softCorrectValue(field.key, value, input.categoryId, field.options)}`,
    );
    seen.add(normalizedLabel);
  }

  for (const field of input.commonFields ?? []) {
    if (field.key === "title" || field.key === "city") continue;

    const value = input.commonDraft?.[field.key as keyof CommonDraft]?.trim();
    if (!value) continue;

    const normalizedLabel = normalizeKey(field.label);
    if (seen.has(normalizedLabel)) continue;

    lines.push(`• ${field.label}: ${value}`);
    seen.add(normalizedLabel);
  }

  if (
    input.categoryId !== "real-estate" &&
    input.quantity &&
    !lines.some((line) => line.includes("Miktar"))
  ) {
    lines.push(
      `• Miktar: ${input.quantity}${input.unit ? ` ${input.unit}` : ""}`,
    );
  }

  if (
    input.deliveryDays &&
    !lines.some((line) => line.toLowerCase().includes("teslim"))
  ) {
    const label =
      input.categoryId === "technology" && values.needType !== "hardware"
        ? "Proje süresi"
        : "Teslim süresi";
    lines.push(`• ${label}: ${input.deliveryDays} gün`);
  }

  if (
    input.budget &&
    !lines.some((line) => line.toLocaleLowerCase("tr-TR").includes("bütçe"))
  ) {
    const formatted = new Intl.NumberFormat("tr-TR", {
      style: "currency",
      currency: "TRY",
      maximumFractionDigits: 0,
    }).format(input.budget);
    lines.push(`• Bütçe: ${formatted}`);
  }

  return lines;
}

function formatModelYearPreference(
  values: Record<string, string>,
): string | undefined {
  if (values.yearMin?.trim()) return `${values.yearMin.trim()} ve üzeri`;
  if (values.yearMax?.trim()) return `${values.yearMax.trim()} ve altı`;
  return values.modelYear?.trim() || undefined;
}

function resolveTitleQuantity(
  input: ComposeRequestTextInput,
  values: Record<string, string>,
): string | undefined {
  const draftQty = input.commonDraft?.quantity?.trim();
  if (draftQty) return draftQty;
  if (input.quantity) {
    return `${input.quantity} ${input.unit || "adet"}`;
  }
  return values.quantity?.trim() || undefined;
}

function mergeFieldValues(input: ComposeRequestTextInput): Record<string, string> {
  const values: Record<string, string> = {};

  for (const [key, value] of Object.entries(input.attributes ?? {})) {
    if (value !== undefined && value !== null && String(value).trim()) {
      values[key] = String(value).trim();
    }
  }

  for (const [key, value] of Object.entries(input.fieldValues ?? {})) {
    if (value?.trim()) {
      values[key] = value.trim();
    }
  }

  return values;
}

function resolveCity(
  input: ComposeRequestTextInput,
  values: Record<string, string>,
): string | undefined {
  return normalizeCityDisplay(
    input.commonDraft?.city?.trim() ||
      input.city?.trim() ||
      values.city?.trim(),
  );
}

function formatQuantityPhrase(
  input: ComposeRequestTextInput,
  values: Record<string, string>,
): string | undefined {
  const draftQty = input.commonDraft?.quantity?.trim();
  if (draftQty) return draftQty;

  if (input.quantity) {
    return `${input.quantity} ${input.unit || "adet"}`;
  }

  const rawQty = values.quantity?.trim();
  return rawQty || undefined;
}

function extractFurniturePurpose(
  rawText: string,
  values: Record<string, string>,
): string | undefined {
  const normalized = rawText.toLocaleLowerCase("tr-TR");

  if (
    normalized.includes("makam odası") ||
    normalized.includes("makam odasi") ||
    normalized.includes("makam")
  ) {
    return "makam odası";
  }
  if (
    normalized.includes("toplantı odası") ||
    normalized.includes("toplantı odasi")
  ) {
    return "toplantı odası";
  }
  if (normalized.includes("yönetici odası") || normalized.includes("yonetici odasi")) {
    return "yönetici odası";
  }
  if (normalized.includes("resepsiyon")) {
    return "resepsiyon";
  }

  const usage = values.usageArea?.trim();
  if (usage && usage !== "Diğer" && usage !== "Ofis") {
    return lowerTurkish(usage);
  }

  return undefined;
}

function inferFurnitureTypeLabel(rawText: string): string | undefined {
  const normalized = rawText.toLocaleLowerCase("tr-TR");

  if (
    normalized.includes("masa takımı") ||
    normalized.includes("masa takimi") ||
    normalized.includes("makam") ||
    normalized.includes("yönetici masa") ||
    normalized.includes("yonetici masa")
  ) {
    return "Makam / yönetici masa takımı";
  }
  if (
    normalized.includes("toplantı masası") ||
    normalized.includes("toplantı masasi")
  ) {
    return "Toplantı masası";
  }
  if (
    normalized.includes("ofis sandalyesi") ||
    (normalized.includes("sandalye") && normalized.includes("ofis"))
  ) {
    return "Ofis sandalyesi";
  }
  if (normalized.includes("sandalye")) return "Ofis sandalyesi";
  if (
    normalized.includes("çalışma masası") ||
    normalized.includes("calisma masasi") ||
    normalized.includes("ofis masası") ||
    normalized.includes("ofis masasi") ||
    normalized.includes("masa")
  ) {
    return "Çalışma / ofis masası";
  }
  if (normalized.includes("koltuk")) return "Koltuk grubu";
  if (normalized.includes("dolap")) return "Dolap / raf";

  return undefined;
}

function inferPrintingProductLabel(rawText: string): string | undefined {
  const normalized = rawText.toLocaleLowerCase("tr-TR");

  const products: Array<[string, string]> = [
    ["kart vizit", "Kartvizit"],
    ["kartvizit", "Kartvizit"],
    ["kraft kutu", "Kraft kutu"],
    ["oluklu kutu", "Oluklu kutu"],
    ["cepli dosya", "Cepli dosya"],
    ["roll up", "Roll-up"],
    ["broşür", "Broşür"],
    ["brosur", "Broşür"],
    ["flyer", "Flyer"],
    ["afiş", "Afiş"],
    ["afis", "Afiş"],
    ["katalog", "Katalog"],
    ["davetiye", "Davetiye"],
    ["sticker", "Sticker"],
    ["etiket", "Etiket"],
    ["ambalaj", "Ambalaj"],
    ["branda", "Branda"],
    ["tabela", "Tabela"],
    ["magnet", "Magnet"],
    ["mıknatıs", "Magnet"],
    ["miknatis", "Magnet"],
    ["antetli", "Antetli kağıt"],
    ["zarf", "Zarf"],
    ["poşet", "Poşet"],
    ["poset", "Poşet"],
    ["kutu", "Kutu"],
  ];

  for (const [needle, label] of products) {
    if (normalized.includes(needle)) return label;
  }

  return undefined;
}

function softCorrectValue(
  key: string,
  value: string,
  categoryId?: string,
  options?: DynamicField["options"],
): string {
  if (key === "city" || key === "location") {
    return normalizeCityDisplay(value) || value;
  }
  return resolveFieldOptionLabel({
    value,
    fieldKey: key,
    categoryId,
    options,
  });
}

function normalizeCityDisplay(city?: string): string | undefined {
  if (!city) return undefined;

  const parts = city
    .split(/\s*\/\s*/)
    .map((part) => part.trim())
    .filter(Boolean)
    .map((part) => {
      const known = KNOWN_CITIES.find(
        (item) =>
          item.toLocaleLowerCase("tr-TR") === part.toLocaleLowerCase("tr-TR"),
      );
      return known || capitalizeTurkish(part);
    });

  return parts.join(" / ");
}

function extractDistrictFromCity(city?: string): string | undefined {
  if (!city) return undefined;

  const parts = city.split(" / ").map((part) => part.trim()).filter(Boolean);
  return parts.length > 1 ? parts[parts.length - 1] : undefined;
}

function isRedundantLocation(location: string, city?: string): boolean {
  if (!location || !city) return false;

  const normalizedLocation = location.toLocaleLowerCase("tr-TR");
  const normalizedCity = city.toLocaleLowerCase("tr-TR");

  return normalizedCity.includes(normalizedLocation);
}

function formatDistrict(district: string): string {
  return capitalizeTurkish(district.trim());
}

function capitalizeTurkish(text: string): string {
  if (!text) return text;
  return text.charAt(0).toLocaleUpperCase("tr-TR") + text.slice(1);
}

function lowerTurkish(text: string): string {
  return text.toLocaleLowerCase("tr-TR");
}

function normalizeKey(value: string): string {
  return value.toLocaleLowerCase("tr-TR").replace(/\s+/g, " ").trim();
}
