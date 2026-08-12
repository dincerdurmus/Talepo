import { parseDiscoveryProjection } from "@/lib/discovery";
import { parseNeighborhoods } from "@/lib/geo/neighborhoods";
import {
  isValidRealEstateLocation,
  parseRealEstateCity,
} from "@/lib/geo/turkey-districts";
import { isValidNeighborhoodSelection } from "@/lib/geo/turkey-neighborhoods";

export type RequestFieldInput = {
  key: string;
  label: string;
  type: "text" | "number" | "select";
  value: string;
  required?: boolean;
  placeholder?: string;
  unit?: string;
  options?: Array<{ label: string; value: string }>;
};

export type CreateRequestInput = {
  title: string;
  description: string;
  professionalDescription?: string;
  category: {
    slug: string;
    name: string;
    description?: string;
  };
  city?: string;
  district?: string;
  quantity?: string;
  delivery?: string;
  budget?: string;
  aiScore?: number;
  aiSummary?: string;
  publishVersion: "manual" | "ai";
  isUrgent?: boolean;
  featureBoost?: "FEATURE_24H" | "FEATURE_3D" | "FEATURE_7D" | null;
  /**
   * When true, attach the client-confirmed cover URL (AI/stock suggestion).
   * When false/omitted, no cover image is stored.
   */
  useCoverImage?: boolean;
  coverImageUrl?: string | null;
  fields: RequestFieldInput[];
  /**
   * Phase 3A — validated discovery projection from Single Brain / hybrid state.
   * Optional; server may rebuild from text when missing.
   */
  discoveryProjection?: unknown;
  /** Phase 4B — optional client Idempotency-Key (also accepted via header). */
  idempotencyKey?: string | null;
};

export class RequestValidationError extends Error {
  issues: string[];

  constructor(issues: string[]) {
    super(issues[0] ?? "Talep bilgileri geçersiz.");
    this.name = "RequestValidationError";
    this.issues = issues;
  }
}

function asCleanString(value: unknown, maxLength: number) {
  if (typeof value !== "string") return "";
  return value.trim().slice(0, maxLength);
}

export function parseCreateRequestInput(value: unknown): CreateRequestInput {
  if (!value || typeof value !== "object") {
    throw new RequestValidationError(["Geçerli bir talep verisi gönderilmedi."]);
  }

  const raw = value as Record<string, unknown>;
  const rawCategory =
    raw.category && typeof raw.category === "object"
      ? (raw.category as Record<string, unknown>)
      : {};

  const title = asCleanString(raw.title, 160);
  const description = asCleanString(raw.description, 10_000);
  const professionalDescription = asCleanString(
    raw.professionalDescription,
    10_000,
  );
  const categorySlug = asCleanString(rawCategory.slug, 80)
    .toLowerCase()
    .replace(/[^a-z0-9-]/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "");
  const categoryName = asCleanString(rawCategory.name, 120);
  const publishVersion = raw.publishVersion === "manual" ? "manual" : "ai";

  const issues: string[] = [];
  if (title.length < 3) issues.push("Talep başlığı en az 3 karakter olmalı.");
  if (description.length < 10) issues.push("Talep açıklaması en az 10 karakter olmalı.");
  if (!categorySlug) issues.push("Kategori bilgisi eksik.");
  if (!categoryName) issues.push("Kategori adı eksik.");

  const fields: RequestFieldInput[] = Array.isArray(raw.fields)
    ? raw.fields
        .filter((item): item is Record<string, unknown> => Boolean(item) && typeof item === "object")
        .map((item) => ({
          key: asCleanString(item.key, 80),
          label: asCleanString(item.label, 120),
          type: (
            item.type === "number" || item.type === "select"
              ? item.type
              : "text"
          ) as RequestFieldInput["type"],
          value: asCleanString(item.value, 4_000),
          required: item.required === true,
          placeholder: asCleanString(item.placeholder, 240) || undefined,
          unit: asCleanString(item.unit, 40) || undefined,
          options: Array.isArray(item.options)
            ? item.options
                .filter((option): option is Record<string, unknown> => Boolean(option) && typeof option === "object")
                .map((option) => ({
                  label: asCleanString(option.label, 120),
                  value: asCleanString(option.value, 120),
                }))
                .filter((option) => option.label && option.value)
            : undefined,
        }))
        .filter((field) => field.key && field.label)
    : [];

  for (const field of fields) {
    if (field.required && !field.value) {
      issues.push(`${field.label} alanı zorunludur.`);
    }
  }

  const city = asCleanString(raw.city, 120);
  const district = asCleanString(raw.district, 120);

  if (categorySlug === "real-estate") {
    const parsed = parseRealEstateCity(city);
    const il = parsed?.il ?? "";
    const ilce = district || parsed?.ilce || "";
    if (!isValidRealEstateLocation(il, ilce)) {
      issues.push("Emlak talepleri için il ve ilçe seçimi zorunludur.");
    } else {
      const neighborhoodsField = fields.find(
        (field) => field.key === "neighborhoods",
      );
      const mahalleler = parseNeighborhoods(neighborhoodsField?.value);
      if (
        mahalleler.length > 0 &&
        !isValidNeighborhoodSelection(il, ilce, mahalleler)
      ) {
        issues.push("Seçilen mahalleler ilçe ile uyumlu değil.");
      }
    }
  }

  if (issues.length) {
    throw new RequestValidationError(issues);
  }

  const aiScoreNumber = Number(raw.aiScore);
  const useCoverImage = raw.useCoverImage === true;
  const rawCoverUrl = asCleanString(raw.coverImageUrl, 2_048);
  const coverImageUrl =
    useCoverImage && rawCoverUrl.startsWith("https://") ? rawCoverUrl : null;

  return {
    title,
    description,
    professionalDescription: professionalDescription || undefined,
    category: {
      slug: categorySlug,
      name: categoryName,
      description: asCleanString(rawCategory.description, 1_000) || undefined,
    },
    city: city || undefined,
    district: district || undefined,
    quantity: asCleanString(raw.quantity, 120) || undefined,
    delivery: asCleanString(raw.delivery, 120) || undefined,
    budget: asCleanString(raw.budget, 120) || undefined,
    aiScore: Number.isFinite(aiScoreNumber)
      ? Math.max(0, Math.min(100, Math.round(aiScoreNumber)))
      : undefined,
    aiSummary: asCleanString(raw.aiSummary, 4_000) || undefined,
    publishVersion,
    isUrgent: raw.isUrgent === true,
    featureBoost:
      raw.featureBoost === "FEATURE_24H" ||
      raw.featureBoost === "FEATURE_3D" ||
      raw.featureBoost === "FEATURE_7D"
        ? raw.featureBoost
        : null,
    useCoverImage,
    coverImageUrl,
    fields,
    discoveryProjection: parseDiscoveryProjection(raw.discoveryProjection) ?? undefined,
    idempotencyKey: asCleanString(raw.idempotencyKey, 128) || undefined,
  };
}
