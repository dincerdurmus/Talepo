/**
 * Request Schema Registry — category/subcategory technical fields.
 * Bridges existing DynamicField definitions + knowledge-only fields.
 */

import {
  resolveRequestCategory,
  getVisibleCategoryFields,
  type DynamicField,
} from "@/lib/request-category-engine";

import { resolveKnowledgeProfile } from "./profile-registry";
import type { KnowledgeField, KnowledgeFieldType } from "./types";

function mapDynamicType(t: DynamicField["type"]): KnowledgeFieldType {
  if (t === "number") return "NUMBER";
  if (t === "select") return "ENUM";
  return "TEXT";
}

/** Fields where conscious ANY / Farketmez is meaningful. */
const ALLOW_ANY_KEYS = new Set([
  "brand",
  "brandPreference",
  "color",
  "model",
  "condition",
  "deliveryDate",
  "delivery",
  "resolution",
  "panelType",
]);

const DISALLOW_ANY_KEYS = new Set([
  "quantity",
  "productType",
  "needType",
  "solutionType",
  "title",
]);

function defaultAllowAny(key: string): boolean | undefined {
  if (DISALLOW_ANY_KEYS.has(key)) return false;
  if (ALLOW_ANY_KEYS.has(key)) return true;
  return undefined;
}

function fromDynamic(field: DynamicField): KnowledgeField {
  return {
    key: field.key,
    canonicalLabel: field.label,
    type: mapDynamicType(field.type),
    unit: field.unit,
    priority: field.required
      ? "required"
      : field.when
        ? "conditional"
        : "optional",
    options: field.options,
    visibleWhen: field.when
      ? { field: field.when.field, in: field.when.in }
      : undefined,
    engineFieldKey: field.key,
    source: "TALEP_O_ENGINE",
    allowAny: defaultAllowAny(field.key),
  };
}

/** Extra knowledge fields not yet on DynamicField (browse / future). */
const EXTRA_FIELDS: Record<string, KnowledgeField[]> = {
  "automotive/yedek-parca": [
    {
      key: "partSystem",
      canonicalLabel: "Parça sistemi",
      type: "ENTITY_REFERENCE",
      priority: "optional",
      aliases: ["sistem", "grup"],
    },
    {
      key: "position",
      canonicalLabel: "Pozisyon",
      type: "ENTITY_REFERENCE",
      priority: "conditional",
      aliases: ["ön", "arka", "sağ", "sol"],
      visibleWhen: { field: "needType", in: ["part"] },
    },
    {
      key: "oemNumber",
      canonicalLabel: "OEM / parça numarası",
      type: "TEXT",
      priority: "optional",
      aliases: ["oem", "part number"],
    },
  ],
  printing: [
    {
      key: "productType",
      canonicalLabel: "Ürün tipi",
      type: "ENUM",
      priority: "required",
      options: [
        { label: "Karton kutu", value: "karton-kutu" },
        { label: "Etiket", value: "etiket" },
        { label: "Broşür", value: "brosur" },
        { label: "Diğer", value: "diger" },
      ],
    },
    {
      key: "width",
      canonicalLabel: "En",
      type: "MEASUREMENT",
      unit: "mm",
      priority: "conditional",
      dependsOn: ["productType"],
    },
    {
      key: "height",
      canonicalLabel: "Boy",
      type: "MEASUREMENT",
      unit: "mm",
      priority: "conditional",
      dependsOn: ["productType"],
    },
    {
      key: "depth",
      canonicalLabel: "Derinlik",
      type: "MEASUREMENT",
      unit: "mm",
      priority: "optional",
      visibleWhen: { field: "productType", in: ["karton-kutu"] },
    },
    {
      key: "gsm",
      canonicalLabel: "Gramaj",
      type: "NUMBER",
      unit: "gsm",
      priority: "optional",
    },
    {
      key: "printMethod",
      canonicalLabel: "Baskı yöntemi",
      type: "ENUM",
      priority: "optional",
      options: [
        { label: "Ofset", value: "ofset" },
        { label: "Dijital", value: "dijital" },
        { label: "Flekso", value: "flekso" },
      ],
    },
    {
      key: "lamination",
      canonicalLabel: "Selefon / laminasyon",
      type: "TEXT",
      priority: "optional",
      visibleWhen: { field: "productType", in: ["karton-kutu", "brosur"] },
    },
    {
      key: "quantity",
      canonicalLabel: "Adet",
      type: "NUMBER",
      priority: "required",
    },
    {
      key: "deliveryDate",
      canonicalLabel: "Termin",
      type: "DATE",
      priority: "optional",
    },
  ],
  appliances: [
    {
      key: "volume",
      canonicalLabel: "Hacim",
      type: "NUMBER",
      unit: "L",
      priority: "optional",
      aliases: ["litre", "liter"],
      visibleWhen: {
        field: "applianceType",
        in: ["Buzdolabı", "Derin Dondurucu", "Şarap Dolabı", "Su Sebili"],
      },
    },
    {
      key: "freezerVolume",
      canonicalLabel: "Dondurucu hacmi",
      type: "NUMBER",
      unit: "L",
      priority: "optional",
      visibleWhen: {
        field: "applianceType",
        in: ["Buzdolabı", "Derin Dondurucu"],
      },
    },
    {
      key: "capacityKg",
      canonicalLabel: "Kapasite",
      type: "NUMBER",
      unit: "kg",
      priority: "optional",
      aliases: ["kg", "yıkama kapasitesi"],
      visibleWhen: {
        field: "applianceType",
        in: [
          "Çamaşır Makinesi",
          "Çamaşır Kurutma Makinesi",
          "Bulaşık Makinesi",
        ],
      },
    },
    {
      key: "rpm",
      canonicalLabel: "Devir",
      type: "NUMBER",
      unit: "rpm",
      priority: "optional",
      visibleWhen: {
        field: "applianceType",
        in: ["Çamaşır Makinesi"],
      },
    },
    {
      key: "capacityBtu",
      canonicalLabel: "BTU kapasitesi",
      type: "NUMBER",
      unit: "BTU",
      priority: "optional",
      aliases: ["btu"],
      visibleWhen: {
        field: "applianceType",
        in: ["Klima"],
      },
    },
    {
      key: "inverter",
      canonicalLabel: "Inverter",
      type: "BOOLEAN",
      priority: "optional",
      visibleWhen: {
        field: "applianceType",
        in: ["Klima", "Kombi"],
      },
    },
    {
      key: "installationType",
      canonicalLabel: "Montaj tipi",
      type: "TEXT",
      priority: "optional",
      visibleWhen: {
        field: "applianceType",
        in: [
          "Klima",
          "Ankastre Set",
          "Aspiratör & Davlumbaz",
          "Fırın",
          "Set Üstü Ocak",
          "Bulaşık Makinesi",
        ],
      },
    },
    {
      key: "volumeLiters",
      canonicalLabel: "Fırın hacmi",
      type: "NUMBER",
      unit: "L",
      priority: "optional",
      visibleWhen: {
        field: "applianceType",
        in: ["Fırın", "Mikrodalga Fırın"],
      },
    },
    {
      key: "ovenType",
      canonicalLabel: "Fırın tipi",
      type: "TEXT",
      priority: "optional",
      visibleWhen: {
        field: "applianceType",
        in: ["Fırın", "Mikrodalga Fırın"],
      },
    },
    {
      key: "doorType",
      canonicalLabel: "Kapı tipi",
      type: "TEXT",
      priority: "optional",
      visibleWhen: {
        field: "applianceType",
        in: ["Buzdolabı"],
      },
    },
    {
      key: "dimensions",
      canonicalLabel: "Ölçüler",
      type: "TEXT",
      priority: "optional",
    },
    {
      key: "compatibleProductIds",
      canonicalLabel: "Uyumlu ürün kimlikleri",
      type: "ENTITY_REFERENCE",
      priority: "optional",
    },
  ],
  machinery: [
    {
      key: "powerKw",
      canonicalLabel: "Güç (kW)",
      type: "NUMBER",
      unit: "kW",
      priority: "optional",
      aliases: ["power", "güç"],
    },
    {
      key: "phase",
      canonicalLabel: "Faz",
      type: "TEXT",
      priority: "optional",
    },
  ],
  technology: [
    {
      key: "storage",
      canonicalLabel: "Depolama",
      type: "TEXT",
      priority: "optional",
      aliases: ["ssd", "storage", "gb"],
      visibleWhen: {
        field: "productType",
        in: [
          "dizüstü bilgisayar",
          "dizustu bilgisayar",
          "laptop",
          "notebook",
          "masaüstü bilgisayar",
          "masaustu bilgisayar",
          "cep telefonu",
          "akıllı telefon",
          "akilli telefon",
          "tablet",
        ],
      },
    },
    {
      key: "ram",
      canonicalLabel: "RAM",
      type: "TEXT",
      priority: "optional",
      visibleWhen: {
        field: "productType",
        in: [
          "dizüstü bilgisayar",
          "dizustu bilgisayar",
          "laptop",
          "notebook",
          "masaüstü bilgisayar",
          "masaustu bilgisayar",
        ],
      },
    },
    {
      key: "displayInches",
      canonicalLabel: "Ekran (inç)",
      type: "NUMBER",
      unit: "in",
      priority: "optional",
      visibleWhen: {
        field: "productType",
        in: [
          "dizüstü bilgisayar",
          "dizustu bilgisayar",
          "laptop",
          "notebook",
          "masaüstü bilgisayar",
          "masaustu bilgisayar",
        ],
      },
    },
    {
      key: "screenSize",
      canonicalLabel: "Ekran boyutu",
      type: "NUMBER",
      unit: "inç",
      priority: "optional",
      aliases: ["ekran", "inç", "inch"],
      allowAny: false,
      visibleWhen: {
        field: "productType",
        in: ["televizyon", "Televizyon", "television", "tv"],
      },
    },
    {
      key: "resolution",
      canonicalLabel: "Çözünürlük",
      type: "ENUM",
      priority: "optional",
      allowAny: true,
      options: [
        { label: "HD", value: "HD" },
        { label: "Full HD", value: "Full HD" },
        { label: "4K", value: "4K" },
        { label: "8K", value: "8K" },
        { label: "Farketmez", value: "__ANY__" },
      ],
      visibleWhen: {
        field: "productType",
        in: ["televizyon", "Televizyon", "television", "tv"],
      },
    },
    {
      key: "panelType",
      canonicalLabel: "Panel tipi",
      type: "TEXT",
      priority: "optional",
      allowAny: true,
      visibleWhen: {
        field: "productType",
        in: ["televizyon", "Televizyon", "television", "tv"],
      },
    },
    {
      key: "productType",
      canonicalLabel: "Ürün tipi",
      type: "TEXT",
      priority: "optional",
      allowAny: false,
    },
  ],
  "health/sarf-malzeme": [
    {
      key: "material",
      canonicalLabel: "Malzeme",
      type: "TEXT",
      priority: "required",
    },
    {
      key: "grade",
      canonicalLabel: "Kalite / grade",
      type: "TEXT",
      priority: "optional",
    },
    {
      key: "standard",
      canonicalLabel: "Standart",
      type: "TEXT",
      priority: "optional",
    },
    {
      key: "quantity",
      canonicalLabel: "Miktar",
      type: "NUMBER",
      priority: "required",
    },
    {
      key: "unit",
      canonicalLabel: "Birim",
      type: "ENUM",
      priority: "required",
      options: [
        { label: "Adet", value: "adet" },
        { label: "Kutu", value: "kutu" },
        { label: "Kg", value: "kg" },
      ],
    },
  ],
  "printing/karton-kutu": [
    {
      key: "boxType",
      canonicalLabel: "Kutu tipi",
      type: "TEXT",
      priority: "required",
      aliases: ["kutu", "box type"],
    },
    {
      key: "dimensions",
      canonicalLabel: "Ölçüler (En x Boy x Yükseklik)",
      type: "TEXT",
      priority: "required",
      unit: "mm",
    },
    {
      key: "gsm",
      canonicalLabel: "Gramaj / oluk",
      type: "TEXT",
      priority: "optional",
    },
    {
      key: "quantity",
      canonicalLabel: "Adet",
      type: "NUMBER",
      priority: "required",
    },
  ],
  "printing/etiket-baski": [
    {
      key: "labelType",
      canonicalLabel: "Etiket tipi",
      type: "TEXT",
      priority: "required",
    },
    {
      key: "size",
      canonicalLabel: "Ölçü",
      type: "TEXT",
      priority: "required",
      unit: "mm",
    },
    {
      key: "quantity",
      canonicalLabel: "Adet / metre",
      type: "NUMBER",
      priority: "required",
    },
  ],
  "furniture/ofis-sandalyesi": [
    {
      key: "chairType",
      canonicalLabel: "Sandalye tipi",
      type: "TEXT",
      priority: "required",
    },
    {
      key: "mechanism",
      canonicalLabel: "Mekanizma",
      type: "TEXT",
      priority: "optional",
    },
    {
      key: "quantity",
      canonicalLabel: "Adet",
      type: "NUMBER",
      priority: "required",
    },
  ],
  "furniture/ev-mobilyasi": [
    {
      key: "productType",
      canonicalLabel: "Ürün tipi",
      type: "TEXT",
      priority: "required",
    },
    {
      key: "dimensions",
      canonicalLabel: "Ölçüler",
      type: "TEXT",
      priority: "optional",
    },
    {
      key: "material",
      canonicalLabel: "Malzeme",
      type: "TEXT",
      priority: "optional",
    },
  ],
  "machinery/uretim-makinesi": [
    {
      key: "machineType",
      canonicalLabel: "Makine tipi",
      type: "TEXT",
      priority: "required",
      aliases: ["cnc", "pres", "makine"],
    },
    {
      key: "powerKw",
      canonicalLabel: "Güç (kW)",
      type: "NUMBER",
      unit: "kW",
      priority: "optional",
    },
    {
      key: "condition",
      canonicalLabel: "Durum",
      type: "ENUM",
      priority: "optional",
      options: [
        { label: "Sıfır", value: "new" },
        { label: "İkinci el", value: "used" },
      ],
    },
  ],
  "machinery/kesim-makinesi": [
    {
      key: "cutType",
      canonicalLabel: "Kesim teknolojisi",
      type: "TEXT",
      priority: "required",
      aliases: ["lazer", "plazma", "su jeti"],
    },
    {
      key: "bedSize",
      canonicalLabel: "Tabla / kesim alanı",
      type: "TEXT",
      priority: "optional",
    },
  ],
  "machinery/paketleme-makinesi": [
    {
      key: "packType",
      canonicalLabel: "Paketleme tipi",
      type: "TEXT",
      priority: "required",
    },
    {
      key: "capacity",
      canonicalLabel: "Kapasite",
      type: "TEXT",
      priority: "optional",
    },
  ],
  "services/danismanlik": [
    {
      key: "serviceScope",
      canonicalLabel: "Hizmet kapsamı",
      type: "TEXT",
      priority: "required",
    },
    {
      key: "duration",
      canonicalLabel: "Süre / paket",
      type: "TEXT",
      priority: "optional",
    },
  ],
  "services/nakliye": [
    {
      key: "fromCity",
      canonicalLabel: "Çıkış",
      type: "TEXT",
      priority: "required",
    },
    {
      key: "toCity",
      canonicalLabel: "Varış",
      type: "TEXT",
      priority: "required",
    },
    {
      key: "loadType",
      canonicalLabel: "Yük tipi",
      type: "TEXT",
      priority: "optional",
    },
  ],
  "services/temizlik": [
    {
      key: "serviceScope",
      canonicalLabel: "Temizlik kapsamı",
      type: "TEXT",
      priority: "required",
    },
    {
      key: "areaM2",
      canonicalLabel: "Alan (m²)",
      type: "NUMBER",
      unit: "m2",
      priority: "optional",
    },
  ],
  "services/bakim-ve-onarim": [
    {
      key: "assetType",
      canonicalLabel: "Cihaz / varlık",
      type: "TEXT",
      priority: "required",
    },
    {
      key: "serviceScope",
      canonicalLabel: "İşlem",
      type: "TEXT",
      priority: "required",
    },
  ],
  "real-estate/kiralik-konut": [
    {
      key: "propertyType",
      canonicalLabel: "Konut tipi",
      type: "TEXT",
      priority: "required",
    },
    {
      key: "rooms",
      canonicalLabel: "Oda sayısı",
      type: "TEXT",
      priority: "optional",
      aliases: ["1+1", "2+1"],
    },
    {
      key: "furnished",
      canonicalLabel: "Eşyalı mı?",
      type: "BOOLEAN",
      priority: "optional",
    },
  ],
  "real-estate/satilik-konut": [
    {
      key: "propertyType",
      canonicalLabel: "Konut tipi",
      type: "TEXT",
      priority: "required",
    },
    {
      key: "rooms",
      canonicalLabel: "Oda sayısı",
      type: "TEXT",
      priority: "optional",
    },
    {
      key: "netM2",
      canonicalLabel: "Net m²",
      type: "NUMBER",
      unit: "m2",
      priority: "optional",
    },
  ],
  "real-estate/ticari-gayrimenkul": [
    {
      key: "propertyType",
      canonicalLabel: "Ticari tip",
      type: "TEXT",
      priority: "required",
    },
    {
      key: "netM2",
      canonicalLabel: "m²",
      type: "NUMBER",
      unit: "m2",
      priority: "optional",
    },
  ],
  "real-estate/arsa": [
    {
      key: "plotType",
      canonicalLabel: "Arsa tipi",
      type: "TEXT",
      priority: "required",
    },
    {
      key: "areaM2",
      canonicalLabel: "Alan (m²)",
      type: "NUMBER",
      unit: "m2",
      priority: "optional",
    },
  ],
  "home-kitchen/yemek-takimi": [
    {
      key: "pieceCount",
      canonicalLabel: "Parça sayısı",
      type: "NUMBER",
      priority: "optional",
    },
    {
      key: "material",
      canonicalLabel: "Malzeme",
      type: "TEXT",
      priority: "optional",
      aliases: ["porselen", "bone china"],
    },
  ],
  "home-kitchen/diger": [
    {
      key: "productType",
      canonicalLabel: "Ürün tipi",
      type: "TEXT",
      priority: "required",
      aliases: ["eviye", "batarya", "musluk"],
    },
    {
      key: "dimensions",
      canonicalLabel: "Ölçüler",
      type: "TEXT",
      priority: "optional",
    },
  ],
  "baby/bebek-arabasi": [
    {
      key: "strollerType",
      canonicalLabel: "Araba tipi",
      type: "TEXT",
      priority: "required",
    },
    {
      key: "birthWeightKg",
      canonicalLabel: "Taşıma kapasitesi",
      type: "NUMBER",
      unit: "kg",
      priority: "optional",
    },
  ],
  "technology/donanim": [
    {
      key: "deviceFamily",
      canonicalLabel: "Cihaz ailesi",
      type: "TEXT",
      priority: "required",
      aliases: ["telefon", "laptop", "tv"],
    },
    {
      key: "storage",
      canonicalLabel: "Depolama",
      type: "TEXT",
      priority: "optional",
    },
    {
      key: "ram",
      canonicalLabel: "RAM",
      type: "TEXT",
      priority: "optional",
    },
    {
      key: "brand",
      canonicalLabel: "Marka",
      type: "TEXT",
      priority: "optional",
      allowAny: true,
    },
    {
      key: "model",
      canonicalLabel: "Model",
      type: "TEXT",
      priority: "optional",
      allowAny: true,
    },
    {
      key: "condition",
      canonicalLabel: "Durum",
      type: "ENUM",
      priority: "optional",
      allowAny: true,
      options: [
        { label: "Sıfır", value: "Sıfır" },
        { label: "İkinci el", value: "İkinci el" },
        { label: "Farketmez", value: "__ANY__" },
      ],
    },
  ],
  "automotive/lastik-ve-jant": [
    {
      key: "tireSize",
      canonicalLabel: "Lastik ebatı",
      type: "TEXT",
      priority: "required",
      aliases: ["205/55 R16"],
    },
    {
      key: "season",
      canonicalLabel: "Mevsim",
      type: "ENUM",
      priority: "optional",
      options: [
        { label: "Yaz", value: "summer" },
        { label: "Kış", value: "winter" },
        { label: "4 mevsim", value: "all-season" },
      ],
    },
  ],
  "automotive/arac-bakim": [
    {
      key: "serviceType",
      canonicalLabel: "Bakım tipi",
      type: "TEXT",
      priority: "required",
    },
    {
      key: "vehicleInfo",
      canonicalLabel: "Araç bilgisi",
      type: "TEXT",
      priority: "optional",
    },
  ],
};

function isFieldVisible(
  field: KnowledgeField,
  values: Record<string, string | undefined>,
): boolean {
  if (!field.visibleWhen) return true;
  const current = (values[field.visibleWhen.field] ?? "")
    .trim()
    .toLocaleLowerCase("tr-TR");
  if (!current) return false;
  return field.visibleWhen.in.some(
    (v) => v.trim().toLocaleLowerCase("tr-TR") === current,
  );
}

function isFilled(values: Record<string, string | undefined>, key: string): boolean {
  const v = values[key];
  if (v == null) return false;
  const s = String(v).trim();
  if (!s) return false;
  // ANY / NOT_APPLICABLE count as answered (not missing)
  if (
    s === "__ANY__" ||
    s === "ANY" ||
    s === "__NOT_APPLICABLE__" ||
    s === "NOT_APPLICABLE" ||
    s === "__KNOWN__"
  ) {
    return true;
  }
  return true;
}

export type ResolveRequestSchemaInput = {
  categoryId: string;
  subcategoryLabel?: string | null;
  subcategorySlug?: string | null;
  values?: Record<string, string | undefined>;
};

export type ResolvedRequestSchema = {
  profileId: string;
  categoryId: string;
  fields: KnowledgeField[];
  engineFields: DynamicField[];
};

export function resolveRequestSchema(
  input: ResolveRequestSchemaInput,
): ResolvedRequestSchema {
  const profile = resolveKnowledgeProfile(input);
  const category = resolveRequestCategory(input.categoryId);
  const values = input.values ?? {};
  const engineFields = getVisibleCategoryFields(
    category.fields,
    values,
    input.categoryId,
    {
      subcategorySlug: input.subcategorySlug ?? null,
    },
  );

  const fromEngine = engineFields.map(fromDynamic);
  // profile.id may equal categoryId — never append the same EXTRA_FIELDS list twice
  const extraKeys =
    profile.id === input.categoryId
      ? [profile.id]
      : [profile.id, input.categoryId];
  const seen = new Set(fromEngine.map((f) => f.key));
  const merged = [...fromEngine];
  for (const key of extraKeys) {
    for (const field of EXTRA_FIELDS[key] ?? []) {
      if (seen.has(field.key)) continue;
      if (!isFieldVisible(field, values)) continue;
      seen.add(field.key);
      merged.push(field);
    }
  }

  return {
    profileId: profile.id,
    categoryId: input.categoryId,
    fields: merged,
    engineFields,
  };
}

export function getRequiredFields(
  input: ResolveRequestSchemaInput,
): KnowledgeField[] {
  const schema = resolveRequestSchema(input);
  const values = input.values ?? {};
  return schema.fields.filter(
    (f) => f.priority === "required" && isFieldVisible(f, values),
  );
}

export function getOptionalFields(
  input: ResolveRequestSchemaInput,
): KnowledgeField[] {
  const schema = resolveRequestSchema(input);
  const values = input.values ?? {};
  return schema.fields.filter(
    (f) =>
      (f.priority === "optional" || f.priority === "conditional") &&
      isFieldVisible(f, values),
  );
}

export function getConditionalFields(
  input: ResolveRequestSchemaInput,
): KnowledgeField[] {
  const schema = resolveRequestSchema(input);
  const values = input.values ?? {};
  return schema.fields.filter(
    (f) => f.priority === "conditional" && isFieldVisible(f, values),
  );
}

export function getMissingRequiredFields(
  input: ResolveRequestSchemaInput,
): KnowledgeField[] {
  const values = input.values ?? {};
  return getRequiredFields(input).filter((f) => !isFilled(values, f.key));
}

/**
 * Next missing fields for guided browse / follow-up.
 * Skips keys already EXPLICIT (text or browse) — see __explicit__* markers
 * and non-empty values.
 */
export function getNextMissingFields(
  input: ResolveRequestSchemaInput,
  limit = 3,
): KnowledgeField[] {
  const values = input.values ?? {};
  const schema = resolveRequestSchema(input);

  const ordered = [
    ...schema.fields.filter(
      (f) => f.priority === "required" && isFieldVisible(f, values),
    ),
    ...schema.fields.filter(
      (f) => f.priority === "conditional" && isFieldVisible(f, values),
    ),
    ...schema.fields.filter(
      (f) => f.priority === "optional" && isFieldVisible(f, values),
    ),
  ];

  const missing: KnowledgeField[] = [];
  for (const field of ordered) {
    if (isFilled(values, field.key)) continue;
    if ((values[`__explicit__${field.key}`] ?? "").trim()) continue;
    missing.push(field);
    if (missing.length >= limit) break;
  }
  return missing;
}
