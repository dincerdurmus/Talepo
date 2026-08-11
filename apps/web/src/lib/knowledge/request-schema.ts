/**
 * Request Schema Registry — category/subcategory technical fields.
 * Bridges existing DynamicField definitions + knowledge-only fields.
 */

import {
  getCategoryById,
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
};

function isFieldVisible(
  field: KnowledgeField,
  values: Record<string, string | undefined>,
): boolean {
  if (!field.visibleWhen) return true;
  const current = (values[field.visibleWhen.field] ?? "").trim();
  return field.visibleWhen.in.includes(current);
}

function isFilled(values: Record<string, string | undefined>, key: string): boolean {
  const v = values[key];
  if (v == null) return false;
  return String(v).trim().length > 0;
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
  const category = getCategoryById(input.categoryId);
  const values = input.values ?? {};
  const engineFields = getVisibleCategoryFields(
    category.fields,
    values,
    input.categoryId,
  );

  const fromEngine = engineFields.map(fromDynamic);
  const extras = [
    ...(EXTRA_FIELDS[profile.id] ?? []),
    ...(EXTRA_FIELDS[input.categoryId] ?? []),
  ];
  const seen = new Set(fromEngine.map((f) => f.key));
  const merged = [
    ...fromEngine,
    ...extras.filter((f) => !seen.has(f.key) && isFieldVisible(f, values)),
  ];

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
