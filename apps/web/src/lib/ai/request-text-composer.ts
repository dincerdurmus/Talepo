import type { DynamicField } from "@/lib/request-category-engine";

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

  if (input.categoryId === "real-estate") {
    return composeRealEstateTitle(input.rawText, values, input.city);
  }

  if (input.categoryId === "automotive") {
    const needType = values.needType || "vehicle";
    if (needType === "part" || needType === "tire") {
      const parts = [
        values.modelYear,
        values.brand,
        values.model,
        values.part ? `için ${values.part}` : "",
      ].filter(Boolean);
      if (parts.length >= 2) {
        return `${parts.join(" ")} talebi`.replace(/\s+/g, " ").trim();
      }
    } else if (needType === "service") {
      const parts = [
        values.brand,
        values.model,
        values.serviceType || "servis",
      ].filter(Boolean);
      if (parts.length >= 2) {
        return `${parts.join(" ")} talebi`.replace(/\s+/g, " ").trim();
      }
    } else {
      const parts = [values.modelYear, values.brand, values.model].filter(
        Boolean,
      );
      if (parts.length >= 2) {
        return `${parts.join(" ")} talebi`.replace(/\s+/g, " ").trim();
      }
    }
  }

  if (input.categoryId === "furniture") {
    const qty = input.commonDraft?.quantity?.trim() || values.quantity?.trim();
    const type = values.furnitureType?.trim();
    const city = normalizeCityDisplay(
      input.city?.trim() || input.commonDraft?.city?.trim(),
    );
    if (type) {
      return [qty, type, city ? `(${city})` : ""].filter(Boolean).join(" ");
    }
  }

  const firstDetail = input.fields
    ?.map((field) => values[field.key]?.trim())
    .find(Boolean);

  if (firstDetail && input.categoryId !== "real-estate") {
    return `${firstDetail} talebi`;
  }

  return "Yeni talep";
}

export function composeProfessionalDescription(
  input: ComposeRequestTextInput,
): string {
  const values = mergeFieldValues(input);
  const opening = composeOpeningSentence(input, values);
  const detailLines = collectDetailLines(input, values);
  const instruction =
    OFFER_INSTRUCTIONS[input.categoryId] ?? OFFER_INSTRUCTIONS.default;

  return [opening, detailLines.length ? detailLines.join("\n") : "", instruction]
    .filter(Boolean)
    .join("\n\n");
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

  return composeGenericOpening(input, values);
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

  if (needType === "part" || needType === "tire") {
    const subject = [values.modelYear, values.brand, values.model]
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

  const subject = [values.modelYear, values.brand, values.model]
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

  if (needType === "hardware") {
    return `${capitalizeTurkish(solution)} tedarik talebi oluşturuyoruz${citySuffix}.`;
  }
  if (needType === "service") {
    return `${capitalizeTurkish(solution)} hizmeti talep ediyoruz${citySuffix}.`;
  }
  return `${capitalizeTurkish(solution)} geliştirme / tedarik talebi oluşturuyoruz${citySuffix}.`;
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

  if (district && listing) {
    return `${formatDistrict(district)}'da ${listing} ${property} arıyorum`;
  }

  if (listing) {
    return `${capitalizeTurkish(listing)} ${property} arıyorum`;
  }

  return "Emlak talebi";
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
    const value = values[field.key]?.trim();
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

    lines.push(`• ${field.label}: ${softCorrectValue(field.key, value)}`);
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
      input.categoryId === "technology" ? "Proje süresi" : "Teslim süresi";
    lines.push(`• ${label}: ${input.deliveryDays} gün`);
  }

  return lines;
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

function softCorrectValue(key: string, value: string): string {
  if (key === "city" || key === "location") {
    return normalizeCityDisplay(value) || value;
  }
  return value;
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
